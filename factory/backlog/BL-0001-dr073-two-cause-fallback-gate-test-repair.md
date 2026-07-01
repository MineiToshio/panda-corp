---
id: BL-0001
type: bug
area: build-engine
title: DR-073 fallback conflates code-wrong vs defective-gate-test → rebuilds correct work
status: open
severity: p1
opened: 2026-06-30
closed:
source: LESSON-0002
closes:
links: [LESSON-0002, DR-073, DR-015]
---

**Problem:** DR-073's single FRD-gate fallback (`green:false` → `revertAndReopen` → rebuild) conflates two
different failure causes: (1) the production code is wrong (rebuild is right) vs (2) the reviewer's own
gate test is defective/unsatisfiable-by-correct-code (rebuild is WRONG — it discards a correct patch and
can't fix a bad test). Hit on personal-page-v2 FRD-01 (run wf_b01c0efe-146): a reviewer adversarial spec
(`shell-404.spec.ts`) asserted desktop-only nav visibility with NO viewport under a dual desktop+mobile
Playwright config, so it was impossible on the 390px `mobile` project (nav correctly collapses). The patch
was correct and passed on desktop, but the whole-project re-gate failed only on that defective test; the
integrity rule forbids the patch agent editing the reviewer's test, so it returned `green:false` and the
engine reverted WO-01-004 entirely and rebuilt it (reopen_count 1), throwing away a correct patch.

**Fix plan:**
1. **Reviewer adversarial tests inherit the canonical specs' viewport conventions.** A structural
   visibility check MUST force `DESKTOP_WIDTH` (as `shell.spec.ts`) or open the mobile toggle (as
   `a11y.spec.ts`), never assert desktop-only visibility on the `mobile` project. Edit
   `plugin/agents/reviewer.md` (adversarial-test authoring, DR-015) + a rule in `factory/standards/quality.md`;
   optionally a cheap guard in `doc-lint.sh` flagging a spec that asserts nav-link `.toBeVisible()` with
   neither `setViewportSize` nor a toggle-open.
2. **Second fallback exit for a defective gate test.** The patch agent returns a discriminated verdict
   `{ green:false, cause: "code-wrong" | "gate-test-defective", evidence }`; on `gate-test-defective` the
   engine routes to a **gate-test-repair** path (hand the test back to the reviewer to fix its OWN test +
   re-gate) instead of `revertAndReopen`. Edit `plugin/templates/shared/.claude/workflows/pandacorp-build.js`
   (`attemptPatch` return shape + the FRD-gate branch) + `plugin/agents/implementer.md` (allowed verdicts) +
   `plugin/agents/reviewer.md` (the test-repair handback).
3. **Give the integrity rule a valve.** Keep "the patch agent never weakens the reviewer's test" but allow
   it to FLAG the test as suspected-defective and escalate (with evidence). Document in
   `factory/standards/build-orchestration.md` §6 alongside the DR-073 gate-reject flow.

**Done when:** DR-073 in `factory/decisions/registry.yaml` is amended with the two-cause fallback + the
reviewer-test viewport standard; the engine routes a `gate-test-defective` verdict to test-repair (not
rebuild); plugin MINOR + `OVERLAY_VERSION` bumped (engine is an overlay file); validated with the gate
canary + a live Playwright run of a structural spec under both projects. Then set LESSON-0002
`promotion: approved` and back-link this item.
