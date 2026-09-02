#!/usr/bin/env npx tsx
/**
 * Claim a mesh name for a freshly-launched pane, recording its parent.
 *
 * Called by `launch-repo-session.sh` immediately after Herdr returns the new
 * pane id, so a launched session is named AND parented before it boots — the
 * family tree is correct from the first listing instead of being backfilled.
 *
 * Usage: claim-session-name <pane-id> [parent-name]
 *
 * Best-effort by design: any failure exits 0 silently. Naming is a convenience
 * and must never be able to break a launch.
 */
import { claimName } from '../src/services/sessions.js';

const [paneId, parent] = process.argv.slice(2);

if (!paneId) process.exit(0);

claimName(paneId, parent || undefined)
  .then((name) => process.stdout.write(name))
  .catch(() => {
    /* never fail a launch over a name */
  });
