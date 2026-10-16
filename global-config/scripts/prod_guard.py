#!/usr/bin/env python3
"""prod-guard: PreToolUse guard against destructive actions on production.

Reads the PreToolUse hook JSON on stdin and prints a deny/ask decision, or nothing (allow).

Why this exists: on 2026-10-16 a SERP session ran
  ssh jack@5.161.95.56 'kubectl delete namespace serp --wait=false'
unprompted and took SERP production down. Written rules do not stop a model misfire; a
mechanical check on the full command text does. This is a seatbelt against misfires, not a
boundary against an adversary (`X=kube; ${X}ctl ...` gets past any text check) -- the
cluster-side controls in docs/prod-guardrails-handoff.md are the real boundary.

Decisions:
  deny  catastrophic on ANY host/context (namespace delete, mass delete, drain, DROP/DELETE on
        prod DBs, force-push/delete of main, helm uninstall, aws delete-*, ...)
  ask   prod mutations Jack sometimes asks for (set env, scale, rollout restart, apply, exec,
        git push to main, gh pr merge, INSERT/UPDATE on serp_app, ...)
  allow reads, non-prod mutations, everything unrelated

Wrappers are unwrapped recursively: ssh <host> CMD, bash/sh/zsh -c, eval, sudo, env,
timeout/nice/nohup/time/xargs/watch, $(...) and backticks, heredocs, `bash -s < file`,
`bash script.sh`, `source file`. A normalized raw-text pass catches the worst patterns even if
parsing misses them. If the guard itself errors on a command with prod indicators it asks.
"""

import json
import os
import re
import shlex
import subprocess
import sys

DENY, ASK, ALLOW = 2, 1, 0
LEVEL_NAME = {DENY: "deny", ASK: "ask"}

PROD_HOSTS = {
    "5.161.95.56",          # SERP prod K3s node (ns serp)
    "87.99.135.189",        # sugarwish-k8s-cp (ArgoCD control plane)
    "deploy.sugarwish.com",  # ArgoCD
    "5.161.233.240",        # serp-db (serp_app prod + serp_test staging)
    "18.205.218.252",       # Jenkins
    "ciservice.sugarwish.com",
}
NONPROD_HOSTS = {"5.161.51.208"}  # serp-dev / serp-staging node
PROD_DB_HOST_RE = re.compile(r"(5\.161\.233\.240|\.rds\.amazonaws\.com|database-1\.)", re.I)
PROD_DB_NAMES = {"serp_app", "laravel_live", "sugarwish", "odoo"}
STAGING_DB_NAMES = {"serp_test", "serp_local_prod", "serp_local_staging", "laravel_local"}
PROD_INDICATOR_RE = re.compile(
    r"5\.161\.95\.56|5\.161\.233\.240|87\.99\.135\.189|deploy\.sugarwish\.com|(?<![/\w-])serp_app(?![/\w-])|"
    r"rds\.amazonaws\.com|serp\.sugarwish\.com",
    re.I,
)
RISKY_TOKEN_RE = re.compile(
    r"\b(kubectl|k3s|helm|argocd|mysql|mariadb|psql|aws|push|drop|truncate)\b|5\.161\.", re.I
)

UNPARSEABLE_RISK_RE = re.compile(r"\b(kubectl|k3s|helm|argocd)\b|5\.161\.", re.I)

MAX_DEPTH = 8
MAX_FILE_BYTES = 512 * 1024


class Verdict:
    def __init__(self):
        self.level = ALLOW
        self.reasons = []

    def add(self, level, reason):
        if level > ALLOW:
            self.reasons.append((level, reason))
        if level > self.level:
            self.level = level


# --------------------------------------------------------------------------- helpers

def read_file(path, cwd):
    try:
        p = os.path.expanduser(path)
        if not os.path.isabs(p):
            p = os.path.join(cwd or os.getcwd(), p)
        if os.path.isfile(p) and os.path.getsize(p) <= MAX_FILE_BYTES:
            with open(p, "r", errors="replace") as fh:
                return fh.read()
    except OSError:
        pass
    return None


_HOST_CACHE = {}


def classify_host(host):
    """'prod' | 'nonprod' | 'other' for an ssh destination (alias, user@host, ssh://)."""
    h = host
    if h.startswith("ssh://"):
        h = h[6:]
    h = h.split("@")[-1]
    h = re.sub(r":\d+$", "", h).strip("[]").lower()
    if h in PROD_HOSTS:
        return "prod"
    if h in NONPROD_HOSTS:
        return "nonprod"
    if h in _HOST_CACHE:
        return _HOST_CACHE[h]
    resolved = None
    try:
        out = subprocess.run(["ssh", "-G", h], capture_output=True, text=True, timeout=3).stdout
        m = re.search(r"^hostname\s+(\S+)", out, re.M)
        resolved = m.group(1).lower() if m else None
    except Exception:
        resolved = None
    cls = "other"
    if resolved in PROD_HOSTS:
        cls = "prod"
    elif resolved in NONPROD_HOSTS:
        cls = "nonprod"
    _HOST_CACHE[h] = cls
    return cls


def strip_heredocs(text):
    """Pull heredoc bodies out of a script. Returns (text_without_bodies, [bodies]).

    The `<<WORD` marker is replaced by `<<__HEREDOC_n__` so the owning command can find its
    stdin body by index.
    """
    lines = text.split("\n")
    out, bodies = [], []
    i = 0
    marker_re = re.compile(r"<<(-?)\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\2")
    while i < len(lines):
        line = lines[i]
        markers = list(marker_re.finditer(line))
        if not markers:
            out.append(line)
            i += 1
            continue
        new_line = line
        i += 1
        for m in markers:
            dash, delim = m.group(1), m.group(3)
            body = []
            while i < len(lines):
                cand = lines[i].lstrip("\t") if dash else lines[i]
                if cand.strip() == delim:
                    i += 1
                    break
                body.append(lines[i])
                i += 1
            idx = len(bodies)
            bodies.append("\n".join(body))
            new_line = new_line.replace(m.group(0), "< __HEREDOC_%d__" % idx, 1)
        out.append(new_line)
    return "\n".join(out), bodies


def _match_paren(text, j):
    """Index just past the ')' closing a '$(' whose body starts at j (quote-aware)."""
    depth, q = 1, None
    while j < len(text):
        ch = text[j]
        if ch == "\\" and q != "'":
            j += 2
            continue
        if q:
            if ch == q:
                q = None
        elif ch in ("'", '"'):
            q = ch
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return j + 1
        j += 1
    return j


def extract_substitutions(text):
    """Return inner command strings of $(...) and `...` (none inside single quotes)."""
    inners = []
    i, q = 0, None
    while i < len(text):
        ch = text[i]
        if ch == "\\" and q != "'":
            i += 2
            continue
        if q == "'":
            if ch == "'":
                q = None
            i += 1
            continue
        if ch == "'" and q is None:
            q = "'"
        elif ch == '"':
            q = None if q == '"' else '"'
        elif text.startswith("$(", i) and not text.startswith("$((", i):
            end = _match_paren(text, i + 2)
            inners.append(text[i + 2:end - 1])
            i = end
            continue
        elif ch == "`":
            end = text.find("`", i + 1)
            if end == -1:
                break
            inners.append(text[i + 1:end])
            i = end + 1
            continue
        i += 1
    return inners


def unquoted_newlines_to_semicolons(text):
    """Turn unquoted newlines into ';', drop line continuations and unquoted # comments."""
    out, q, i, n = [], None, 0, len(text)
    while i < n:
        ch = text[i]
        if ch == "\\" and q != "'":
            if i + 1 < n and text[i + 1] == "\n":
                i += 2
                continue
            out.append(text[i:i + 2])
            i += 2
            continue
        if q:
            if ch == q:
                q = None
        elif ch in ("'", '"'):
            q = ch
        elif ch == "\n":
            out.append(" ; ")
            i += 1
            continue
        elif ch == "#" and (i == 0 or text[i - 1] in " \t;&|("):
            while i < n and text[i] != "\n":
                i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


SEPARATORS = {";", "&", "&&", "||", "|", "|&", "(", ")", ";;", "&;"}


def split_segments(text):
    """Tokenize a shell string into simple-command segments.

    Returns list of (words, piped_from_prev_words_or_None, redirect_in_target_or_None).
    Raises ValueError on unbalanced quotes.
    """
    lex = shlex.shlex(unquoted_newlines_to_semicolons(text), posix=True, punctuation_chars=";&|()<>")
    lex.whitespace_split = True
    lex.commenters = ""
    tokens = list(lex)
    segments, cur, prev_words, piped = [], [], None, False
    redirect_in = None
    k = 0
    while k < len(tokens):
        t = tokens[k]
        if t in SEPARATORS or (set(t) <= set(";&|()") and t):
            if cur or redirect_in:
                segments.append((cur, prev_words if piped else None, redirect_in))
            piped = t in ("|", "|&")
            prev_words = cur
            cur, redirect_in = [], None
        elif t == "<" or t == "<<<":
            if k + 1 < len(tokens):
                redirect_in = ("<<<" if t == "<<<" else "<", tokens[k + 1])
                k += 1
        elif set(t) <= set("<>") and t:
            k += 1  # output redirect: skip its target
        elif re.fullmatch(r"\d?[<>]&?\d?-?", t):
            pass
        else:
            cur.append(t)
        k += 1
    if cur or redirect_in:
        segments.append((cur, prev_words if piped else None, redirect_in))
    return segments


WRAPPER_OPTS_WITH_ARG = {
    "sudo": {"-u", "-g", "-C", "-D", "-h", "-p", "-r", "-t", "-U", "-T"},
    "env": {"-u", "-C", "-S", "-P"},
    "timeout": {"-s", "-k", "--signal", "--kill-after"},
    "nice": {"-n"},
    "ionice": {"-c", "-n", "-p"},
    "stdbuf": {"-i", "-o", "-e"},
    "xargs": {"-I", "-L", "-n", "-P", "-s", "-d", "-E", "-a"},
    "watch": {"-n", "-d"},
    "flock": {"-w", "-E"},
}
SIMPLE_WRAPPERS = {"nohup", "time", "command", "builtin", "exec", "noglob", "setsid",
                   "caffeinate", "unbuffer", "nocorrect"}


def unwrap(words):
    """Strip env assignments and wrappers. Returns remaining words."""
    w = list(words)
    for _ in range(20):
        while w and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", w[0]):
            w = w[1:]
        if not w:
            return w
        prog = os.path.basename(w[0])
        if prog in SIMPLE_WRAPPERS:
            w = w[1:]
            while w and w[0].startswith("-") and prog in ("command", "time"):
                w = w[1:]
            continue
        if prog in WRAPPER_OPTS_WITH_ARG:
            opts = WRAPPER_OPTS_WITH_ARG[prog]
            w = w[1:]
            while w:
                a = w[0]
                if a == "--":
                    w = w[1:]
                    break
                if prog == "env" and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", a):
                    w = w[1:]
                    continue
                if a.startswith("-"):
                    w = w[1:]
                    if a in opts and w:
                        w = w[1:]
                    continue
                break
            if prog == "timeout" and w:
                w = w[1:]  # duration
            if prog == "flock" and w:
                w = w[1:]  # lock file
            continue
        return w
    return w


# --------------------------------------------------------------------------- SQL

SQL_DENY = {"DROP", "TRUNCATE", "ALTER", "RENAME", "GRANT", "REVOKE", "DELETE", "SHUTDOWN",
            "PURGE", "RESET", "UNINSTALL", "CLONE"}
SQL_ASK = {"KILL", "FLUSH", "INSERT", "UPDATE", "REPLACE", "CREATE", "LOAD", "CALL", "DO", "HANDLER", "LOCK",
           "IMPORT", "INSTALL", "OPTIMIZE", "REPAIR", "MERGE", "COPY", "VACUUM", "CLUSTER",
           "REINDEX", "COMMENT", "SECURITY", "REFRESH", "DISCARD", "PREPARE", "EXECUTE",
           "DEALLOCATE", "XA", "CHANGE", "STOP", "START"}
SQL_READ = {"SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "TABLE", "VALUES", "HELP", "USE",
            "BEGIN", "COMMIT", "ROLLBACK", "WITH", "ANALYZE", "CHECK", "CHECKSUM"}


def sql_normalize(sql):
    s = re.sub(r"/\*!\d*", " ", sql)          # MySQL executable comments run their content
    s = re.sub(r"/\*.*?\*/", " ", s, flags=re.S)
    s = re.sub(r"(--[^\n]*|#[^\n]*)", " ", s)
    s = re.sub(r"'(?:[^'\\]|\\.|'')*'", "''", s, flags=re.S)
    s = re.sub(r'"(?:[^"\\]|\\.|"")*"', '""', s, flags=re.S)
    return s


def classify_sql(sql):
    """Return (level, reason) for SQL against a PROD database (worst statement wins)."""
    worst, why = ALLOW, ""
    for stmt in sql_normalize(sql).split(";"):
        st = stmt.strip()
        if not st:
            continue
        kw = re.match(r"\(?\s*([A-Za-z]+)", st)
        if not kw:
            continue
        first = kw.group(1).upper()
        up = " " + re.sub(r"\s+", " ", st.upper()) + " "
        level = ALLOW
        if first in SQL_DENY:
            level = DENY
        elif first == "WITH":
            if re.search(r"\b(DELETE|DROP|TRUNCATE)\b", up):
                level = DENY
            elif re.search(r"\b(INSERT|UPDATE|REPLACE)\b", up):
                level = ASK
        elif first == "SET":
            if re.search(r"\bSET\s+(GLOBAL|PERSIST|PERSIST_ONLY)\b|@@GLOBAL|PASSWORD", up):
                level = DENY
            elif not re.search(r"\bSET\s+(SESSION|LOCAL|@|NAMES|CHARACTER|TRANSACTION|SQL_|AUTOCOMMIT|TIME_ZONE|SEARCH_PATH|STATEMENT_TIMEOUT|LOCK_TIMEOUT|ROLE\b)", up):
                level = ASK
        elif first == "START" and "READ ONLY" in up or first == "START" and "TRANSACTION" in up:
            level = ALLOW
        elif first in SQL_ASK:
            level = ASK
        elif first in SQL_READ:
            if re.search(r"\bINTO\s+(OUTFILE|DUMPFILE)\b|\bFOR\s+(UPDATE|SHARE)\b|\bLOCK\s+IN\s+SHARE\s+MODE\b", up):
                level = ASK
            if first == "SELECT" and re.search(r"\b(SLEEP|BENCHMARK|GET_LOCK)\s*\(", up):
                level = max(level, ASK)
        else:
            level = ASK
        if level > worst:
            worst, why = level, first + (" (in WITH)" if first == "WITH" else "")
    return worst, why


# --------------------------------------------------------------------------- analyzers

class Ctx:
    def __init__(self, target="local", cwd=None, depth=0, via=""):
        self.target = target  # local | prod | nonprod | other
        self.cwd = cwd
        self.depth = depth
        self.via = via

    def child(self, target=None, via=None):
        return Ctx(target or self.target, self.cwd, self.depth + 1,
                   via if via is not None else self.via)

    def where(self):
        return {"local": "locally", "prod": "on PROD", "nonprod": "on non-prod",
                "other": "on a remote host"}[self.target] + (" (%s)" % self.via if self.via else "")


def analyze_shell(text, ctx, v, bodies=None):
    """Analyze shell source. Heredoc bodies are only analyzed when fed to a command
    (ssh/bash/mysql stdin); a body written to a file with `cat > f <<EOF` is data."""
    if ctx.depth > MAX_DEPTH or not text or not text.strip():
        return
    body_text, own_bodies = strip_heredocs(text)
    bodies = own_bodies or (bodies or [])
    for inner in extract_substitutions(body_text):
        analyze_shell(inner, ctx.child(), v, bodies)
    try:
        segments = split_segments(body_text)
    except ValueError:
        raw_scan(body_text, ctx, v)
        if PROD_INDICATOR_RE.search(body_text) or UNPARSEABLE_RISK_RE.search(body_text):
            v.add(ASK, "prod-guard could not parse this command (unbalanced quotes) and it mentions prod/cluster tooling")
        return
    ctx = Ctx(ctx.target, ctx.cwd, ctx.depth, ctx.via)  # local copy: `cd` below must not leak to the caller
    for words, piped_from, redirect_in in segments:
        if words and words[0] == "cd" and ctx.target == "local":
            dest = os.path.expanduser(words[1]) if len(words) > 1 else os.path.expanduser("~")
            ctx.cwd = dest if os.path.isabs(dest) else os.path.join(ctx.cwd or os.getcwd(), dest)
            continue
        stdin_text = None
        if redirect_in:
            kind, target = redirect_in
            m = re.fullmatch(r"__HEREDOC_(\d+)__", target)
            if m:
                k = int(m.group(1))
                stdin_text = bodies[k] if k < len(bodies) else None
            elif kind == "<<<":
                stdin_text = target
            elif ctx.target == "local":
                stdin_text = read_file(target, ctx.cwd)
        elif piped_from:
            pw = unwrap(piped_from)
            if pw and os.path.basename(pw[0]) in ("echo", "printf"):
                stdin_text = " ".join(pw[1:])
            elif pw and os.path.basename(pw[0]) == "cat" and ctx.target == "local":
                parts = [read_file(a, ctx.cwd) for a in pw[1:] if not a.startswith("-")]
                stdin_text = None if (not parts or None in parts) else "\n".join(parts)
            else:
                stdin_text = None  # unknown stdin
        analyze_words(words, ctx, v, stdin_text, stdin_known=(stdin_text is not None or not (redirect_in or piped_from)))


def analyze_words(words, ctx, v, stdin_text, stdin_known=True):
    w = unwrap(words)
    if not w:
        return
    prog = os.path.basename(w[0])
    args = w[1:]
    if prog in ("bash", "sh", "zsh", "dash", "ksh", "fish"):
        shell_cmd(args, ctx, v, stdin_text, stdin_known)
    elif prog == "eval":
        analyze_shell(" ".join(args), ctx.child(), v)
    elif prog in ("source", "."):
        if args and ctx.target == "local":
            content = read_file(args[0], ctx.cwd)
            if content:
                analyze_shell(content, ctx.child(), v)
    elif prog == "ssh":
        ssh_cmd(args, ctx, v, stdin_text, stdin_known)
    elif prog in ("scp", "rsync", "sftp"):
        copy_cmd(prog, args, ctx, v)
    elif prog in ("kubectl", "kubecolor", "oc"):
        kubectl_cmd(args, ctx, v, stdin_text)
    elif prog == "k3s":
        if args and args[0] in ("kubectl", "crictl", "ctr"):
            analyze_words(args, ctx, v, stdin_text, stdin_known)
        elif args and args[0] == "etcd-snapshot" and len(args) > 1 and args[1] in ("delete", "prune", "restore"):
            v.add(DENY, "k3s etcd-snapshot %s %s" % (args[1], ctx.where()))
        elif args and args[0] in ("server", "agent", "certificate", "token", "secrets-encrypt") and ctx.target != "local":
            v.add(ASK, "k3s %s %s" % (args[0], ctx.where()))
    elif re.fullmatch(r"k3s-(agent-)?(uninstall|killall)\.sh", prog):
        v.add(DENY, "%s %s would wipe the cluster" % (prog, ctx.where()))
    elif prog == "helm":
        helm_cmd(args, ctx, v)
    elif prog == "argocd":
        argocd_cmd(args, ctx, v)
    elif prog in ("mysql", "mariadb", "mysqlsh", "psql"):
        sql_client(prog, args, ctx, v, stdin_text, stdin_known)
    elif prog == "git":
        git_cmd(args, ctx, v)
    elif prog == "gh":
        gh_cmd(args, ctx, v)
    elif prog == "aws":
        aws_cmd(args, ctx, v)
    elif prog in ("curl", "wget", "http", "https"):
        http_cmd(prog, args, ctx, v)
    elif prog == "rm":
        rm_cmd(args, ctx, v)
    elif prog in ("systemctl", "service"):
        systemctl_cmd(prog, args, ctx, v)
    elif prog in ("reboot", "shutdown", "poweroff", "halt") or (prog == "init" and args[:1] in (["0"], ["6"])):
        if ctx.target != "local":
            v.add(DENY, "%s %s" % (prog, ctx.where()))
    elif prog in ("mkfs", "dd", "wipefs", "fdisk", "parted") or prog.startswith("mkfs."):
        if ctx.target != "local":
            v.add(DENY, "%s %s" % (prog, ctx.where()))
    elif prog in ("docker", "crictl", "ctr", "nerdctl"):
        if ctx.target in ("prod", "other") and args and re.fullmatch(r"(rm|rmi|rmp|kill|stop|prune|system|volume|network|image|images|container)", args[0]):
            if any(a in ("rm", "prune", "rmi", "rmp", "kill", "stop") for a in args[:3]):
                v.add(ASK, "%s %s %s" % (prog, " ".join(args[:2]), ctx.where()))
    elif prog in ("python", "python3", "node", "ruby", "perl", "php"):
        interp_cmd(prog, args, ctx, v, stdin_text)
    elif prog == "xargs":
        pass


def shell_cmd(args, ctx, v, stdin_text, stdin_known):
    i = 0
    if "-n" in args:  # syntax check only, executes nothing
        return
    while i < len(args):
        a = args[i]
        if a == "-c" or (a.startswith("-") and not a.startswith("--") and "c" in a[1:]):
            if i + 1 < len(args):
                analyze_shell(args[i + 1], ctx.child(), v)
            return
        if a in ("-s", "-"):
            break
        if a.startswith("-"):
            i += 1
            continue
        # script file
        if ctx.target == "local":
            content = read_file(a, ctx.cwd)
            if content:
                analyze_shell(content, ctx.child(), v)
        elif ctx.target == "prod":
            v.add(ASK, "runs remote script %s %s (contents not visible to prod-guard)" % (a, ctx.where()))
        return
    if stdin_text is not None:
        analyze_shell(stdin_text, ctx.child(), v)
    elif not stdin_known and ctx.target == "prod":
        v.add(ASK, "pipes an unknown script into a shell %s" % ctx.where())


SSH_OPTS_WITH_ARG = set("bcDEeFIiJLlmOopQRSWw")


def ssh_cmd(args, ctx, v, stdin_text, stdin_known):
    i, host, hostname_opt = 0, None, None
    while i < len(args):
        a = args[i]
        if a.startswith("-") and len(a) >= 2:
            letter = a[1]
            optval = None
            if letter in SSH_OPTS_WITH_ARG and len(a) == 2:
                optval = args[i + 1] if i + 1 < len(args) else None
                i += 2
            else:
                if letter in SSH_OPTS_WITH_ARG:
                    optval = a[2:]
                i += 1
            if letter == "o" and optval:
                m = re.match(r"(?i)^\s*hostname\s*[= ]\s*(\S+)", optval)
                if m:
                    hostname_opt = m.group(1)
            continue
        host = a
        i += 1
        break
    if host is None:
        return
    target = classify_host(hostname_opt) if hostname_opt else classify_host(host)
    if hostname_opt and target == "other":
        target = classify_host(host)
    remote = args[i:]
    c = Ctx(target if target != "other" else "other", ctx.cwd, ctx.depth + 1, "ssh " + host)
    if remote:
        joined = " ".join(remote)
        try:
            simple = split_segments(joined)
        except ValueError:
            simple = None
        if simple and len(simple) == 1 and not simple[0][1] and not simple[0][2]:
            # one remote command: it receives our stdin (`ssh h bash -s <<EOF`, `... | ssh h mysql db`)
            analyze_words(simple[0][0], c, v, stdin_text, stdin_known)
        else:
            analyze_shell(joined, c, v)
            if stdin_text is not None:
                analyze_shell(stdin_text, c.child(), v)
    elif stdin_text is not None:
        analyze_shell(stdin_text, c, v)
    elif not stdin_known and target == "prod":
        v.add(ASK, "feeds an unknown script to ssh %s" % host)


def copy_cmd(prog, args, ctx, v):
    dests = [a for a in args if not a.startswith("-")]
    if not dests:
        return
    dest = dests[-1]
    m = re.match(r"^(?:[^/@:]+@)?([^/:]+):", dest) or re.match(r"^\w+://(?:[^@/]+@)?([^/:]+)", dest)
    if not m:
        return
    cls = classify_host(m.group(1))
    if cls == "prod":
        if prog == "rsync" and any(a.startswith("--delete") or a == "--remove-source-files" for a in args):
            v.add(DENY, "rsync --delete onto PROD host %s" % m.group(1))
        else:
            v.add(ASK, "%s copies files onto PROD host %s" % (prog, m.group(1)))


# ---- kubectl

KUBE_FLAGS_WITH_ARG = {
    "-n", "--namespace", "--context", "--kubeconfig", "--cluster", "--user", "-s", "--server",
    "--token", "-l", "--selector", "-o", "--output", "-f", "--filename", "-c", "--container",
    "--as", "--as-group", "--as-uid", "--request-timeout", "-L", "--label-columns",
    "--field-selector", "--replicas", "--grace-period", "--timeout", "-p", "--patch", "--type",
    "-k", "--kustomize", "--since", "--tail", "--image", "--for", "--cascade", "--sort-by",
    "--template", "--certificate-authority", "--client-key", "--client-certificate",
    "--subresource", "--field-manager", "--chunk-size", "--current-replicas",
    "--resource-version", "--from-literal", "--from-file", "--from-env-file", "--env", "-e",
    "--overrides", "--port", "--target-port", "--name", "--min", "--max", "--cpu-percent",
    "--to-revision", "--profile", "--since-time", "--prefix", "--max-log-requests", "-v",
    "--v", "--cache-dir", "--password", "--username", "--pod-running-timeout", "--dry-run",
}
KUBE_READ_VERBS = {"get", "describe", "logs", "log", "top", "explain", "api-resources",
                   "api-versions", "version", "cluster-info", "auth", "wait", "diff", "events",
                   "completion", "plugin", "kustomize", "options", "help", "config"}
KUBE_CRITICAL_KINDS = {
    "namespace", "namespaces", "ns", "deployment", "deployments", "deploy", "statefulset",
    "statefulsets", "sts", "daemonset", "daemonsets", "ds", "secret", "secrets", "ingress",
    "ingresses", "ing", "service", "services", "svc", "persistentvolumeclaim",
    "persistentvolumeclaims", "pvc", "persistentvolume", "persistentvolumes", "pv", "node",
    "nodes", "no", "customresourcedefinition", "customresourcedefinitions", "crd", "crds",
    "application", "applications", "app", "apps", "appproject", "appprojects",
    "applicationset", "applicationsets", "clusterrole", "clusterroles", "clusterrolebinding",
    "clusterrolebindings", "role", "roles", "rolebinding", "rolebindings", "serviceaccount",
    "serviceaccounts", "sa", "validatingadmissionpolicy", "validatingadmissionpolicies",
    "validatingadmissionpolicybinding", "validatingadmissionpolicybindings",
    "validatingwebhookconfiguration", "validatingwebhookconfigurations",
    "mutatingwebhookconfiguration", "mutatingwebhookconfigurations", "storageclass",
    "storageclasses", "sc", "configmap", "configmaps", "cm", "cronjob", "cronjobs", "cj",
    "horizontalpodautoscaler", "horizontalpodautoscalers", "hpa", "networkpolicy",
    "networkpolicies", "netpol", "all",
}


KUBE_CLUSTER_KINDS = {
    "namespace", "namespaces", "ns", "node", "nodes", "no", "customresourcedefinition",
    "customresourcedefinitions", "crd", "crds", "persistentvolume", "persistentvolumes", "pv",
    "application", "applications", "app", "apps", "appproject", "appprojects", "applicationset",
    "applicationsets", "clusterrole", "clusterroles", "clusterrolebinding", "clusterrolebindings",
    "validatingadmissionpolicy", "validatingadmissionpolicies", "validatingadmissionpolicybinding",
    "validatingadmissionpolicybindings", "validatingwebhookconfiguration",
    "validatingwebhookconfigurations", "mutatingwebhookconfiguration",
    "mutatingwebhookconfigurations", "storageclass", "storageclasses", "sc", "all",
}


def parse_kubectl(args):
    flags, pos, after_dashdash = {}, [], None
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--":
            after_dashdash = args[i + 1:]
            break
        if a.startswith("-") and len(a) > 1:
            if "=" in a:
                k, val = a.split("=", 1)
                flags.setdefault(k, []).append(val)
            elif a in KUBE_FLAGS_WITH_ARG and i + 1 < len(args):
                flags.setdefault(a, []).append(args[i + 1])
                i += 1
            else:
                flags.setdefault(a, []).append(True)
        else:
            pos.append(a)
        i += 1
    return flags, pos, after_dashdash


def kube_kinds(pos_after_verb):
    kinds = []
    for p in pos_after_verb:
        for part in p.split(","):
            kinds.append(part.split("/")[0].split(".")[0].lower())
    return kinds


def kubectl_cmd(args, ctx, v, stdin_text):
    flags, pos, inner = parse_kubectl(args)
    if not pos:
        return
    verb = pos[0]
    rest = pos[1:]
    # local kubectl talks to the prod API (~/.kube/config -> 5.161.95.56:6443)
    prod = ctx.target in ("prod", "local", "other")
    where = ctx.where() if ctx.target != "local" else "via local kubeconfig (prod API)"
    ns = (flags.get("-n") or flags.get("--namespace") or [""])[0]
    loc = "%s%s" % (where, " ns=%s" % ns if ns and ns is not True else "")
    has = lambda *names: any(n in flags for n in names)  # noqa: E731

    if verb in KUBE_READ_VERBS:
        if verb == "config" and rest[:1] and rest[0] in ("delete-context", "delete-cluster", "delete-user"):
            return
        return
    if verb == "rollout":
        sub = rest[0] if rest else ""
        if sub in ("status", "history"):
            return
        if prod:
            v.add(ASK, "kubectl rollout %s %s" % (sub, loc))
        return
    if verb == "delete":
        kinds = kube_kinds(rest)
        mass = has("--all", "-A", "--all-namespaces", "-l", "--selector", "--field-selector")
        by_file = has("-f", "--filename", "-k", "--kustomize")
        # On non-prod only cluster-wide / namespace-level kinds are catastrophic; recreating a
        # serp-dev secret or deployment is routine there.
        crit = [k for k in kinds if k in (KUBE_CRITICAL_KINDS if prod else KUBE_CLUSTER_KINDS)]
        if crit or mass or by_file or not kinds:
            what = ",".join(crit) or ("--all/selector" if mass else ("-f/-k manifest" if by_file else "?"))
            v.add(DENY, "kubectl delete %s %s" % (what, loc))
        elif prod:
            v.add(ASK, "kubectl delete %s %s" % (" ".join(rest), loc))
        return
    if verb in ("drain", "cordon", "taint"):
        v.add(DENY, "kubectl %s %s" % (verb, loc))
        return
    if verb == "replace" and has("--force"):
        v.add(DENY, "kubectl replace --force %s" % loc)
        return
    if verb == "patch":
        kinds = kube_kinds(rest[:1])
        if any(k in ("namespace", "namespaces", "ns", "node", "nodes", "no") for k in kinds):
            v.add(DENY, "kubectl patch %s %s" % (rest[0] if rest else "", loc))
            return
    if verb == "exec" and inner:
        analyze_shell(" ".join(shlex.quote(x) for x in inner), ctx.child(target="prod" if prod else ctx.target, via="kubectl exec"), v)
    if verb in ("apply", "create") and has("--prune"):
        v.add(DENY, "kubectl %s --prune %s" % (verb, loc))
        return
    if prod:
        v.add(ASK, "kubectl %s %s %s" % (verb, " ".join(rest[:2]), loc))


def helm_cmd(args, ctx, v):
    pos = [a for a in args if not a.startswith("-")]
    if not pos:
        return
    sub = pos[0]
    if sub in ("uninstall", "delete", "del", "un", "rollback"):
        v.add(DENY, "helm %s %s" % (sub, ctx.where()))
    elif sub in ("install", "upgrade") and ctx.target != "nonprod":
        v.add(ASK, "helm %s %s" % (sub, ctx.where()))


def argocd_cmd(args, ctx, v):
    pos = [a for a in args if not a.startswith("-")]
    if len(pos) < 2:
        return
    noun, verb = pos[0], pos[1]
    if verb in ("delete", "rm", "remove", "delete-resource", "terminate-op") and noun in (
            "app", "apps", "application", "appset", "applicationset", "proj", "project", "cluster", "repo", "account"):
        v.add(DENY, "argocd %s %s" % (noun, verb))
    elif verb in ("sync", "set", "patch", "rollback", "create", "edit", "unset", "patch-resource",
                  "actions", "add", "update-password", "generate-token"):
        v.add(ASK, "argocd %s %s" % (noun, verb))


def sql_client(prog, args, ctx, v, stdin_text, stdin_known):
    host, db, sqls, files = None, None, [], []
    pos = []
    i = 0
    is_pg = prog == "psql"
    while i < len(args):
        a = args[i]
        nxt = args[i + 1] if i + 1 < len(args) else None

        def take():
            return nxt
        if a in ("-h", "--host") and nxt is not None:
            host = nxt; i += 2; continue
        if a.startswith("--host="):
            host = a.split("=", 1)[1]; i += 1; continue
        if not is_pg and a.startswith("-h") and len(a) > 2:
            host = a[2:]; i += 1; continue
        if (a in ("-D", "--database") and not is_pg or a in ("-d", "--dbname") and is_pg) and nxt is not None:
            db = nxt; i += 2; continue
        if a.startswith("--database=") or a.startswith("--dbname="):
            db = a.split("=", 1)[1]; i += 1; continue
        if (a in ("-e", "--execute") and not is_pg or a in ("-c", "--command") and is_pg) and nxt is not None:
            sqls.append(nxt); i += 2; continue
        if a.startswith("--execute=") or a.startswith("--command="):
            sqls.append(a.split("=", 1)[1]); i += 1; continue
        if not is_pg and a.startswith("-e") and len(a) > 2:
            sqls.append(a[2:]); i += 1; continue
        if is_pg and a in ("-f", "--file") and nxt is not None:
            files.append(nxt); i += 2; continue
        if a in ("-u", "--user", "-p", "-P", "--port", "-U", "-S", "--socket") and nxt is not None and not (a == "-p" and not is_pg):
            i += 2; continue
        if a.startswith("-"):
            i += 1; continue
        pos.append(a)
        i += 1
    if pos:
        if is_pg and re.match(r"^postgres(ql)?://", pos[0]):
            m = re.match(r"^postgres(?:ql)?://(?:[^@/]*@)?([^/:?]+)(?::\d+)?/?([^?]*)", pos[0])
            if m:
                host = host or m.group(1)
                db = db or m.group(2)
        else:
            db = db or pos[0]
    for f in files:
        content = read_file(f, ctx.cwd) if ctx.target == "local" else None
        if content is not None:
            sqls.append(content)
        else:
            sqls.append(None)
    if stdin_text is not None:
        sqls.append(stdin_text)
    elif not stdin_known:
        sqls.append(None)

    dbl = (db or "").lower()
    if dbl in STAGING_DB_NAMES:
        is_prod = False
    elif dbl in PROD_DB_NAMES:
        is_prod = True
    elif host and PROD_DB_HOST_RE.search(host):
        is_prod = True
    elif ctx.target == "prod":
        is_prod = True
    else:
        is_prod = False
    if not is_prod:
        return
    label = "%s %s db=%s%s" % (prog, ctx.where(), db or "?", " host=" + host if host else "")
    if not sqls:
        v.add(ASK, "interactive %s session against PROD" % label)
        return
    for s in sqls:
        if s is None:
            v.add(ASK, "%s with SQL prod-guard cannot see" % label)
            continue
        level, kw = classify_sql(s)
        if level:
            v.add(level, "%s statement against PROD (%s)" % (kw, label))


def git_cmd(args, ctx, v):
    i, gitdir = 0, ctx.cwd
    while i < len(args) and args[i].startswith("-"):
        if args[i] == "-C" and i + 1 < len(args):
            gitdir = args[i + 1]
            if not os.path.isabs(gitdir) and ctx.cwd:
                gitdir = os.path.join(ctx.cwd, gitdir)
            i += 2
        elif args[i] in ("-c", "--git-dir", "--work-tree", "--namespace") and i + 1 < len(args):
            i += 2
        else:
            i += 1
    if i >= len(args) or args[i] != "push":
        return
    pargs = args[i + 1:]
    force = any(a in ("-f", "--force", "--force-if-includes") or a.startswith("--force-with-lease") for a in pargs)
    delete = any(a in ("-d", "--delete", "--prune") for a in pargs)
    mirror = any(a in ("--mirror", "--all") for a in pargs)
    pos = [a for a in pargs if not a.startswith("-")]
    refspecs = pos[1:]
    if mirror:
        v.add(DENY if (force or "--mirror" in pargs) else ASK, "git push %s pushes every branch including main" % " ".join(pargs))
        return
    dsts = []
    if not refspecs:
        cur = None
        if ctx.target == "local":
            try:
                cur = subprocess.run(["git", "-C", gitdir or ".", "rev-parse", "--abbrev-ref", "HEAD"],
                                     capture_output=True, text=True, timeout=3).stdout.strip()
            except Exception:
                cur = None
        dsts.append(("", cur or "?"))
    for r in refspecs:
        plus = r.startswith("+")
        r2 = r.lstrip("+")
        if ":" in r2:
            src, dst = r2.split(":", 1)
        else:
            src, dst = r2, r2
        if src == "HEAD" and ":" not in r2 and ctx.target == "local":
            try:
                dst = subprocess.run(["git", "-C", gitdir or ".", "rev-parse", "--abbrev-ref", "HEAD"],
                                     capture_output=True, text=True, timeout=3).stdout.strip() or dst
            except Exception:
                pass
        dsts.append(("+" if plus else ("del" if src == "" else ""), dst))
    for mode, dst in dsts:
        name = re.sub(r"^refs/heads/", "", dst)
        if name in ("main", "master", "live", "production", "?"):
            if force or delete or mode in ("+", "del"):
                v.add(DENY, "git push %s rewrites or deletes %s" % (" ".join(pargs), name))
            elif name != "?":
                v.add(ASK, "git push to %s (SERP main auto-deploys to prod)" % name)
            else:
                v.add(ASK, "git push with an undeterminable target branch")


def gh_cmd(args, ctx, v):
    pos = [a for a in args if not a.startswith("-")]
    if len(pos) < 2:
        if pos[:1] == ["api"]:
            pass
        else:
            return
    noun = pos[0]
    verb = pos[1] if len(pos) > 1 else ""
    if noun == "pr" and verb == "merge":
        base, url = pr_base(args[2:], ctx)
        if base is None:
            v.add(ASK, "gh pr merge %s (could not look up its base branch)" % " ".join(args[2:]))
        elif base in ("main", "master") and re.search(r"/(SERP|sugarwish-infrastructure)/", url or "", re.I):
            v.add(ASK, "gh pr merge into %s of %s (a SERP main merge deploys prod)" % (base, url))
    elif noun == "repo" and verb in ("delete", "archive", "rename"):
        v.add(DENY, "gh repo %s" % verb)
    elif noun == "release" and verb in ("delete", "delete-asset"):
        v.add(DENY, "gh release %s" % verb)
    elif noun == "api":
        method = "GET"
        for k, a in enumerate(args):
            if a in ("-X", "--method") and k + 1 < len(args):
                method = args[k + 1].upper()
            elif a.startswith("--method="):
                method = a.split("=", 1)[1].upper()
            elif a.startswith("-X") and len(a) > 2:
                method = a[2:].upper()
            elif a in ("-f", "-F", "--field", "--raw-field", "--input") and method == "GET":
                method = "POST"
        endpoint = next((a for a in pos[1:] if "/" in a), "")
        guarded = re.search(r"(^|/)(git/refs|branches|merges|pulls/[^/]+/merge|actions|hooks|collaborators|keys|releases)(/|$)", endpoint)
        if method == "DELETE" and (guarded or re.fullmatch(r"/?repos/[^/]+/[^/]+/?", endpoint)):
            v.add(DENY, "gh api DELETE %s" % endpoint)
        elif method != "GET" and (guarded or method == "DELETE"):
            v.add(ASK, "gh api %s %s" % (method, endpoint))


def pr_base(margs, ctx):
    """(baseRefName, url) of the PR a `gh pr merge` targets, via `gh pr view`; (None, None) on failure."""
    sel, repo, k = None, None, 0
    while k < len(margs):
        a = margs[k]
        if a in ("-R", "--repo") and k + 1 < len(margs):
            repo = margs[k + 1]
            k += 2
            continue
        if a.startswith("--repo="):
            repo = a.split("=", 1)[1]
        elif not a.startswith("-") and sel is None:
            sel = a
        elif a in ("-t", "--subject", "-b", "--body", "-F", "--body-file", "--match-head-commit", "-A", "--author-email"):
            k += 2
            continue
        k += 1
    if sel and "$" in sel or repo and "$" in repo:
        return None, None
    cmd = ["gh", "pr", "view"] + ([sel] if sel else []) + (["--repo", repo] if repo else []) + ["--json", "baseRefName,url"]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=10, cwd=ctx.cwd if ctx.cwd and os.path.isdir(ctx.cwd) else None)
        d = json.loads(p.stdout)
        return d.get("baseRefName"), d.get("url")
    except Exception:
        return None, None


AWS_DENY_RE = re.compile(r"^(delete|terminate|remove|deregister|batch-delete|purge|revoke|detach|disable|reboot|stop|cancel|deactivate|schedule-key-deletion)-")
AWS_ASK_RE = re.compile(r"^(put|create|update|modify|attach|run|start|tag|untag|reset|restore|replace|set|associate|import|register|enable|copy|invoke|publish|send|authorize|change|apply|rotate)-")


def aws_cmd(args, ctx, v):
    pos = [a for a in args if not a.startswith("-")]
    if len(pos) < 2:
        return
    svc, act = pos[0], pos[1]
    if svc == "s3":
        if act in ("rm", "rb", "mv") or (act == "sync" and "--delete" in args):
            v.add(DENY, "aws s3 %s" % act)
        elif act in ("cp", "sync"):
            v.add(ASK, "aws s3 %s" % act)
        return
    if AWS_DENY_RE.match(act):
        v.add(DENY, "aws %s %s" % (svc, act))
    elif AWS_ASK_RE.match(act):
        v.add(ASK, "aws %s %s" % (svc, act))


def http_cmd(prog, args, ctx, v):
    method = None
    urls = []
    for k, a in enumerate(args):
        if a in ("-X", "--request") and k + 1 < len(args):
            method = args[k + 1].upper()
        elif a.startswith("-X") and len(a) > 2:
            method = a[2:].upper()
        elif a.startswith("--request="):
            method = a.split("=", 1)[1].upper()
        elif a in ("-d", "--data", "--data-raw", "--data-binary", "--json", "-F", "--form", "--post-data") and method is None:
            method = "POST"
        elif re.match(r"^https?://", a):
            urls.append(a)
        elif prog in ("http", "https") and a.upper() in ("DELETE", "PUT", "PATCH", "POST"):
            method = a.upper()
    method = method or "GET"
    if method in ("GET", "HEAD", "OPTIONS"):
        return
    for u in urls:
        m = re.match(r"^https?://([^/:?]+)(?::(\d+))?", u)
        if not m:
            continue
        host, port = m.group(1).lower(), m.group(2)
        if host in PROD_HOSTS and (port == "6443" or host == "deploy.sugarwish.com"):
            v.add(DENY if method == "DELETE" else ASK, "%s %s to the cluster/ArgoCD API %s" % (prog, method, u))
        elif host in PROD_HOSTS or host == "serp.sugarwish.com":
            v.add(ASK, "%s %s to PROD %s" % (prog, method, u))
    if ctx.target == "prod" and any(re.match(r"^https?://(localhost|127\.0\.0\.1)(:6443|:8080)?", u) for u in urls):
        v.add(ASK, "%s %s to a local API %s" % (prog, method, ctx.where()))


CRITICAL_PATH_RE = re.compile(
    r"^(/|/\*|~|~/|\$HOME/?|/opt/?|/opt/SERP[^/]*/?|/opt/sugarwish-infrastructure/?|/etc/?|/etc/rancher.*|/var/?|/var/lib/?|/var/lib/rancher.*|/var/lib/containerd.*|/var/lib/mysql.*|/home/?|/home/[^/]+/?|/root/?|/usr.*|/boot.*|\.|\.\.|\*)$")


def rm_cmd(args, ctx, v):
    if ctx.target == "local":
        return
    recursive = any(re.match(r"^-[a-zA-Z]*[rR]", a) or a == "--recursive" for a in args)
    paths = [a for a in args if not a.startswith("-")]
    if recursive:
        crit = [p for p in paths if CRITICAL_PATH_RE.match(p.rstrip("/") + ("/" if p.endswith("/") else "")) or CRITICAL_PATH_RE.match(p)]
        if crit:
            v.add(DENY, "rm -r %s %s" % (" ".join(crit), ctx.where()))
        elif ctx.target == "prod":
            v.add(ASK, "rm -r %s %s" % (" ".join(paths), ctx.where()))


def systemctl_cmd(prog, args, ctx, v):
    if ctx.target == "local":
        return
    pos = [a for a in args if not a.startswith("-")]
    if prog == "service" and len(pos) >= 2:
        unit, act = pos[0], pos[1]
    elif len(pos) >= 1:
        act, unit = pos[0], " ".join(pos[1:])
    else:
        return
    if act in ("poweroff", "reboot", "halt", "kexec", "emergency", "rescue", "isolate"):
        v.add(DENY, "systemctl %s %s" % (act, ctx.where()))
    elif act in ("stop", "disable", "mask", "kill") and re.search(r"k3s|containerd|mysql|mariadb|nginx|docker|kubelet|sshd", unit):
        v.add(DENY, "%s %s %s %s" % (prog, act, unit, ctx.where()))
    elif act in ("restart", "reload", "stop", "disable", "mask", "kill") and ctx.target == "prod":
        v.add(ASK, "%s %s %s %s" % (prog, act, unit, ctx.where()))


def interp_cmd(prog, args, ctx, v, stdin_text):
    code, inline = None, True
    for k, a in enumerate(args):
        if a in ("-c", "-e", "--eval", "-E") and k + 1 < len(args):
            code = args[k + 1]
            break
    if code is None and ctx.target == "local":
        script = next((a for a in args if not a.startswith("-")), None)
        if script and script != "-":
            code, inline = read_file(script, ctx.cwd), False
        elif stdin_text is not None:
            code = stdin_text
    if code:
        code_scan(code, ctx, v, inline)


def code_scan(code, ctx, v, inline=True):
    """Scan interpreter source (Python/JS/...) for embedded prod-destructive commands.

    Code can't be told apart from data (a script that edits a doc mentioning
    `kubectl delete ns` looks the same as one that runs it), so findings here are capped
    at ask, never deny. The SQL-near-prod heuristic only applies to inline code (-c,
    heredoc, run_python): script files such as test fixtures and seeders are too noisy.
    """
    sub = Verdict()
    _code_scan(code, ctx, sub, inline)
    for lvl, reason in sub.reasons:
        v.add(min(lvl, ASK), "%s (inside %s code)" % (reason, "inline" if inline else "script-file"))


def _code_scan(code, ctx, v, inline):
    raw_scan(code, ctx, v)
    if inline and (PROD_INDICATOR_RE.search(code) or ctx.target == "prod"):
        if re.search(r"\b(DROP|TRUNCATE|ALTER)\s+(TABLE|DATABASE|SCHEMA)\b|\bDELETE\s+FROM\b", code, re.I):
            v.add(ASK, "%s code with destructive SQL near a prod target" % ctx.where())
        elif re.search(r"\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|REPLACE\s+INTO)\b", code, re.I):
            v.add(ASK, "%s code with SQL writes near a prod target" % ctx.where())
    for m in re.finditer(r"""["'`]((?:ssh|kubectl|helm|mysql|psql|git|gh|aws)\b[^"'`]{0,400})["'`]""", code):
        analyze_shell(m.group(1), ctx.child(), v)


RAW_PATTERNS = [
    (re.compile(r"\bkubectl\b[^;&|]*?\bdelete\b[^;&|]*?(?<![-\w=/])(ns|namespaces?)(?![-\w])"), "kubectl delete namespace"),
    (re.compile(r"\bkubectl\b[^;&|]*?\b(drain|cordon)\b"), "kubectl drain/cordon"),
    (re.compile(r"\bkubectl\b[^;&|]*?\bdelete\b[^;&|]*?(--all\b|-a\b|--all-namespaces\b)"), "kubectl delete --all"),
    (re.compile(r"\bhelm\s+(uninstall|delete|del|un)\b"), "helm uninstall"),
    (re.compile(r"\bk3s-(agent-)?(uninstall|killall)\.sh\b"), "k3s uninstall/killall"),
    (re.compile(r"\bargocd\s+(app|apps|application|appset|proj|cluster)\s+(delete|rm)\b"), "argocd delete"),
    (re.compile(r"\b(mysql|mariadb|psql|mysqlsh)\b[^;&|]*\bserp_app\b[^;&|]*\b(drop\s+(table|database|schema)|truncate\b|delete\s+from)"), "destructive SQL against serp_app"),
]


def raw_scan(text, ctx, v):
    norm = re.sub(r"[\"'\\`]", " ", text)
    norm = re.sub(r"\s+", " ", norm).lower()
    for pat, label in RAW_PATTERNS:
        if pat.search(norm):
            v.add(DENY, "%s (pattern match) %s" % (label, ctx.where() if ctx.target != "local" else ""))


# --------------------------------------------------------------------------- MCP tools

def mcp_db(tool_input, cwd, v):
    sql = tool_input.get("query")
    if sql is None and tool_input.get("path"):
        sql = read_file(tool_input["path"], cwd)
        if sql is None:
            v.add(ASK, "prod-guard cannot read SQL file %s" % tool_input["path"])
            return
    level, kw = classify_sql(sql or "")
    if level:
        v.add(DENY, "mcp__db__ is read-only: %s statement refused on %s (comments/WITH/multi-statement included)"
              % (kw, tool_input.get("database", "?")))


def mcp_tool(name, tool_input, cwd, v):
    if name in ("mcp__db__query_database", "mcp__db__query_database_from_file"):
        mcp_db(tool_input, cwd, v)
    elif re.match(r"^mcp__serp-orm__serp_sql$", name):
        level, kw = classify_sql(tool_input.get("query") or tool_input.get("sql") or "")
        if level:
            v.add(ASK, "serp_sql %s statement (target DB comes from the backend .env)" % kw)
    elif re.match(r"^mcp__serp-orm__serp_unlink$", name):
        v.add(ASK, "serp_unlink deletes records (target DB comes from the backend .env)")
    elif name == "mcp__serp-api__api_call":
        method = (tool_input.get("method") or "GET").upper()
        endpoint = tool_input.get("endpoint") or ""
        base = tool_input.get("base_url") or ""
        url = endpoint if re.match(r"^https?://", endpoint) else base
        if method != "GET" and url and not re.match(r"^https?://(localhost|127\.0\.0\.1|\[::1\])([:/]|$)", url):
            v.add(ASK, "serp-api %s %s on %s" % (method, endpoint, url))
    elif re.match(r"^mcp__serpy(-dev)?__serpy_(approve|reject)$", name):
        base = tool_input.get("base_url") or ""
        if name.startswith("mcp__serpy__") or re.search(r"serp\.sugarwish\.com", base):
            v.add(ASK, "%s changes a PROD Serpy draft" % name.split("__")[-1])
    elif name == "mcp__python__run_python":
        code_scan(tool_input.get("code") or "", Ctx("local", cwd), v)


# --------------------------------------------------------------------------- main

def decide(payload):
    v = Verdict()
    name = payload.get("tool_name") or ""
    ti = payload.get("tool_input") or {}
    cwd = payload.get("cwd") or os.getcwd()
    if name == "Bash":
        analyze_shell(ti.get("command") or "", Ctx("local", cwd), v)
    elif name.startswith("mcp__"):
        mcp_tool(name, ti, cwd, v)
    return v


def emit(level, reasons):
    seen, uniq = set(), []
    for lvl, r in sorted(reasons, key=lambda x: -x[0]):
        if r not in seen and lvl == level:
            seen.add(r)
            uniq.append(r)
    msg = "; ".join(uniq[:4])
    if level == DENY:
        reason = ("prod-guard BLOCKED: %s. This is a destructive production action and cannot be run "
                  "from Claude. If Jack really wants it, he runs it himself in a terminal. Do not "
                  "retry it in another form." % msg)
    else:
        reason = "prod-guard: production change, needs Jack's confirmation: %s." % msg
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                             "permissionDecision": LEVEL_NAME[level],
                                             "permissionDecisionReason": reason}}))


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except ValueError:
        return 0
    try:
        v = decide(payload)
    except Exception as exc:  # degrade to ask, only where something risky is mentioned
        text = json.dumps(payload.get("tool_input") or {})
        if PROD_INDICATOR_RE.search(text) or RISKY_TOKEN_RE.search(text):
            emit(ASK, [(ASK, "prod-guard hit an internal error (%s) on a command touching prod/infra tooling" % type(exc).__name__)])
        return 0
    if v.level > ALLOW:
        emit(v.level, v.reasons)
    return 0


if __name__ == "__main__":
    sys.exit(main())
