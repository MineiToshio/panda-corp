---
id: LESSON-0275
type: pattern
domain: content-generation
tags: [editorial-review, voice, formatting, scannability, red-team]
context: reviewing an AI-drafted or hand-drafted piece of prose and deciding whether to flag/strip a formatting choice (bold list labels, a blockquote, emphasis) that reads as unconventional but is not itself wrong
trigger: use this when an editorial review is tempted to normalize or strip a working formatting device because it doesn't match a mental template of "plain" style
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-29, owner-stated — short bold labels in list items help a reader scan a post and can coexist with blockquotes; an editorial review should preserve voice and fix concrete defects, not strip useful formatting for rigidity. Reflected in docs/voice/style-guide.md (2026-09-29)."
provenance: owner-stated
created: 2026-10-01
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0206, LESSON-0251, LESSON-0240]
---

**Situation:** a review pass considered flattening a post's formatting (bold labels on list items,
alongside a blockquote elsewhere) toward a more uniform/plain style. The owner clarified these devices
coexist fine and genuinely help a reader scan the piece — the review's job was never to enforce a single
formatting template.

**Lesson:** an editorial review exists to find and fix CONCRETE, falsifiable defects (an ambiguous
reference, a broken antecedent, an AI-tell construction, a narrative-coherence gap per LESSON-0251) — not
to impose stylistic uniformity by removing a formatting choice simply because it is unconventional or
doesn't match the reviewer's default template. "This isn't how I'd normally format it" is not, by itself,
a defect.

**Apply next time:** before flagging or stripping a formatting device (bold labels, a blockquote,
emphasis, a callout) during review, name the CONCRETE failure it causes (ambiguity, a broken reference,
an inconsistency with a stated rule) — if none exists and the device reads fine, leave it. Reserve edits
for named, falsifiable defects, never for "doesn't match my default template."
