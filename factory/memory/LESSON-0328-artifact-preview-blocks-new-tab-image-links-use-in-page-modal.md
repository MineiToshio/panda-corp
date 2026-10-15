---
id: LESSON-0328
type: gotcha
domain: design-verification
tags: [claude-artifact, image-preview, new-tab, modal]
context: providing a "view/open full-size image" affordance inside a mockup/prototype that will be reviewed through a claude.ai Artifact link
trigger: use this when a mockup/prototype needs a "view full size"/"open image" affordance for a generated or exported image, and it is about to be implemented as a plain link opening in a new browser tab
source: "funko-tracker .pandacorp/comms/iteration.md ronda 23 + .pandacorp/run/lessons.md 2026-10 harvest (owner-stated): a \"open in full size\" link intended to open a generated image in a new browser tab did not work inside the claude.ai Artifact viewer, which blocks that navigation; the fix was an in-page zoomable modal instead"
provenance: owner-stated
created: 2026-10-15
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a prototype needed a way to let the owner view a generated/exported image at full
resolution. The first implementation used a plain anchor link opening the image in a new browser tab.
Inside the claude.ai Artifact viewer (where the prototype is actually reviewed), that navigation was
blocked — the link did nothing.

**Lesson:** the claude.ai Artifact preview environment does not behave like a normal browser tab for
outbound navigation — a link meant to open content in a new tab can simply be blocked, with no visible
error, inside that sandbox. Any "view full size" / "open externally" affordance built for content that
will be reviewed through an Artifact link needs to work WITHOUT relying on new-tab navigation.

**Apply next time:** for any "view/open full size" control on an image (or similar content) inside a
prototype that will be previewed via a claude.ai Artifact, implement it as an in-page zoomable modal
rather than a `target="_blank"` link — it works identically inside the Artifact sandbox and in a normal
browser.
