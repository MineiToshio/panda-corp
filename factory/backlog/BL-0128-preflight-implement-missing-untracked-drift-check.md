---
id: BL-0128
type: bug
area: build-engine
title: "preflight-implement.sh never checks for untracked/dirty drift outside status.yaml before taking the build lease"
status: open
severity: p2
opened: 2026-09-13
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-11/2026-09-12 (agent-inferred) — two related findings: (1) the mandatory close-preloop shutdown step (DR-068) fails closed on ANY untracked/dirty drift beyond .pandacorp/status.yaml, but preflight never runs the equivalent check before the lease is taken, so a build can burn agents mid-run only to crash uncatchably at its very first pre-loop check; (2) reproduced concretely: a stray scratchpad/ folder created at the project's repo root by an earlier session (outside the OS-level per-session scratch dir) sat there untracked for days, invisible to normal git status / owner attention, then silently blocked a later /pandacorp:implement launch."
closes:
links: [LESSON-0235]
---

## Problem
`preflight-implement.sh` takes the build lease and lets a full run start even when the working tree
already carries untracked/dirty drift outside `.pandacorp/status.yaml`/`.pandacorp/run/` — the exact
condition the engine's mandatory `close-preloop` shutdown step (DR-068) fails closed on at the very
first pre-loop check. Concretely reproduced on personal-page-v2: an old, forgotten `scratchpad/` folder
sat untracked at the project's repo root (created by an earlier session outside the correct per-session
scratch path) for days — invisible to a routine `git status` glance and to the owner — until a later
`/pandacorp:implement` launch burned real agent time mid-run before crashing uncatchably with "FATAL:
bounded pre-loop close returned an invalid receipt", leaving a stuck lease/`running: true` that needed a
manual `release`. Impact: wasted agent budget, a stuck lease requiring manual intervention, and a
confusing failure mode far from its root cause.

## Root cause
The two checks are asymmetric: `close-preloop`'s `assertOnlyStatus` enforces "nothing dirty/untracked
besides `.pandacorp/status.yaml`/`.pandacorp/run/`" as a hard gate at shutdown, but `preflight-implement.sh`
never runs the equivalent assertion before granting the lease — so drift that will fail at the end is only
discovered after a full (possibly expensive) run.

## Fix plan
Add a preflight check equivalent to `close-preloop`'s `assertOnlyStatus`: run `git status --porcelain`
and forbid anything besides `.pandacorp/status.yaml`/`.pandacorp/run/` before the lease is granted, failing
fast with an actionable message (naming the offending path(s)) instead of letting the run start and crash
later at close-preloop.

## Tests (prove the fix — TDD, RED → GREEN)
Create an untracked file/dir outside the allowed paths in a fixture project checkout; assert
`preflight-implement.sh` exits non-zero with a message naming that path, BEFORE any lease is taken (RED
without the fix — preflight proceeds; GREEN with the fix — preflight refuses fast).

## Done when
`preflight-implement.sh` fails fast (no lease taken, no agents dispatched) on any untracked/dirty drift
outside the allowed paths, with a message that names the offending path(s); the new check has a passing
test; `plugin/runtime/plugin-metadata.json` bumped PATCH (or MINOR if judged a new capability) and
manifests regenerated.

## Out of scope
Changing `close-preloop`'s own `assertOnlyStatus` logic (it already works correctly — this item only
brings the check earlier, to preflight).
