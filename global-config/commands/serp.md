# Command: serp

Open a **real SERP Claude Code session** in a new VS Code terminal tab — cd'd into the SERP repo, with all of SERP's native slash commands and project MCP servers (`mcp__serp-prod`, `mcp__serp-orm`, `mcp__python`, playwright) loaded. Use this from the sw-cortex hub when a task needs SERP's full toolset (run/test the app, the research swarm, prod-log/ORM tools) — things the hub can't do.

For lightweight, read-only SERP diagnosis you can stay in the hub and use `/analyze`. Use `/serp` when you actually need to BUILD/RUN/TEST in SERP.

## Usage

/serp [optional initial task]

- `/serp` — opens a fresh SERP session, no prompt.
- `/serp fix the forecast zeros on live-products` — opens a SERP session and passes that as its first prompt.

---

# Launch SERP session: $ARGUMENTS

Run exactly this (pass `$ARGUMENTS` as the prompt; omit if empty):

```bash
~/.claude/scripts/launch-repo-session.sh /Users/jackkief/Desktop/Projects/SERP "$ARGUMENTS"
```

Then tell Jack what happened:

- **On success** ("Opened a new VS Code terminal tab running: …"): confirm a new SERP session is starting in a new terminal tab, and that he should switch to it — that tab has SERP's full native commands + MCP tools. This hub session stays as-is.
- **On failure** (the script prints a "Could not open … Accessibility permission needed" fallback with a paste-able command): relay that command verbatim and tell Jack to (a) grant Accessibility to VS Code in System Settings → Privacy & Security → Accessibility and re-run `/serp`, or (b) just paste the printed `cd … && claude …` command into a new terminal himself. Do NOT pretend it launched.

This command does not do SERP work itself — it hands off to a real SERP session. Don't try to run SERP-only tools (`mcp__serp-prod`, etc.) from here; they don't exist in the hub.
