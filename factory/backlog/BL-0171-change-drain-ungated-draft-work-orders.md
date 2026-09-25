---
id: BL-0171
type: bug
area: build-engine
title: "processChange() created FRDs/WOs stay `status: DRAFT` (never gated by architecture's DR-100 readiness/grounding/consistency check) but the SAME run schedules and builds them anyway — only a LATER relaunch's preflight ever catches it"
status: done
severity: p1
opened: 2026-09-24
closed: 2026-09-24
source: "canary-d wave investigation (canary-d-wave-investigation.md) — wf_6e88dd68-8e4, mission-control, 2026-09-25T01:00-01:16Z, maxAgents:8 targeted change build"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js processChange()/enrollFrd()"
links: [BL-0172, BL-0173]
---

## Problem
`processChange()` (`pandacorp-build.js`, the engine's own targeted-change-integration step, reused by
the in-loop safe-point drain and the pre-loop `drainReadyQueuePreLoop`) routes a queued change through
an `pandacorp:implementer`-tier agent that creates or updates the affected FRD(s) and work order(s)
directly — a brand-new FRD's `blueprint.md` and its `work-orders/wo-*.md` are born `status: DRAFT`
(the work-order template's own default, per `plugin/skills/architecture/SKILL.md` line 55: "born
`status: DRAFT` (they flip to `ACTIVE` only in step 9b2, after all three gates pass)"). Nothing in
`processChange()` ever ran those three gates (readiness, repo-grounding, cross-doc consistency) or
flipped the DRAFT→ACTIVE stamp — yet the engine went straight on to plan and build those same WOs in
the identical run, with no gate in between.

The launch-time preflight (`plugin/scripts/preflight-implement.sh` §3/§5) DOES check for exactly this
— "ACTIVE, not-yet-VERIFIED blueprint(s) missing readiness/grounding/consistency stamps" and "un-gated
DRAFT work order(s)" — but it only runs once, BEFORE the run starts. A change's WOs do not exist yet at
that point (processChange creates them mid-run), so the very first launch always passes preflight
clean and builds an ungated WO anyway. Only a SECOND, LATER launch — after the WOs already exist on
disk — ever sees the preflight FAIL. Confirmed live in the canary-d report: `journal.jsonl` line 6
(`process-change` result) shows the change's 4 new FRD/WO folders created with no gate step between it
and `plan`/`dispatch:frd-02-ideas-board` (journal line 11), and the run committed `WO-02-014` (journal
line 16, sha `c1cd7330`) with its blueprint/WO still carrying no `readiness_gate`/`grounding_gate`/
`consistency_gate` stamp.

## Root cause
`pandacorp-build.js:1051-1065` (pre-fix `processChange()`): the SAME `pandacorp:implementer` agent that
authors the change's FRDs/WOs is also the only party that ever looks at them before they are scheduled
— self-certification (constitution rule 4, the exact thing `/pandacorp:architecture` step 9's "by a
FRESH agent, never the author" exists to prevent). `PLAN_SCHEMA`'s `workOrders[].status` field (line
650, pre-fix) only ever asked the planner for `implementation_status` (PLANNED/IN_REVIEW/VERIFIED/
BLOCKED) — the engine had NO visibility at all into the doc-gating `status:` (DRAFT/ACTIVE) frontmatter
field, so nothing downstream could have refused an ungated WO even if it had wanted to.

## Fix
1. New `gateChangeWorkOrders()` (`pandacorp-build.js`, right before `processChange()`): a FRESH,
   independent `pandacorp:architect`-tier (judge) agent, spawned AFTER `processChange()`'s own agent
   returns, that runs the SAME evidence contract architecture step 9/9b/9b2 requires (readiness +
   repo-grounding + cross-doc consistency) over every DRAFT work order the change just created/touched.
   Scoped to the delta a change actually touches (typically one FRD/one WO) rather than architecture's
   own three PARALLEL fresh-context spawns (proportionate for a brand-new multi-WO FRD surface, not for
   a 1-WO delta — a documented judgment call, not a corner cut: same fail-closed default, same DR-100
   stamp). On PASS it stamps `readiness_gate`/`grounding_gate`/`consistency_gate` + flips
   `status: DRAFT` → `ACTIVE` on the blueprint (only if the blueprint itself is still DRAFT — a change
   that only added a WO to an already-ACTIVE FRD leaves the blueprint's own stamps untouched) and on
   every DRAFT WO it gated, in one commit. On FAIL it changes nothing — DRAFT stays DRAFT.
2. `processChange()` now calls the gate and keeps ONLY the FRDs that came back `gated: true` in
   `proc.affectedFrds` — an ungated FRD is logged loudly (`⊘ … did NOT pass the DR-100 …`) and silently
   drops out of `ONLY`/this run's schedule, so the existing "change not processed" fail path (targeted
   build) or "nothing new to plan" path (safe-point/pre-loop drain) takes over unchanged — no new
   failure mode, the ungated FRD just never reaches the planner this run.
3. Fail-closed by construction: a null/garbled gate verdict, or a verdict that never mentions one of the
   affected FRDs, is treated as NOT gated for that FRD (never swallowed into a silent empty
   `affectedFrds`, error-handling.md's "never swallow an error").
4. Defense-in-depth (per the assignment): `PLAN_SCHEMA`'s `workOrders[].docStatus` (new field) now
   carries the LITERAL `status:` frontmatter (DRAFT|ACTIVE), reported by both the main planner
   (`runPlanner`) and the post-drain re-plan (`plan-drained:`). `enrollFrd()` refuses to schedule OR
   gate any WO whose `docStatus` reads `DRAFT` and is not already `VERIFIED` (mirrors preflight's own
   VERIFIED carve-out) — logged clearly, added to `blockedIds` (WS-A/D3, a dependent fails closed too).
   If excluding the DRAFT WO(s) leaves an FRD with nothing else pending, it is explicitly blocked
   `needs-owner` (rather than silently reporting "0 to build" with no attribution) so it never vanishes
   from the close-out narrative. This is a backstop, independent of point 1 above, for ANY future path
   that might let a DRAFT WO reach the plan — never build a DRAFT WO, no matter how it got there.

## Tests (TDD, RED confirmed against the pre-fix engine)
`plugin/scripts/test-pandacorp-build.mjs`, marker `// ---- BL-0171 ----`:
- **BL-0171a**: a change whose gate returns `gated: false` never reaches the planner this run, logs the
  failure clearly, and returns the standard "change not processed" shape.
- **BL-0171b**: a change whose gate passes (harness default happy-path) builds normally this run; locks
  in the gate prompt's readiness/grounding/consistency + DRAFT→ACTIVE contract.
- **BL-0171c**: defense-in-depth — a WO reported with `docStatus: DRAFT` (independent of the
  change-gate path) is refused by `enrollFrd`, never dispatched, and surfaces `needs-owner`.
- **BL-0171d**: control — `docStatus: ACTIVE` or absent (legacy) builds unaffected.
Also added the `gate-change-wos:` label to the harness's own happy-path `defaultResponse` (every
pre-existing change-drain scenario — 9, 10a-d, G9, E2b, REV2-4 — exercises the new gate transparently
and stays green with no scenario-level changes needed, confirming the default matches production's
"everything greens" shape).

## Verification
- `node plugin/scripts/test-pandacorp-build.mjs` — 176 passed, 0 failed (was 163 passed/5 failed before
  the `gate-change-wos:` default-response addition; 168/0 before the new BL-0171/0172/0173 scenarios
  were added; 176/0 with them).
- `bash plugin/scripts/run-engine-tests.sh` — 25/25 suites, 0 failed.
- `plugin/templates/shared/.claude/engines/pandacorp-build.js` re-synced byte-identical to
  `mission-control/.claude/engines/pandacorp-build.js` (`cmp` confirmed).

## Note — correcting the canary-d report's own diagnosis
The canary-d report attributes the foundation-gate's cost in its overhead trace to "`FORCE_UI_PASSES`
por defecto `true`". Read against the actual engine (`argBool(a, key, expect) => a[key] === expect`,
`FORCE_UI_PASSES = argBool(args, 'forceUiPasses', true)`), this default is in fact `false` — it is an
opt-in escape hatch (confirmed by the pre-existing `G13d` scenario's own framing and reproduced live
here: a BL-0173 fixture using non-UI artifact paths took the "foundation-gate omitido" branch, not the
forced one). The canary's REAL WOs (`src/app/board/IdeaBoardView/**`, `src/components/modules/
PortfolioTable/**`, …) legitimately match `UI_ARTIFACT_RE` on their own — `artifactsTouchUi()` is what
actually forced the gate that run, not the default. This does not change BL-0171/BL-0172/BL-0173's
root causes or fixes (all independently confirmed against file:line evidence), only the report's own
account of one contributing cost line — noted here rather than silently repeated as fact (CONV-13).

## Out of scope
Re-running architecture's full 3-parallel-context gate for a change (vs. this item's single
right-sized fresh pass) — flagged in the fix rationale as a deliberate, documented judgment call, not a
deferred requirement.
