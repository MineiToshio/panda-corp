---
id: BL-0297
type: bug
area: templates
title: "worktree-bootstrap rewrites the e2e PORT but leaves same-origin URLs on the old port"
status: open
severity: p2
opened: 2026-10-31
closed:
source: "funko-tracker e2e measurement 2026-10-31 (agent-inferred)"
closes:
links: [BL-0154]
---

## Problem
Step 2b of `plugin/templates/shared/.pandacorp/worktree-bootstrap.sh` sets only `PORT` in
`e2e/server-env.json`. In a funko-tracker worktree, `BETTER_AUTH_URL` and `ORACLE_MEDIA_BASE_URL` kept
the committed origin, and 12 e2e tests failed (contact and password recovery).

## Root cause
The step treats the port as one value, but the file repeats the origin in other keys.

## Fix plan
Rewrite every value in that file that carries the committed loopback origin to the derived port.

## Tests
Extend `plugin/scripts/test-worktree-bootstrap.sh` with a fixture holding origin URLs. It fails before the fix.

## Done when
After bootstrap, no value in the file carries the committed port, and main stays untouched.

## Out of scope
Per-worktree databases.
