---
id: LESSON-0002
type: anti-pattern
domain: factory-engineering
tags: [build-engine, dr-073, reviewer, adversarial-tests, patch-first, playwright, responsive, viewport, integrity-rule]
context: the FRD gate's DR-073 patch-first fallback discards a CORRECT in-place patch and rebuilds a whole work order from scratch when the blocker is a DEFECTIVE reviewer-authored gate test (not bad production code), because (a) the reviewer's adversarial test was internally inconsistent with the dual desktop+mobile Playwright config, and (b) the integrity rule forbids the patch agent from touching that test, leaving rebuild as the only exit
trigger: use this when an FRD gate fails after a patch and you must decide between rebuilding the work order or suspecting the reviewer's own gate test is defective (e.g. a Playwright spec asserting desktop-only visibility without forcing a viewport)
source: project personal-page-v2, build run wf_b01c0efe-146 (FRD-01 gate); reviewer agent a2f87cf6, patch agent a1578dc; commits fe81a4c (build) → e4aa8ce (revert "DR-073 fallback") → e2ea84f (rebuild)
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: approved   # 2026-07-01 — codified as the DR-073 two-cause fallback (registry amend + DR-107) via BL-0001; reviewer.md + quality.md carry the satisfiable-test convention
confidence: high
times_applied: 1
applied_in: [mission-control]
links: [BL-0001, DR-073, DR-074, DR-070, DR-072, DR-015, LESSON-0001]
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

**Apply next time (the durable principle):** A fail-closed gate needs to distinguish TWO failure causes,
not collapse them into one remedy: *the production code is wrong* (patch/rebuild is right) vs *the
verifier's own gate test is defective / unsatisfiable-by-correct-code* (rebuild is the WRONG remedy — it
discards correct work and cannot fix a bad test). Two recurring traps sit under this: (a) a reviewer
adversarial spec that asserts desktop-only structural visibility WITHOUT forcing a width, run under a dual
desktop+mobile Playwright config, is internally inconsistent with correct responsive design — a structural
visibility check must force `DESKTOP_WIDTH` or open the mobile toggle, never assert desktop-only visibility
on the `mobile` project; (b) an integrity rule ("an agent never edits the reviewer's gate test") needs an
escape valve (flag-and-escalate), or it converts a defective-test situation into a needless full rebuild.

> The concrete engine/agent/registry fix (the discriminated `gate-test-defective` verdict, the
> gate-test-repair path, the reviewer viewport standard, the DR-073 amendment) is an **actionable defect**,
> tracked as **BL-0001** in `factory/backlog/` — not part of this durable lesson (DR-103).

**Why it matters:** this is the same class as DR-073's own origin ("no tiene sentido descartar todo por
un 1% que falla") — but one level deeper: here the discarded work was already a CORRECT patch, and the
real fault was in the verifier, not the code. The fix keeps the fail-closed gate honest while stopping a
defective test from costing a full rebuild.
