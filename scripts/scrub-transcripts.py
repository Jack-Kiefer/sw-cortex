#!/usr/bin/env python3
"""Redact secret values in Claude/Codex transcripts in place. Never prints a value.

Usage: python3 scripts/scrub-transcripts.py [--apply]
Without --apply it is a dry run that only reports counts. Takes ~10 minutes.

Redacts the current secret values from the SERP and sw-cortex .env files, plus Slack,
GitHub, Anthropic, OpenAI and Grafana tokens, private-key blocks and passwords inside
database URLs. Rewrites each file in place (same inode, mtime preserved) so an idle
session that later appends to it is unaffected. Files modified in the last 15 minutes
are skipped; re-run to catch them.

Run it from a plain terminal: Claude Code's permission classifier blocks an agent from
rewriting session transcripts unless the user asks for it explicitly.
"""
import json
import os
import re
import sys
import time

HOME = os.path.expanduser('~')
APPLY = '--apply' in sys.argv
ROOTS = [
    HOME + '/.claude/projects',
    HOME + '/.claude/file-history',
    HOME + '/.claude/paste-cache',
    HOME + '/.claude/history.jsonl',
    HOME + '/.codex/sessions',
]
ENV_FILES = [
    HOME + '/Desktop/Projects/SERP/.env',
    HOME + '/Desktop/Projects/sw-cortex/.env',
    HOME + '/.claude/telemetry.env',
]
SECRET_KEY = re.compile(r'(?i)(pass|token|secret|key|auth|headers|credential)')
NOT_SECRET_KEY = re.compile(r'(?i)(key_path|_path$|_file$|_url$|_host$|_user$|_name$|_id$|_port$)')
RED = b'[REDACTED]'
ACTIVE_WINDOW = 15 * 60

PATTERNS = [
    # private key blocks, body included (JSON-escaped newlines keep it on one line)
    (re.compile(rb'-----BEGIN ([A-Z ]*)PRIVATE KEY-----.{0,8000}?-----END \1PRIVATE KEY-----', re.S), RED),
    (re.compile(rb'-----BEGIN ([A-Z ]*)PRIVATE KEY-----(?:\\n|\\r|[A-Za-z0-9+/=\s]){40,8000}'), RED),
    # passwords inside connection URLs: keep scheme, user and host
    (
        re.compile(rb'((?:mysql|postgres(?:ql)?)(?:\+[a-z]+)?://[^:/ "\\<{$]+:)(?!\[REDACTED\])[^@ "\\<{$*]{4,}(@)'),
        rb'\1[REDACTED]\2',
    ),
    (re.compile(rb'xox[bpars]-[0-9A-Za-z-]{20,}'), RED),
    (re.compile(rb'ghp_[0-9A-Za-z]{36}'), RED),
    (re.compile(rb'github_pat_[0-9A-Za-z_]{40,}'), RED),
    (re.compile(rb'sk-ant-[0-9A-Za-z_-]{20,}'), RED),
    (re.compile(rb'sk-proj-[0-9A-Za-z_-]{40,}'), RED),
    (re.compile(rb'glc_[A-Za-z0-9+/=]{20,}'), RED),
]
PLACEHOLDER_URL = re.compile(rb'://(user(name)?|fakeuser):')
QUICK = re.compile(
    rb'PRIVATE KEY-----|xox[bpars]-|ghp_|github_pat_|sk-ant-|sk-proj-|glc_|(?:mysql|postgres)[a-z+]*://[^:/ "\\]+:'
)


def exact_values():
    vals = set()
    for p in ENV_FILES:
        try:
            lines = open(p, errors='ignore').read().splitlines()
        except OSError:
            continue
        for ln in lines:
            if '=' not in ln or ln.lstrip().startswith('#'):
                continue
            k, v = ln.split('=', 1)
            k = k.replace('export ', '').strip()
            v = v.strip().strip('"').strip("'")
            # dev-fixture values that appear in nearly every transcript; not secrets
            if k in ('PLAYWRIGHT_DEV_PASSWORD', 'S3_SECRET_ACCESS_KEY'):
                continue
            if not SECRET_KEY.search(k) or NOT_SECRET_KEY.search(k):
                continue
            if len(v) < 10 or v.startswith(('/', '~', '$', 'http')) or v.lower() in ('true', 'false'):
                continue
            vals.add(v)
            if ' ' in v:  # e.g. "Authorization=Basic <token>"
                tail = v.rsplit(' ', 1)[1]
                if len(tail) >= 16:
                    vals.add(tail)
    try:
        m = json.load(open(HOME + '/.mcp.json'))
        for s in (m.get('mcpServers') or {}).values():
            for k, v in (s.get('env') or {}).items():
                if SECRET_KEY.search(k) and isinstance(v, str) and len(v) >= 10 and not v.startswith('$'):
                    vals.add(v)
    except (OSError, ValueError):
        pass
    return sorted((v.encode() for v in vals), key=len, reverse=True)


def scrub_line(line, exact):
    out = line
    for v in exact:
        if v in out:
            out = out.replace(v, RED)
    if QUICK.search(out):
        for rx, rep in PATTERNS:
            if rep is RED:
                out = rx.sub(RED, out)
            else:
                out = rx.sub(lambda m: m.group(0) if PLACEHOLDER_URL.search(m.group(0)) else m.expand(rep), out)
    return out


def files():
    for root in ROOTS:
        if os.path.isfile(root):
            yield root
            continue
        for d, _, names in os.walk(root):
            for n in names:
                yield os.path.join(d, n)


def main():
    exact = exact_values()
    now = time.time()
    me = os.environ.get('CLAUDE_CODE_SESSION_ID', '\0')
    st = {'scanned': 0, 'changed_files': 0, 'changed_lines': 0, 'skipped_active': 0, 'bad_json_kept': 0, 'errors': 0}
    for path in files():
        try:
            s = os.stat(path)
            data = open(path, 'rb').read()
        except OSError:
            st['errors'] += 1
            continue
        st['scanned'] += 1
        if not (QUICK.search(data) or any(v in data for v in exact)):
            continue
        is_jsonl = path.endswith('.jsonl')
        lines = data.split(b'\n')
        new, n_changed = [], 0
        for ln in lines:
            out = scrub_line(ln, exact)
            if out != ln and is_jsonl and ln.strip():
                try:
                    json.loads(out)
                except ValueError:
                    st['bad_json_kept'] += 1
                    out = ln
            if out != ln:
                n_changed += 1
            new.append(out)
        if not n_changed:
            continue
        if me in path or now - s.st_mtime < ACTIVE_WINDOW:
            st['skipped_active'] += 1
            continue
        st['changed_files'] += 1
        st['changed_lines'] += n_changed
        if APPLY:
            try:
                with open(path, 'r+b') as f:
                    f.seek(0)
                    f.write(b'\n'.join(new))
                    f.truncate()
                os.utime(path, (s.st_atime, s.st_mtime))
            except OSError:
                st['errors'] += 1
    print('exact config values tracked:', len(exact))
    print('APPLIED' if APPLY else 'DRY RUN', st)


main()
