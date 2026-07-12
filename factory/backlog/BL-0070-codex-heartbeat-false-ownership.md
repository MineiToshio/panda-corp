---
id: BL-0070
type: bug
area: build-engine
title: "Distinguish fenced controller heartbeats from Codex worker-owned writes"
status: done
severity: p0
opened: 2026-07-12
closed: 2026-07-12
source: "installed R10-D canary ownership failure"
closes: "Codex content-provenance ownership + plugin 9.94.1"
links: [DR-113]
---

## Problem

The installed R10-D Codex continuation ran a dispatch for 126 seconds while the certified heartbeat
interval was 120 seconds. The fenced controller correctly renewed the lease and projected
`running: true` plus a new `supervisor_heartbeat` into `.pandacorp/status.yaml`, but the executor's
path-set-only before/after ownership check attributed that controller write to the worker and stopped
with `OWNERSHIP`. A healthy long dispatch therefore fails exactly when its liveness contract works.

## Root cause

`plugin/runtime/codex/executor.mjs` snapshots only dirty path names. It has no content provenance and
cannot distinguish the controller's exact fenced heartbeat projection from a worker mutation of
governed state.

## Fix plan

1. Replace path-set snapshots with before/after content snapshots.
2. Normalize only the exact fields owned by `renew` (`running` and `supervisor_heartbeat`) in
   `.pandacorp/status.yaml`, and only after proving the current lease still matches this Codex run and
   epoch through the fence.
3. Preserve fail-closed ownership for every other status change and every governed FRD/WO change.

## Tests (prove the fix — TDD, RED → GREEN)

- A dispatch longer than a forced short heartbeat interval succeeds and commits implementation files.
- A worker's concurrent non-liveness edit to `status.yaml` fails `OWNERSHIP`.
- A worker edit to WO frontmatter fails `OWNERSHIP`.
- The complete Codex executor and unattended corpora remain green.

## Done when

- The three ownership regressions pass and ordinary implementation remains committable.
- Plugin manifests are regenerated at patch version 9.94.1.
- Canonical runtime docs and the plugin decision log explain the provenance boundary.
- Backlog and derived-source validators are green.

## Out of scope

R10/R11 promotion, Claude Dynamic Workflow behavior, overlay templates, and pausing heartbeat renewal.
