#!/usr/bin/env bash
#
# rotate-swirl-token.sh — rotate the SWIRL_GITHUB_TOKEN everywhere it lives.
#
# What it does, in order:
#   1. Prompts for the NEW token (hidden input — never echoed, never in shell history).
#   2. Sanity-checks it against GitHub (read access to jasonbkiefer/SWIRL) before changing anything.
#   3. Backs up, then updates the value in ~/.zshrc  (the token /ww uses).
#   4. Optionally updates SWAC/.env too (it currently holds a DIFFERENT token — you choose).
#   5. Scrubs the OLD plaintext value out of all ~/.claude history/transcript/cache files.
#
# It NEVER prints any token value. Run it from a terminal:  bash scripts/rotate-swirl-token.sh
#
# IMPORTANT: revoke the old PAT on GitHub first (Settings → Developer settings → PATs),
# then generate the new one. After this script finishes, RESTART your Claude session so it
# picks up the new env value (a running session keeps the old one).

set -euo pipefail

ZSHRC="$HOME/.zshrc"
SWAC_ENV="$HOME/Desktop/Projects/SWAC/.env"
CLAUDE_DIR="$HOME/.claude"
STAMP="$(date +%Y%m%d-%H%M%S)"

c_red()  { printf '\033[31m%s\033[0m\n' "$*"; }
c_grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
c_ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }
c_dim()  { printf '\033[2m%s\033[0m\n'  "$*"; }

# ---- capture the OLD value from ~/.zshrc (for scrubbing) without printing it -------------
old_zsh_token=""
if [ -f "$ZSHRC" ]; then
  old_zsh_token=$(grep -E '^[^#]*SWIRL_GITHUB_TOKEN' "$ZSHRC" | head -1 \
    | sed -E 's/.*SWIRL_GITHUB_TOKEN=//; s/^["'"'"']//; s/["'"'"'].*$//; s/[[:space:]]*$//' || true)
fi

# ---- prompt for the NEW token (hidden) --------------------------------------------------
echo
c_ylw "Rotate SWIRL_GITHUB_TOKEN"
c_dim  "Paste the NEW GitHub PAT (input hidden, not echoed, not stored in shell history)."
printf "New token: "
read -rs new_token
echo
if [ -z "${new_token:-}" ]; then
  c_red "No token entered — aborting. Nothing changed."
  exit 1
fi

# ---- verify the new token works BEFORE touching any file --------------------------------
c_dim "Verifying the new token against jasonbkiefer/SWIRL (read-only)…"
http_code=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${new_token}" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/jasonbkiefer/SWIRL || echo "000")

if [ "$http_code" != "200" ]; then
  c_red "GitHub returned HTTP $http_code for the new token — it cannot read jasonbkiefer/SWIRL."
  c_red "Nothing was changed. Check the token's scope (needs repo read) and try again."
  unset new_token
  exit 1
fi
c_grn "✓ New token verified (HTTP 200 on jasonbkiefer/SWIRL)."

# ---- helper: replace the token in a key=value file, with backup -------------------------
update_file() {
  local file="$1" label="$2"
  if [ ! -f "$file" ]; then
    c_ylw "• $label not found ($file) — skipping."
    return
  fi
  if ! grep -qE '^[^#]*SWIRL_GITHUB_TOKEN' "$file"; then
    c_ylw "• $label has no SWIRL_GITHUB_TOKEN line — skipping."
    return
  fi
  cp -p "$file" "${file}.bak-${STAMP}"
  # rewrite the (first, non-comment) export/assignment line, preserving the export prefix if present
  TOKEN_VALUE="$new_token" perl -i -pe '
    if (!$done && /^([^#]*?)SWIRL_GITHUB_TOKEN=.*/) {
      $_ = "${1}SWIRL_GITHUB_TOKEN=\"$ENV{TOKEN_VALUE}\"\n";
      $done = 1;
    }
  ' "$file"
  c_grn "✓ Updated $label  (backup: ${file}.bak-${STAMP})"
}

# ---- 1) ~/.zshrc — always update (this is the token /ww uses) ---------------------------
update_file "$ZSHRC" "~/.zshrc"

# ---- 2) SWAC/.env — different token today; ask before overwriting ----------------------
if [ -f "$SWAC_ENV" ] && grep -qE '^[^#]*SWIRL_GITHUB_TOKEN' "$SWAC_ENV"; then
  echo
  c_ylw "SWAC/.env currently holds a DIFFERENT SWIRL_GITHUB_TOKEN than ~/.zshrc."
  printf "Also overwrite SWAC/.env with the new token? [y/N]: "
  read -r ans
  case "${ans:-N}" in
    [yY]*) update_file "$SWAC_ENV" "SWAC/.env" ;;
    *)     c_dim "• Left SWAC/.env unchanged." ;;
  esac
fi

# ---- 3) scrub the OLD ~/.zshrc value out of ~/.claude history/transcripts/cache ---------
if [ -n "$old_zsh_token" ] && [ "$old_zsh_token" != "$new_token" ]; then
  echo
  c_ylw "The OLD token leaked in plaintext into many ~/.claude files."
  printf "Scrub the old token out of ~/.claude history/transcript/cache files? [Y/n]: "
  read -r ans
  case "${ans:-Y}" in
    [nN]*) c_dim "• Skipped scrub. (Old token still present in ~/.claude files.)" ;;
    *)
      c_dim "Scanning ~/.claude for the old token…"
      # collect null-delimited matches into an array (portable to bash 3.2 — no mapfile)
      hits=()
      while IFS= read -r -d '' f; do
        hits+=("$f")
      done < <(grep -rlZ -F "$old_zsh_token" "$CLAUDE_DIR" 2>/dev/null || true)
      if [ "${#hits[@]}" -eq 0 ]; then
        c_grn "✓ No files contained the old token — nothing to scrub."
      else
        c_dim "Found ${#hits[@]} file(s). Replacing the value with [REDACTED-ROTATED-${STAMP}]…"
        for f in "${hits[@]}"; do
          OLD_TOK="$old_zsh_token" REPL="[REDACTED-ROTATED-${STAMP}]" \
            perl -i -pe 's/\Q$ENV{OLD_TOK}\E/$ENV{REPL}/g' "$f" 2>/dev/null \
            && printf '  scrubbed: %s\n' "${f/#$HOME/~}"
        done
        c_grn "✓ Scrubbed ${#hits[@]} file(s)."
      fi
      ;;
  esac
else
  c_dim "• No distinct old ~/.zshrc value to scrub (or it equals the new one)."
fi

# ---- done -------------------------------------------------------------------------------
unset new_token old_zsh_token
echo
c_grn "Done."
c_ylw "Next steps:"
echo  "  1. Reload your shell:   source ~/.zshrc   (or open a new terminal)"
echo  "  2. RESTART your Claude session so it picks up the new token (a running session keeps the old one)."
echo  "  3. Re-run /ww (or /start-day) to confirm tickets fetch with HTTP 200."
c_dim "  Backups of edited config files are alongside them as *.bak-${STAMP}."
