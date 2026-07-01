---
id: BL-0004
type: bug
area: build-engine
title: "Build workflow has fail-open edges (foundation completeness, maxAgents, missing artifacts)"
status: open
severity: p1
opened: 2026-06-30
closed:
source: "docs/proposals/19-factory-flow-audit-2026-06-30.md (P1 — Build Workflow Has Fail-Open Edges)"
closes:
links: [DR-050, DR-060]
---

## Problem
`plugin/templates/shared/.claude/workflows/pandacorp-build.js` has three robustness edges that CONTINUE when
they should BLOCK: (1) foundation completeness is treated as complete when the gate data is missing/invalid;
(2) `maxAgents` can be exceeded within a planned wave if the external supervisor is absent/dead; (3) old work
orders without an `artifacts` field weaken overlap detection — they are read as "no overlap" instead of forcing
serialization. Found in the 2026-06-30 factory-flow audit (P1). Impact: the engine can start building on an
incomplete foundation, over-spawn agents past the concurrency cap, and run genuinely-overlapping WOs in
parallel — the exact class of collision DR-060 exists to prevent.

## Root cause
Each edge defaults to the permissive branch on absent/invalid data (a classic fail-open): missing foundation
data → assumed complete; supervisor-driven `maxAgents` enforcement → skipped when the supervisor is gone;
missing `artifacts` → treated as an empty overlap set rather than "unknown, therefore unsafe". The safe default
for each is fail-closed / serialize, and the code does the opposite.

## Fix plan
1. Make missing/invalid foundation-completeness data **fail closed** — a blueprint's foundation must be
   provably complete, not assumed.
2. Enforce `maxAgents` **before** scheduling each spawn/wave, independent of the supervisor being alive.
3. Treat missing `artifacts` as a **warning that forces serialization**, not as "no overlap".
Files: `plugin/templates/shared/.claude/workflows/pandacorp-build.js`; note the fail-closed policy in
`factory/standards/build-orchestration.md`.

## Tests (prove the fix — TDD, RED → GREEN)
- **Foundation fail-closed (unit, `pandacorp-build.js`):** feed the foundation-completeness check missing/invalid
  gate data and assert the engine BLOCKS (does not proceed to build), where today it proceeds.
- **maxAgents cap (unit):** with the supervisor absent/dead and a wave whose planned spawns exceed `maxAgents`,
  assert the scheduler refuses to spawn beyond the cap. Fails today (cap depends on the supervisor).
- **Overlap serialization (unit):** two WOs where one lacks `artifacts` must be serialized (overlap assumed),
  not run in parallel. Fails today (missing `artifacts` = "no overlap").
- **Dry-run integration:** a plan with missing foundation data and an un-`artifacts`'d WO must stop/serialize
  as above end-to-end; plus a gate-canary run confirming gates still bite.

## Done when
The three edges fail-closed / serialize as specified (each proven by its unit test); the fail-closed policy is
noted in `factory/standards/build-orchestration.md`; the dry-run + gate canary pass; plugin + `OVERLAY_VERSION`
bumped (engine is an overlay file).

## Out of scope
Re-architecting the wave scheduler or the supervisor protocol — this item only closes the three permissive-on-
absent-data branches.
