---
id: LESSON-0334
type: gotcha
domain: frontend-interaction
tags: [dialog, lightbox, dom-state, suppression, a11y]
context: a shared content-suppression/moderation check inspects the live DOM for a piece of content (e.g. an image) that was shown in a now-closed `<dialog>`/lightbox
trigger: use this when a shared suppression/visibility check scans the DOM and a `<dialog>` or lightbox element is part of the surfaces it scans
source: "pandasaga .pandacorp/run/lessons.md 2026-10-13/14 (agent-inferred): a reader-suppressed image stayed in the DOM inside a closed lightbox `<dialog>` and failed a shared-suppression check that scanned all rendered elements"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a spoiler/content-suppression check scanned the DOM for elements that should have been
hidden. A `<dialog>`-based lightbox that had shown a now-suppressed image, then been closed, still
reported the image in its `innerHTML` — the check flagged it as a leak even though the dialog was
visually closed and inert.

**Lesson:** closing a `<dialog>` element (`close()`, removing the `open` attribute) does not clear its
contents — the last-rendered `innerHTML` stays in the DOM, invisible but present, and any check that
walks the DOM for a piece of content (not just visually-rendered content) will still find it. This is a
real correctness gap, not a tooling false signal: a closed dialog is a latent copy of whatever it last
showed.

**Apply next time:** clear a dialog's content (reset its inner markup, or unmount the component backing
it) on its `close` event, not only on next-open — never assume closing == content gone. Any shared
suppression/visibility scan that walks the DOM should also account for this, or scope itself to elements
that are both present AND visually rendered (not merely non-`display:none`).
