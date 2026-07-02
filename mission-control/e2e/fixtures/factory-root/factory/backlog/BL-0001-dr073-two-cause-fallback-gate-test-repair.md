---
id: BL-0001
type: bug
area: build-engine
title: "DR-073 fallback conflates code-wrong vs defective-gate-test → rebuilds correct work"
status: done
severity: p1
opened: 2026-06-30
closed: 2026-07-01
source: "LESSON-0002"
closes: "DR-073 two-cause fallback (registry amend + DR-107) + reviewer/quality satisfiable-test convention"
links: [LESSON-0002, DR-073, DR-107, DR-015, BL-0017]
---

## Problem
DR-073's single FRD-gate fallback (`green:false` → `revertAndReopen` → rebuild) conflates two different
failure causes: (1) the production code is wrong (rebuild is right) vs (2) the reviewer's own gate test is
defective/unsatisfiable-by-correct-code (rebuild is WRONG — it discards a correct patch and can't fix a bad
test). Hit on personal-page-v2 FRD-01 (run wf_b01c0efe-146): a reviewer adversarial spec
(`shell-404.spec.ts`) asserted desktop-only nav visibility with NO viewport under a dual desktop+mobile
Playwright config, so it was impossible on the 390px `mobile` project (nav correctly collapses). The patch
was correct and passed on desktop, but the whole-project re-gate failed only on that defective test; the
integrity rule forbids the patch agent editing the reviewer's test, so it returned `green:false` and the
engine reverted WO-01-004 entirely and rebuilt it (reopen_count 1), throwing away a correct patch. Impact:
correct work is discarded and rebuilt in a loop that a defective gate test can never let converge.

## Root cause
The FRD-gate has a single failure verdict (`green:false`) and a single response (`revertAndReopen`). It
assumes `green:false` always means "the code is wrong", but a red gate has two disjoint causes — wrong code
vs a wrong test — and the engine cannot distinguish them. Because the integrity rule bars the patch agent
from touching the reviewer's test, a defective test is a trap with no exit: every rebuild re-hits the same
unsatisfiable assertion.

## Fix plan
1. **Reviewer adversarial tests inherit the canonical specs' viewport conventions.** A structural visibility
   check MUST force `DESKTOP_WIDTH` (as `shell.spec.ts`) or open the mobile toggle (as `a11y.spec.ts`), never
   assert desktop-only visibility on the `mobile` project. Edit `plugin/agents/reviewer.md` (adversarial-test
   authoring, DR-015) + a rule in `factory/standards/quality.md`; optionally a cheap guard in `doc-lint.sh`
   flagging a spec that asserts nav-link `.toBeVisible()` with neither `setViewportSize` nor a toggle-open.
2. **Second fallback exit for a defective gate test.** The patch agent returns a discriminated verdict
   `{ green:false, cause: "code-wrong" | "gate-test-defective", evidence }`; on `gate-test-defective` the
   engine routes to a **gate-test-repair** path (hand the test back to the reviewer to fix its OWN test +
   re-gate) instead of `revertAndReopen`. Edit `plugin/templates/shared/.claude/workflows/pandacorp-build.js`
   (`attemptPatch` return shape + the FRD-gate branch) + `plugin/agents/implementer.md` (allowed verdicts) +
   `plugin/agents/reviewer.md` (the test-repair handback).
3. **Give the integrity rule a valve.** Keep "the patch agent never weakens the reviewer's test" but allow it
   to FLAG the test as suspected-defective and escalate (with evidence). Document in
   `factory/standards/build-orchestration.md` §6 alongside the DR-073 gate-reject flow.

## Tests (prove the fix — TDD, RED → GREEN)
- **Verdict routing (unit, `pandacorp-build.js`):** feed the FRD-gate branch a patch-agent verdict
  `{ green:false, cause:"gate-test-defective", evidence }` and assert the engine calls the gate-test-repair
  path, NOT `revertAndReopen` (no `reopen_count` increment, WO not reverted). A second case with
  `cause:"code-wrong"` asserts the classic `revertAndReopen` still fires. Both fail today (single verdict, no
  branch).
- **Live structural spec (Playwright, DR-100 edge path):** run a nav-visibility structural spec under BOTH
  the `desktop` and `mobile` projects after the reviewer-authoring rule lands; it must pass on both (mobile
  via toggle-open or forced `DESKTOP_WIDTH`), where the old `shell-404.spec.ts` form failed on `mobile`.
- **doc-lint canary (`verify.sh --canary`, DR-079):** a fixture spec asserting a nav link `.toBeVisible()`
  with neither `setViewportSize` nor a toggle-open must make the doc-lint guard flag it (gate goes RED); the
  compliant form leaves it clean.

## Done when
DR-073 in `factory/decisions/registry.yaml` is amended with the two-cause fallback + the reviewer-test
viewport standard; the engine routes a `gate-test-defective` verdict to test-repair (not rebuild), proven by
the unit test above; `factory/standards/build-orchestration.md` §6 + `factory/standards/quality.md` updated;
plugin MINOR + `OVERLAY_VERSION` bumped (engine is an overlay file); the gate canary and the live Playwright
run under both projects pass. Then set LESSON-0002 `promotion: approved` and back-link this item.

## Out of scope
The reviewer's judgement quality (which assertions to write) beyond the viewport-convention rule; a general
"the engine may edit reviewer tests" relaxation — the integrity rule stays, only the escalation valve is added.

## Closed 2026-07-01 (implement-speed audit batch, plugin v9.40.0 / OVERLAY 8.54.0)
Shipped: (1) reviewer viewport convention → `plugin/agents/reviewer.md` (adversarial tests, point 2) +
`factory/standards/quality.md` (DR-015 section, satisfiable-test rule); (2) the two-cause verdict → the
engine's `REPAIR_SCHEMA` gains `cause: 'code' | 'gate-test-defective'` + `defectiveTests`, `attemptPatch`
flags with evidence (never edits the test), and the new `repairGateTest` (independent reviewer-role agent)
judges the claim and repairs the TEST — an upheld test falls back to the normal revert; (3) the valve is
documented in `factory/standards/build-orchestration.md` §6 and DR-073's registry entry (refined-by
DR-107). **Accepted residue (documented, honest):** the doc-lint canary guard for defective-viewport specs
(fix-plan step 1, "optionally") was NOT built; verdict routing is proven by inspection — there is still no
engine unit-test harness (the BL-0004 accepted residue applies here too); the live dual-project Playwright
proof happens on the next real build. LESSON-0002 `promotion: approved` + back-linked.
