---
id: LESSON-0706
type: gotcha
domain: review-tooling
tags: [deliverable-format, sandboxed-session, contact-sheet, html, chat-review]
context: choosing the output format of a before/after or multi-item review artifact that the owner will open through the chat session itself (not a deployed app or a shared drive)
trigger: use this when an agent generates a review deliverable (before/after comparison, a batch of results, a diff) that the owner will open directly from the session/working folder rather than from a deployed app
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-20 (owner-stated): the owner reviews photo deliveries as ONE PNG contact sheet (antes/despues), not per-run HTML; the chat app cannot open an HTML file outside the session folder"
provenance: owner-stated
created: 2026-11-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0261, LESSON-0621, LESSON-0651]
---

**Situation:** a pipeline generated a per-run HTML page as the review deliverable for a before/after
photo comparison. The owner could not actually open it from the chat session he was reviewing in — the
chat tool's file viewer only renders files inside the session's own working folder as inline images, not
arbitrary HTML pages, so the deliverable was effectively unreachable from where the review was happening.

**Lesson:** the review SURFACE constrains the deliverable FORMAT, and that constraint is easy to miss
because an HTML report looks like a perfectly reasonable, even richer, choice when authored and tested in
isolation. When the reviewer will open the deliverable through a chat/agent session rather than a
deployed app or a file manager, assume only flat, directly-renderable image formats (PNG/JPEG) are
reliably viewable — an HTML file (or any format needing a browser navigation/open action outside the
session's own folder) may simply not open from there. This is the same "review surface decides what the
reviewer can actually judge" shape as the existing contact-sheet lessons (LESSON-0621/0651), one level up:
before worrying about what the sheet should contain, first confirm the sheet's FILE FORMAT is one the
review surface can open at all.

**Apply next time:** before building a review/comparison deliverable (before/after, a result batch, a
diff), confirm how the reviewer will actually open it. If the review happens inside a chat/agent session
(not a deployed app, not a shared drive opened in a real browser), default to a single flat image
(e.g. one PNG contact sheet combining the before/after or the batch) rather than an HTML report or any
format requiring a separate browser/open step outside the session's working folder — and ask the owner
how they want to review it rather than assuming a richer format is automatically better.
