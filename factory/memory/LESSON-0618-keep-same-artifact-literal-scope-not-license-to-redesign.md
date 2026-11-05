---
id: LESSON-0618
type: anti-pattern
domain: content-generation-qa
tags: [scope-discipline, instruction-following, html-generation, review-artifact, template]
context: a worker is asked to edit/regenerate a review or display artifact while the owner explicitly says to keep the existing design ("usa el mismo HTML" / "keep this as is") and only change a narrow, named thing
trigger: use this when briefing or reviewing a worker's edit to an existing HTML/UI artifact where the owner's instruction is "keep the same design, just change X" — before accepting the output, check it didn't substitute a different template or restyle anything beyond X
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-04 (owner-stated): the owner said 'usar el mismo HTML' (keep the existing design) for a review-HTML artifact; a worker instead swapped in another stop's template and redesigned the item cards"
provenance: owner-stated
created: 2026-11-05
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0451, LESSON-0011]
---

**Situation:** the owner asked for a review-HTML artifact to keep its existing design ("usar el mismo
HTML") while making a narrow, specific edit. The worker instead substituted a different stop's template
for the item cards and redesigned them — a much broader change than requested, and NOT the design the
owner had already approved.

**Lesson:** "keep the same HTML/design" is a scope-limiting instruction, not a loose preference — it
constrains the edit to exactly what else was asked, the same way an explicit "don't touch the rest"
constrains a batch auto-apply rule (LESSON-0451) or a canonical prototype anchors fidelity checks
(LESSON-0011). A worker generating or editing a review/display artifact can drift into "while I'm in
here, this looks better" territory — reusing a template from elsewhere or restyling components — even
when the brief never asked for that. This drift is invisible to a quick glance if the new version still
"looks fine" on its own; it only surfaces when compared against the artifact the owner actually approved.

**Apply next time:** when briefing a worker to edit an existing HTML/review/display artifact under a
"keep the same design" instruction, state the edit as a literal, minimal diff (what exactly changes,
and that everything else — markup structure, card template, styling — must be byte-for-byte or
visually identical to the prior approved version). When reviewing the output, diff it against the prior
approved artifact first, not just against the new requirement — a worker swapping in an unrelated
template or redesigning untouched elements is a scope violation even if the result looks acceptable in
isolation.
