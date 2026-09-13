---
id: BL-0133
type: bug
area: templates
title: "merge-queue.sh calls verify.sh with no PORT override, so a stale dev server on the shared reserved port produces a misleading wide failure spray"
status: open
severity: p1
opened: 2026-09-13
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-12 (agent-inferred) — merge-queue.sh calls `bash .pandacorp/verify.sh` with no PORT override, so when the shared MAIN checkout already has a dev server bound to the reserved port (very likely with many parallel worktree sessions active), Playwright's reuseExistingServer:true silently reuses THAT server instead of building the worktree's own branch, producing a wide, misleading spray of unrelated e2e/visual failures across routes the change never touched. Exporting PORT=<free-port> before calling merge-queue.sh collapsed the SAME merge attempt from 27 failures to exactly the 2 routes actually affected."
closes:
links: [LESSON-0040]
---

## Problem
`plugin/templates/shared/.pandacorp/merge-queue.sh` invokes `bash .pandacorp/verify.sh` without
exporting a `PORT` override. When the shared main checkout already has its own dev server bound to the
project's reserved `dev_port_base` (common with parallel worktree sessions active), Playwright's
`reuseExistingServer: true` silently reuses that unrelated server instead of building and serving the
worktree's own branch under test — producing a wide, misleading spray of e2e/visual failures across
routes the landing change never touched, indistinguishable at a glance from a real regression. Measured
on personal-page-v2 2026-09-12: the same merge attempt went from 27 reported failures to exactly the 2
routes genuinely affected once `PORT=<free-port>` was exported manually before calling `merge-queue.sh`.
This is the same underlying mechanism `LESSON-0040`'s family already tracks (shared dev-server port
collision looks like a regression), newly located inside the shared `merge-queue.sh` template itself.

## Root cause
`merge-queue.sh` has no logic to detect an already-bound dev server on the project's reserved port, nor
does it pick/export a free `PORT` before delegating to `verify.sh` — it silently inherits whatever port
`verify.sh`'s Playwright config defaults to, which collides with any other dev server already running on
the shared main checkout.

## Fix plan
In `plugin/templates/shared/.pandacorp/merge-queue.sh`, before calling `verify.sh`: check whether the
project's reserved `dev_port_base` (from `status.yaml`/`ports.yaml`) is already bound (e.g. `lsof -i`); if
so, pick a free port and `export PORT=<free-port>` for the `verify.sh` invocation, so the gate always
builds/serves the worktree's own branch rather than silently reusing an unrelated server.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: bind a dummy listener on the project's reserved port, then run `merge-queue.sh` against a branch
with an unrelated real content change. RED (current script): `verify.sh` reuses the dummy/foreign server
and reports failures unrelated to the change (or passes falsely if the dummy is inert). GREEN (fixed):
`merge-queue.sh` detects the collision, exports a free `PORT`, and `verify.sh` correctly builds/serves the
worktree's own branch.

## Done when
`merge-queue.sh` always exports a free `PORT` when the reserved port is already bound; the new test
passes; the overlay's `OVERLAY_VERSION` is bumped so existing projects pick up the fix via
`/pandacorp:upgrade`; `plugin/runtime/plugin-metadata.json` bumped PATCH and manifests regenerated.

## Out of scope
Any other `merge-queue.sh` false-positive class already tracked separately (e.g. the untracked-file exit-12
false positive noted in `LESSON-0158`'s history).
