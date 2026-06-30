---
id: LESSON-0002
type: anti-pattern
domain: factory-engineering
tags: [build-engine, dr-073, reviewer, adversarial-tests, patch-first, playwright, responsive, viewport, integrity-rule]
context: the FRD gate's DR-073 patch-first fallback discards a CORRECT in-place patch and rebuilds a whole work order from scratch when the blocker is a DEFECTIVE reviewer-authored gate test (not bad production code), because (a) the reviewer's adversarial test was internally inconsistent with the dual desktop+mobile Playwright config, and (b) the integrity rule forbids the patch agent from touching that test, leaving rebuild as the only exit
source: project personal-page-v2, build run wf_b01c0efe-146 (FRD-01 gate); reviewer agent a2f87cf6, patch agent a1578dc; commits fe81a4c (build) → e4aa8ce (revert "DR-073 fallback") → e2ea84f (rebuild)
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: proposed
confidence: high
times_applied: 0
links: [DR-073, DR-074, DR-070, DR-072, DR-015, LESSON-0001]
---

**Situation:** During personal-page-v2's FRD-01 gate, the reviewer found ONE real, bounded CORRECTION
defect (Shell-Presence Gate DR-075 RED: unmatched `/en/<x>` 404 routes rendered Next's bare default 404
without the app shell). The reviewer diagnosed it perfectly — a one-file fix (an optional catch-all
`src/app/[locale]/[...rest]/page.tsx` calling `notFound()`) — wrote a RED-proven adversarial test
(`e2e/shell-404.spec.ts`), and correctly did NOT revert (DR-073 patch-first). The patch agent applied
the fix correctly (catch-all + de-nested a double-`<main>` the original `not-found.tsx` mounted) and the
cited finding **passed on desktop**. But it could not green the WHOLE-project re-gate, for a reason
unrelated to the production code: the reviewer's `shell-404.spec.ts` set **no viewport**, so on the
`mobile` Playwright project (390px) it asserted all 5 nav links are directly `.toBeVisible()` — which is
impossible by correct responsive design (the nav collapses behind the toggle on mobile), and which
contradicts the reviewer's OWN convention in `shell.spec.ts` (which forces desktop width for structural
nav checks) and `a11y.spec.ts` (which opens the toggle on mobile). The reviewer never noticed because the
RED was proven on the FIRST assertion (shell absent, desktop) and never reached the mobile assertion. The
patch agent was then trapped: the integrity rule forbids it from editing/weakening the reviewer's test
(it tried adding a viewport, recognized this was forbidden, and reverted that edit), and breaking the
app's responsive design to satisfy the test was wrong. With no sane exit it returned `green:false`, and
the engine's DR-073 fallback **reverted WO-01-004 entirely and rebuilt it from scratch** (reopen_count 1)
— throwing away a correct patch. A from-scratch rebuild cannot fix a defective gate test; it only
"worked" on the retry because the re-gate regenerated a (this time correct) test.

**Lesson:** DR-073's single fallback (`green:false` → revertAndReopen → rebuild) conflates two
fundamentally different failure causes: **(1) the production code is wrong** (rebuild/patch is the right
remedy) vs **(2) the reviewer's own gate test is defective/unsatisfiable-by-correct-code** (rebuild is
the WRONG remedy — it discards correct work and can't fix a bad test). The trigger here was a concrete,
recurring authoring trap: a reviewer adversarial spec that asserts desktop-only structural visibility
WITHOUT forcing a width, run under a dual desktop+mobile Playwright config, is internally inconsistent
with the project's own responsive design. The integrity rule ("an agent never edits the reviewer's gate
test") is correct in general but, with no escape valve, it converts a defective-test situation into a
needless full rebuild. Net waste: a ~correct patch + a whole work order, rebuilt to (re)generate the
test that was the actual fault.

**Apply next time (concrete implementation plan — defer to a deliberate change, owner-directed
2026-06-30, "documentar bien para implementarlo muy bien luego"):**

1. **Reviewer adversarial tests MUST inherit the canonical specs' viewport conventions (a new
   standard).** A structural visibility check (nav links, shell landmarks, anything that legitimately
   collapses responsively) MUST either force `DESKTOP_WIDTH` (as `shell.spec.ts` does) or open the
   mobile toggle (as `a11y.spec.ts` does) — it must NEVER assert desktop-only visibility on the `mobile`
   Playwright project. Implement in `plugin/agents/reviewer.md` (the adversarial-test authoring section,
   DR-015) + a rule in `factory/standards/quality.md`; consider a cheap guard in `doc-lint.sh`/a lint
   that flags an e2e spec asserting `.nav`/nav-link `.toBeVisible()` with neither a `setViewportSize`
   nor a toggle-open. This single fix would have let the patch green cleanly here.

2. **DR-073 needs a SECOND exit when `green:false` is caused by a defective gate test, not bad code.**
   The patch agent must return a discriminated verdict, not just a boolean: e.g.
   `{ green:false, cause: "code-wrong" | "gate-test-defective", evidence }`. On `gate-test-defective`
   (the patch made the cited RED-proven finding pass, but the whole-project re-gate fails ONLY on a
   reviewer-authored test that is internally inconsistent / unsatisfiable by correct code) the engine
   routes to a **gate-test-repair** path — hand the test back to the reviewer to fix its OWN test (and
   re-gate) — instead of `revertAndReopen`. A rebuild must never be the remedy for a bad test. Implement
   in `plugin/templates/shared/.claude/workflows/pandacorp-build.js` (`attemptPatch` return shape +
   the FRD-gate branch that today always calls `revertAndReopen`) + `plugin/agents/implementer.md` (the
   patch agent's allowed verdicts) + `plugin/agents/reviewer.md` (the test-repair handback).

3. **Give the integrity rule a valve.** Keep "the patch agent never edits/weakens the reviewer's test",
   but allow it to **FLAG the test as suspected-defective and escalate** (with evidence), rather than
   being forced into a dead end that degrades to rebuild. This is the mechanism that carries cause
   `gate-test-defective` from §2 to the reviewer. Document in
   `factory/standards/build-orchestration.md` §6 alongside the DR-073 gate-reject flow.

4. **When implemented:** amend DR-073 in `factory/decisions/registry.yaml` (add the two-cause fallback +
   the reviewer-test viewport standard pointer), bump `plugin/.claude-plugin/plugin.json` (MINOR) and
   `plugin/templates/OVERLAY_VERSION` (the engine is an overlay file), update
   `factory/standards/{build-orchestration.md,quality.md}`, and back-link this lesson
   (`promotion: approved`). Validate with the gate canary + a live Playwright run of a structural spec
   under both projects.

**Why it matters:** this is the same class as DR-073's own origin ("no tiene sentido descartar todo por
un 1% que falla") — but one level deeper: here the discarded work was already a CORRECT patch, and the
real fault was in the verifier, not the code. The fix keeps the fail-closed gate honest while stopping a
defective test from costing a full rebuild.
