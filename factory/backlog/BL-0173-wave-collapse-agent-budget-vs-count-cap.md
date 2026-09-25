---
id: BL-0173
type: bug
area: build-engine
title: "a wave collapsed to 1 WO by exhausted pre-wave agent-budget overhead was indistinguishable, in the log, from a real dependency/count-cap stall — pickDisjointWave's cut reason was never reported"
status: done
severity: p1
opened: 2026-09-24
closed: 2026-09-24
source: "canary-d wave investigation (canary-d-wave-investigation.md) §1-4 — wf_6e88dd68-8e4, mission-control, maxAgents:8, wave 1 dispatched 1 of 4 ready/disjoint WOs"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js pickDisjointWave() + its call site; plugin/scripts/launch-implement.sh; plugin/skills/implement/SKILL.md"
links: [BL-0171, BL-0172]
---

## Problem
Canary-d launched `mode: powerful` (`P.wave = 8`), `maxAgents: 8`, with 4 disjoint, dep-satisfied,
ready work orders across 4 FRDs (confirmed clean in `journal.jsonl`'s `plan` result — `deps: []` on
every one, zero artifact overlap). Only 1 of the 4 dispatched. `maxAgents:8` is a perfectly reasonable-
looking ceiling for `powerful` (`wave:8`) at a glance, and nothing in the engine's own log or the
`pickDisjointWave` deferred-reason annotation told the owner WHY the wave was 1 wide instead of 4 — the
label was the SAME generic `(blocked:wave-cap)` a real `P.wave` count-cap or a real dependency stall
would print, forcing the coordinator to hand-reconstruct the cause from `journal.jsonl` + the engine
source instead of reading it straight off the run's own log.

## Root cause
`pandacorp-build.js`: the FIXED pre-wave overhead — `baseline-precheck` (+1) + `process-change`/`plan`
(+3 each, opus-weighted) + `safe-point` (+1) + `foundation-gate` (+3, forced this run since the ready
WOs' own artifacts — `src/app/board/**`, `src/components/modules/PortfolioTable/**`, etc. — legitimately
match `UI_ARTIFACT_RE`, see BL-0171's note re: `FORCE_UI_PASSES`) — reached `agentSpawned: 11` BEFORE
the scheduler ever picked a wave. `remainingAgents = Math.max(1, MAX_AGENTS - agentSpawned) =
Math.max(1, 8-11) = 1` (`pandacorp-build.js`, the wave-pick call site). `pickDisjointWave`'s own
anti-deadlock floor (`picked.length > 0 &&` guarding the cost-budget check — never a wave of width 0,
by design, so progress is always guaranteed) admitted exactly 1 WO and broke on the 2nd — CORRECT
behavior, not a bug — but the function returned only the picked array, with no signal for WHY it
stopped there. The caller's own deferred-reason line (`${wo.id}(blocked:wave-cap)`) is generated purely
from "not in the picked wave, not an artifact overlap, not a dep" — it cannot distinguish a real
`P.wave` count-cap cut from a `remainingAgents` cost-budget cut, because `pickDisjointWave` itself never
told it which one happened.

## Fix
1. `pickDisjointWave` (`pandacorp-build.js`) now returns `{ picked, cutBy }` — `cutBy` is `'count-cap'`
   when `picked.length >= max` broke the loop, `'agent-budget'` when the cost-budget check did, and
   `null` when every ready WO was picked (no cut at all). The one call site destructures it.
2. When the cut is `agent-budget` AND the wave collapsed to exactly 1 WO with more than 1 candidate
   ready, the engine now logs a loud, explicit warning naming `agentSpawned`, `maxAgents`,
   `remainingAgents`, and how many more WOs were ready-but-deferred purely on budget — and explicitly
   states this is NOT a dependency/artifact/count-cap cut.
3. The deferred-WO label itself now reads `(blocked:agent-budget)` instead of the generic
   `(blocked:wave-cap)` whenever `cutBy === 'agent-budget'` — a real `P.wave` count-cap cut keeps the
   original `(blocked:wave-cap)` label, unchanged.
4. `launch-implement.sh`: a new advisory warning at launch time — `powerful` mode with `maxAgents < 15`
   now prints that maxAgents is a TOTAL run budget (not concurrency), names the ~8-11 unit fixed
   pre-wave floor, and says the first wave will likely collapse to 1 WO. Non-blocking (does not change
   launch semantics), consistent with the file's own existing `no maxAgents given` advisory.
5. `plugin/skills/implement/SKILL.md`'s reference table gained one row spelling out the same fixed
   pre-wave overhead floor next to the existing `maxAgents unit` row.

## Tests (TDD, RED confirmed against the pre-fix engine/launcher)
`plugin/scripts/test-pandacorp-build.mjs`, marker `// ---- BL-0173 ----`:
- **BL-0173**: replica of the report's own projected "next run" shape (`precheck 1 + plan 3 +
  safe-point 1 + foundation-gate 3 = 8`, `maxAgents:8`, 3 disjoint ready WOs with genuine `.tsx`
  artifacts) — asserts the wave collapses to 1, the new warning fires naming `remainingAgents=1`, the 2
  deferred WOs are labeled `agent-budget`, and NO deferred WO is mislabeled `wave-cap`.
- **BL-0173 control**: a genuine `P.wave` count-cap cut (mode `pro`, `P.wave=2`, no `maxAgents`, 3
  disjoint ready WOs) still labels its deferred WO `wave-cap`, unchanged — and the new agent-budget
  warning never fires. This is the sibling-audit the debugging.md rule requires ("what else shares this
  cause?") applied in reverse: proving the fix does NOT widen beyond its actual trigger.

`plugin/scripts/test-build-run-id.mjs` (the existing suite that already drives `launch-implement.sh`
end-to-end against a real fixture project — reused rather than standing up a new bash suite, per this
item's own instruction to prefer an existing launcher/preflight suite): 3 new cases — `powerful`+
`maxAgents:8` prints the new warning; `powerful`+`maxAgents:20` and `pro`+`maxAgents:8` (below the
floor but not `powerful`) print neither.

## Verification
- `node plugin/scripts/test-pandacorp-build.mjs` — 176 passed, 0 failed.
- `node plugin/scripts/test-build-run-id.mjs` — 21 passed, 0 failed (was 18).
- `bash plugin/scripts/run-engine-tests.sh` — 25/25 suites, 0 failed, run twice.
- `plugin/templates/shared/.claude/engines/pandacorp-build.js` re-synced byte-identical to
  `mission-control/.claude/engines/pandacorp-build.js` (`cmp` confirmed).
- **NOT verified live**: a real overnight `powerful` build actually reading the new launch-time warning
  and the owner acting on it (raising `maxAgents`) — no live build was launched as part of this item.

## Out of scope
Changing `pickDisjointWave`'s own anti-deadlock floor (always admit ≥1 WO) — confirmed CORRECT, by
design, not touched. Auto-raising `maxAgents` or refusing a launch below the floor — the report's own
fix proposal explicitly keeps this advisory-only ("no bloquear — el owner puede querer justo esto para
probar el techo"); a blocking gate is a separate, larger decision not made here.
