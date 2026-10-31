---
id: LESSON-0561
type: gotcha
domain: css
tags: [design-tokens, globals-css, accessibility, redesign, regression]
context: replacing a project's globals.css with a new design system's tokens during a v2/redesign
trigger: "use this when swapping globals.css for a new design system's token file during a redesign — before trusting green token tests as proof the global stylesheet is still correct"
source: "mission-control factory/memory/_inbox.md 2026-10-30 (agent-inferred) — replacing globals.css with Orbita tokens dropped font-variant-numeric on html, a global accessibility/typography invariant unrelated to the token system itself; the token tests stayed green while this cross-cutting contract broke"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0566]
---

**Situation:** a redesign replaced `globals.css` wholesale with a new design system's token
declarations. The new file's own test suite (token values, contrast, etc.) passed, but a global rule
that had nothing to do with the token system itself — `font-variant-numeric` set on `html`, a
typography/accessibility invariant — was silently dropped because it lived in the same file being
replaced wholesale rather than being recognized as a separate, cross-cutting contract.

**Lesson:** `globals.css` (or any single "global stylesheet" file) is often a bag of UNRELATED
contracts — design-system tokens, yes, but also global typography/accessibility rules that have nothing
to do with the token system and are not covered by the token suite's tests. A wholesale file replacement
during a redesign treats everything in that file as "the old design system" and discards it together,
even the rules that were never part of the thing being redesigned. Green tests for the NEW token system
prove the tokens are correct; they say nothing about whether unrelated global invariants the OLD file
also carried survived the swap.

**Apply next time:** before replacing a global stylesheet wholesale during a redesign, diff the OLD
file's full rule set against the NEW one and explicitly classify each rule as "superseded by the new
design system" vs "an unrelated global invariant that must be carried forward" (typography resets,
accessibility properties, print rules, etc.) — don't assume the new system's own green test suite
proves nothing outside its own scope was lost.
