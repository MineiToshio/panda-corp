---
id: LESSON-0333
type: pattern
domain: responsive-design
tags: [mobile, composition, viewport, touch, overflow]
context: the owner/a reviewer reports "it doesn't fit on mobile when scrolling" but emulated-viewport checks show zero page overflow
trigger: use this when a "broken on mobile while scrolling" complaint arrives but desktop-tooling emulation shows no page overflow at the reported width
source: "pandasaga .pandacorp/run/lessons.md 2026-10-13 (agent-inferred): mobile 'doesn't fit' complaints traced to in-page horizontal-scroll frames (maps, graphs, tables) and desktop-height cards feeling broken on touch, not to a CSS overflow bug"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0047]
---

**Situation:** the owner reported the app "doesn't fit on mobile when scrolling." Emulated-viewport
checks (375px, no overflow flags) came back clean, which looked like the complaint was unfounded — but
it wasn't: the real problem was COMPOSITION, not a CSS bug. In-page horizontal-scroll frames (a map, a
relationship graph, a data table) and desktop-sized tall cards feel wrong on an actual touch device even
though nothing technically overflows the viewport.

**Lesson:** "zero page overflow" only rules out one failure mode (content wider than the viewport). It
does not rule out the much more common mobile complaint: a layout composed of nested horizontal-scroll
regions, or cards/components sized for desktop interaction, which read as broken under touch even when
no box technically overflows. Also, most emulators default to a mouse-pointer, no-touch context and a
375px width — neither matches a real small/touch device closely enough to surface this class of problem.

**Apply next time:** when a "doesn't fit/feels broken on mobile while scrolling" report survives a clean
overflow check, look for in-page horizontal-scroll frames and desktop-height cards first. Fit visual
content (maps, graphs) to width with numbered markers plus a matching list instead of scroll-inside-
scroll, stack tables per row, and compact card rows. Always re-test with `isMobile`/`hasTouch` enabled
and at 320px as well as 375px, not only a bare desktop-emulated viewport.
