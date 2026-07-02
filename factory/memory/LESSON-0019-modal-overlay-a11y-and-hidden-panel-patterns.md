---
id: LESSON-0019
type: pattern
domain: react
tags: [a11y, modal, tabs, testing-library, biome, accessibility]
context: implementing accessible modal overlays and tabbed panels (visually-hidden-but-mounted) in React while satisfying both Biome's a11y lint and Testing-Library query contracts
trigger: use this when implementing a modal overlay or always-mounted tab panels in React under Biome a11y lint and Testing-Library role queries
source: mission-control lessons.md — WO-02-006 (modal overlay, 2026-06-16), WO-02-007 (tabbed shell restructure, 2026-06-18)
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: [LESSON-0007]
---

**Situation:** Two related React+a11y patterns recurred while building Mission Control's modal and tab
surfaces.

**Lesson:**
1. **Modal overlay double-close trap:** clicking the modal panel itself must not also fire the backdrop's
   close handler via event bubbling. Put `onClick` with `stopPropagation` on the panel and a separate
   backdrop `<div>` with its own close handler. Biome's `useKeyWithClickEvents` fires on the backdrop div
   even though keyboard close is already handled via a `document.addEventListener("keydown")` effect —
   suppress with a `biome-ignore` citing that effect (a legitimate, documented exception, not a lint
   evasion).
2. **Always-mounted tab panels:** hiding inactive tab panels with `display:none`/`visibility:hidden`
   removes them from the accessibility tree, which breaks existing `getByRole()`-based RTL tests (RTL
   excludes a11y-inaccessible elements). The "visually hidden but accessible" CSS clip technique
   (`position:absolute; clip:rect(0,0,0,0); width/height:1px`) keeps all panels in the a11y tree while
   visually hiding them — use this whenever tab panels must stay mounted (e.g. to preserve state or
   existing test contracts) rather than conditional rendering.

**Apply next time:** For a modal, use panel-stopPropagation + separate backdrop click, not a single
shared handler. For always-mounted tab panels, use the visually-hidden clip technique instead of
`display:none` if RTL tests query panels by role.
