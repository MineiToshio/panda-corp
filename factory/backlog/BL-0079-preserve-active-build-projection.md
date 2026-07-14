---
id: BL-0079
type: bug
area: build-engine
title: "Preserve the active build projection across baseline repair"
status: open
severity: p0
opened: 2026-07-14
closed:
source: "R10-J Stage 1 independent audit"
closes:
links: [DR-050, DR-113, LESSON-0027]
---

## Problem

R10-J Stage 1 acquired a valid Claude lease and the shared state writer projected `phase:
implementation`, `running: true`, `run_started_at`, `build_run_id`, `build_runtime` and
`build_lease_epoch` into `.pandacorp/status.yaml`. Those controller-owned fields were still an
uncommitted tracked diff when the Dynamic Workflow baseline saw a dirty tree. Its DR-067 repair prompt
allowed restoring any modified tracked file and did not exclude the active status projection. The
baseline agent restored status to the pre-launch commit; the first `sync-rollups` commit then made the
clobber durable. Later renewals restored only `running` and the heartbeat. Stage 1 ended in
`phase: architecture`, with empty/missing run identity, so Codex classified Stage 2 as a new run rather
than a cold continuation. R10-J is NO-GO even though its feature gate was 92/92 green.

## Root cause

Lease ownership is canonical in `.pandacorp/run/build.lease/lease.json`, but the active status
projection is written only once at acquire. The model-driven baseline repair is allowed to reconcile
the same tracked file before that projection is committed. `renew` and `sync-rollups` do not re-derive
all active projection fields from the fenced lease, so one nondeterministic restore permanently loses
phase and logical-run identity. Existing fixtures start in `phase: implementation` and do not simulate
the acquire → clobber → renew/sync path, masking the gap.

## Fix plan

1. Add one shared `reassertActiveProjection` transition in `plugin/runtime/build-state.mjs` that derives
   `phase: implementation`, `running: true`, `run_started_at` from `lease.acquired_at`,
   `build_run_id`, `build_runtime` and `build_lease_epoch` exclusively from the currently fenced lease.
2. Invoke it from acquire and every active fenced mutation that can precede a safe point, at minimum
   renew and sync-rollups, so a stale model/worktree copy cannot survive to a commit.
3. Tighten the Claude baseline-repair prompt: after a valid active fence, `.pandacorp/status.yaml` is
   controller-owned and must never be checked out/restored by the repair agent. Deterministic
   reassertion remains the real enforcement; prose is defense in depth.
4. Add a fail-closed pre-Stage-2/R10 evidence check requiring `phase: implementation`, evidence-matching
   `build_run_id`, `build_runtime: claude`, matching epoch, non-empty `run_started_at`, and a resolver
   verdict of cross-runtime cold continuation.
5. Correct the stale `safe_to_test` field comment to describe the verified snapshot plus its
   metadata-only pointer child; do not change the established ancestor/pointer semantics.

## Tests (prove the fix — TDD, RED → GREEN)

- Shared state test: acquire → deliberately replace status with architecture/blank identity → renew and
  sync-rollups must restore all six active projection fields from the lease; a foreign/stale fence must
  remain RED.
- Dynamic Workflow source/harness test: baseline repair may restore other tracked crash residue but
  never `.pandacorp/status.yaml`; the engine still passes its complete regression corpus.
- Installed-switch fixture test: a Claude Stage 1 final state with missing/wrong phase/run identity is
  rejected before authorization, while the matching state makes `resolve-build-run-id.mjs` return an
  automatic cross-runtime cold continuation with the same logical run.
- Run build-state, Claude engine, Codex executor, runtime-switch, permit, unattended, derived/source
  graph, backlog, manifest and Manual checks applicable to touched surfaces.

## Done when

- No valid active lease can coexist after renew/sync with an architecture phase or missing/drifted
  logical-run projection.
- Baseline repair cannot restore the controller-owned status file.
- R10 pre-Stage-2 evidence fails closed on every missing/drifted handoff field and proves the resolver
  keeps the Claude logical run.
- Canonical standards, Manual and decision logs describe the protected projection; plugin/overlay
  versions are bumped correctly and all relevant suites pass.

## Out of scope

This item does not repair or reuse R10-J, change last-green pointer semantics, execute R10/R11, promote
Codex, or redesign Claude Dynamic Workflows.
