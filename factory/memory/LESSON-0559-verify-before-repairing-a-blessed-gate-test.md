---
id: LESSON-0559
type: pattern
domain: build-engine
tags: [gate-test-defective, reviewer, dr-080, blessed-test, verification, derogation]
context: deciding whether a red, previously-blessed reviewer test is genuinely defective (and safe to repair/re-bless) or is correctly catching a real regression
trigger: "use this when a build/gate hits a red, blessed reviewer test that the current WO/blueprint appears to derogate, and you are tempted to repair/re-bless it as gate-test-defective (LESSON-0002/LESSON-0104)"
source: "mission-control factory/memory/_inbox.md 2026-10-30 (agent-inferred) — four notes from the same build window: FRD-25/WO-25-001 reviewer-blessed 404 contract vs the WO's derogated contract (A/B run on HEAD isolated the single failure to the immutable vector); FRD-21 e2e/visual.spec.ts-snapshots asserting the retired Atelier design system against the approved Orbita contract (ADR-0012, design-tokens.json, WO-13-010 §Derogated tests already defers re-bless to Visual QA); WO-14-005's snapshot-panel.adversarial.test.tsx self-labeled as reviewer-authored while the WO assigns it to the implementer; FRD-25 gate-test-repair where six v1 tests retained shell/dialog/WO-tail exemptions that the v2 ACs derogate"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0002, LESSON-0104, BL-0051]
---

**Situation:** LESSON-0002/LESSON-0104 already establish that a red gate can be caused by a *defective*
reviewer test (one asserting a contract the current work intentionally derogates) rather than by wrong
production code, and that the remedy is an independent re-bless, never a rebuild or a silent revert. Four
related incidents in the same Mission Control build window show that *diagnosing* "this blessed test is
defective" needs its own verification discipline — jumping straight to repair/re-bless on each one would
have been wrong or premature in at least three of the four cases.

**Lesson (four independent checks, not one):**
1. **Isolate the failure before trusting the diagnosis.** Run the reviewer/gate suite against HEAD
   (pre-change) as well as the candidate branch; if HEAD is fully green and only the candidate's single,
   immutable vector fails, that isolates the red to the intentional contract change rather than an
   unrelated regression — cheap, concrete evidence before escalating as gate-test-defective.
2. **A documented, already-planned derogation is itself the independent evidence.** When the blueprint/WO
   already names the stale test and explicitly defers its re-bless to a later phase (e.g. a "§Derogated
   tests" section pointing at a future Visual QA pass), that documentation already satisfies the
   independent-evidence bar — do not treat the red as a surprise requiring a fresh investigation, and do
   not revert tokens/rebuild the consumer WO to satisfy a test the plan already retired.
3. **Trust the WO's role assignment over a test file's own self-description.** A test file's header/comment
   claiming "written by reviewer" (or "by implementer") can be stale or simply wrong; DR-080's "who may
   edit this test" question is answered by what the current WO actually assigns, not by the file's own
   label — verify against the WO before deciding who is allowed to touch it.
4. **Repairing the oracle only works if production code already matches the NEW contract.** Before treating
   a red test as "just needs re-blessing to the derogated contract," confirm the implementation has
   actually migrated off the old surface it asserts against (shell exemption, dialog, WO-tail, etc.).
   Re-blessing the test to the new contract while the code still carries the old one does not turn the
   build green — it masks a real gap. Contrast the FRD + blueprint + `dependsOn` chain against the
   implementation before attributing the red to the test rather than the code.

**Apply next time:** before repairing/re-blessing a blocked, previously-blessed gate test, run the four
checks above — (1) A/B against HEAD to isolate the failure, (2) check whether the blueprint/WO already
documents and defers this exact derogation, (3) verify test-authorship/edit-rights against the WO's
assignment rather than the file's own header, (4) confirm the implementation genuinely satisfies the new
contract already — before concluding the test, not the code, is what's wrong.
