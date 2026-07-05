---
id: LESSON-0081
type: gotcha
domain: react
tags: [react, modal, transition, unmount, css-transition, lightbox]
context: implementing a React modal/lightbox that needs a CSS close (exit) transition, and that must keep showing its last content while that transition plays
trigger: use this when a React modal/dialog/lightbox needs an animated close transition, or must persist "last shown content" through that transition
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-0x (pre-2026-07-04 drain) — Lightbox exit-transition + last-content-during-close fix"
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0019, LESSON-0062, LESSON-0065]
---

**Situation:** a React modal/lightbox needed a CSS close (exit) transition. The naive `if (!isOpen)
return null` pattern unmounts the component instantly on close — there is no frame left to animate,
so the exit transition never plays. Separately, the lightbox also needed to keep showing its last
displayed item while the close transition played, and using index `0` as a sentinel for "never
opened yet" collided with `0` being a legitimately valid item index.

**Lesson:** an unmount-based conditional render (`return null` when closed) is incompatible with a CSS
exit transition — animating a close requires the element to still be in the DOM while the transition
plays. Separately, "is open" and "last shown content" are two different pieces of state and conflating
them (e.g. reusing a content index as an open/closed sentinel) produces a subtle bug when index `0` is
valid content.

**Apply next time:**
1. Keep the modal/lightbox component always mounted once it has been opened at least once; toggle an
   `.open` class + `aria-hidden` to drive the CSS transition instead of conditionally rendering it away.
2. Gate the FIRST mount at the call site with a `hasOpened` flag so there is no eager resource fetch
   (e.g. `next/image`) before the user ever opens it (compounds LESSON-0062: `next/image` lazy-loading
   inside a modal that's never been visible never fires).
3. Track a separate `lastIndex`/`lastItem` state distinct from the `isOpen` boolean when the closed
   transition must keep showing the last content — never reuse a content index/id as a sentinel for
   "nothing shown yet" if that index/id is itself a valid value (e.g. `0`).
