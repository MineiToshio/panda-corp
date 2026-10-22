---
id: LESSON-0482
type: gotcha
domain: css
tags: [css, focus-within, hover, sidebar, keyboard-focus]
context: a collapsible icon rail/sidebar that expands on hover, implemented with `:focus-within` on a wrapper so keyboard users can also open it
trigger: use this when a collapsible icon rail or sidebar opens on hover AND needs keyboard accessibility, and the natural implementation reaches for `:focus-within` on the wrapper
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — Orbita's collapsible icon rail"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0363]
---

**Situation:** a collapsible icon rail opened on hover via `:focus-within` on its wrapper, so that
keyboard tabbing into the rail would also expand it. After a mouse click on the rail's own toggle
button, the rail stayed stuck open even once the pointer moved away, because the clicked button
retained DOM focus and `:focus-within` is satisfied by ANY focused descendant regardless of input
modality.

**Lesson:** `:focus-within` cannot distinguish "focused because of a mouse click" from "focused because
of keyboard navigation" — a button keeps focus after being clicked, so a hover-style rail built on
`:focus-within` alone gets permanently pinned open by ordinary mouse interaction, defeating its own
hover-to-preview behavior for mouse users while still working for the keyboard case it was meant for.

**Apply next time:** drive the hover-expand behavior from pointer events (`:hover`, or a pointer-driven
class) and reserve `:focus-within`/`:focus-visible` scoping for the keyboard path only — e.g.
`:has(:focus-visible)` on the wrapper — so a mouse click on the toggle does not leave the rail open once
the pointer leaves.
