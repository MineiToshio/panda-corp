---
id: BL-0019
type: change
area: build-engine
title: "Builder context pack (AC text injected), self-test folded into the solo builder, cheap tier for mechanical steps"
status: done
severity: p2
opened: 2026-07-01
closed: 2026-07-01
source: "owner/conversation — implement-speed audit of the personal-page-v2 build (2026-07-01), phase 3"
closes: "DR-108"
links: [DR-108, DR-073, DR-060, BL-0017, BL-0018]
---

## Problem
Three token/latency sinks in `pandacorp-build.js`, all evidence-backed from the personal-page-v2 run:
1. **Builders got a one-line summary.** The per-WO prompt injected only `wo.summary`; each builder (and the
   test-writer, and the reviewer) re-hunted and re-read frd.md/blueprint/docs on its own — N agents × the
   same 3-5 documents — and STILL built against an underspecified scope, so gates found missing AC coverage
   late (first-attempt failures were the top rework cause).
2. **Two same-model spawns per WO.** The solo builder was followed by a separate `selftest` agent (same
   agentType, same model) whose only job was running biome/tsc/scoped-vitest and writing the Status Note —
   a full extra cold agent per WO, ~2× the per-WO spawn count.
3. **Mechanical steps paid the worker model.** The serialized per-WO commit, the per-FRD safe-point check,
   the rollup sync, the change archive, and the end-of-run notify all ran on sonnet — script execution with
   no judgement, at worker price, dozens of times per run.

## Fix plan
All shipped in `pandacorp-build.js` (mirrored in `build-orchestration.md` + `implement` SKILL.md):
1. **DR-108 context pack:** the planner (the ONE agent that reads frd.md in full) now returns per WO its
   `path` + `acText` (the EARS AC lines that WO owns, verbatim, bounded); `woCtx()` injects both into the
   builder / test-writer / backend / frontend prompts. One reader hands off to N builders.
2. **Merged self-test (solo mode):** the solo builder runs its own self-test + writes the Status Note and
   returns `green` via `VERIFY_SCHEMA` (the shared `SELFTEST` contract) — one spawn per WO instead of two.
   Split mode keeps a separate closer (three hands built the slice; one closes it). The trust boundary is
   unchanged: the independent FRD gate (reviewer, different model) re-verifies everything (§22).
3. **`MECH` tier (default `haiku`, overridable via `args.mechModel`):** `commit:*`, `dispatch:*` (BL-0002),
   `safe-point`, `sync-rollups`, `archive-changes`, `notify-end`, `ensure-stopped` run on the cheap tier.

## Tests (prove the fix — TDD, RED → GREEN)
No engine unit-test harness (BL-0004 residue): proven by inspection + `node --check` at ship time, and
empirically on the next build — per-WO agent count drops (one `build:` spawn, no `selftest:` in solo mode),
`dispatch:`/`commit:` agents report the cheap model in the run journal, and gate first-pass rate should rise
(the context pack's purpose; watch reopen counts vs the personal-page-v2 baseline of 2 reverts / 3 gates on
FRD-01).

## Done when
DR-108 in the registry; the three mechanisms in the engine; standards + skill updated; plugin MINOR +
`OVERLAY_VERSION` bumped. All true as of 2026-07-01 (plugin v9.41.0, OVERLAY 8.55.0).

## Out of scope
Injecting dep Status-Note CONTENT into prompts (the builder still reads dep notes itself — they don't exist
at plan time); reviewer-side context packs; any change to wave sizing or the gate's scope (BL-0018/DR-106).
