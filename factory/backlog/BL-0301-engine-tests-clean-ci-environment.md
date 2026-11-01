---
id: BL-0301
type: bug
area: build-engine
title: "Factory engine corpus fails 10 suites on clean Ubuntu"
status: doing
severity: p1
opened: 2026-10-31
source: "Owner-supplied factory-engine-tests GitHub Actions log, 41 passed / 10 failed"
---

## Problem

The CI job runs the full corpus without zsh, Codex, Acorn, Playwright or Chromium.
Several fixtures also assume a configured Git author or a working host sleep service;
the Manual oracle references a file deleted by `519570d1`. Installing Codex alone
exposes another assumption: `doctor` requires credentials and provider reachability.

## Repair

See `plugin/docs/engine-tests.md` and plugin decision log v9.148.1. The branch `fix/engine-tests-ci` contains the repair. Test assertions remain strict,
including real parser/browser oracles and revocation exit/call/state checks.

## Done when

Run the unchanged complete corpus on Ubuntu/Node 24 with the declared dependencies.
Local sandbox limitations (process inspection, local sockets and protected `.codex`
writes) must remain visible; they cannot justify skipping or weakening tests.
Linux behaviour remains to be proven by CI.

## Local evidence (2026-10-31)

The local clean-environment run passed all 51/51 suites with Codex 0.144.1. Linux
behaviour remains to be proven by CI.

- 2026-10-31: Second Ubuntu run passed 50/51 suites; the remaining Codex executor failure exposed a real heartbeat/status lost-update race. A deterministic prepared-rename/worker-write handshake reproduces exit 0 on macOS before the repair; fenced lease renewal now defers status projection until worker delta inspection completes. Ubuntu confirmation remains pending.

- 2026-10-31 review follow-up (B1/B2): retain the lost-update fix and accept the explicit trade-off that status stamps pause during a worker dispatch. The shared liveness guard now checks the lease's own TTL first and fails closed on malformed leases; upgrade/preflight/sync and Mission Control use the lease clock. Snapshot drains race stop under the renewal-stall deadline with a referenced keepalive, so the drain is bounded and reports a terminal reason. Regression coverage includes fresh/stale lease with stale stamps, resumed projection after delta inspection, a worker stamping the exact current lease timestamp, and a renewal stalled during snapshot drain. No commit requested; Ubuntu confirmation remains pending.

### Review repair verification

Allowed local suites: Codex executor 59/59, build-state 33/33, worktree-sweep 41/41,
engine lease lifecycle 8/8, lease liveness 5/5, preflight version-skew 21/21,
and touched Mission Control selection 339 tests in 26 files, all exit 0.
Preflight drift, derived drift and `git diff --check` also exit 0.
The worktree fixture now removes its empty lease directory after deleting its lease file,
matching a complete release; assertions are unchanged. Mutation controls each exit 1:
never clear the projection flag, allow worker controller-only deltas, and restore the unbounded
drain (the last reproduces executor exit 13). No executed suite reported a socket/ps denial;
this evidence does not certify unrestricted host access or Ubuntu CI. No commit made.
