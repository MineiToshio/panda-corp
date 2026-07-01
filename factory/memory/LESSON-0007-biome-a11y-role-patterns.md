---
id: LESSON-0007
type: pattern
domain: react
tags: [biome, a11y, react, aria, role, semantic-html]
context: recurring Biome accessibility-lint traps hit repeatedly while building Mission Control's UI (React + Tailwind, biome 2.5)
source: mission-control lessons.md — WO-01-003, WO-12-004, WO-18-003, WO-02-007, WO-09-006, WO-06-... (2026-06-16 through 2026-06-18); the same trap recurred at least 5 times across different components/work orders
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: none
confidence: high
times_applied: 0
links: []
---

**Situation:** Building Mission Control's UI, the same handful of Biome accessibility-lint rejections
(`useAriaPropsSupportedByRole`, `useSemanticElements`, `useFocusableInteractive`,
`noNoninteractiveElementToInteractiveRole`) recurred independently across at least 5 different components
and work orders over 3 days, each time re-discovered from scratch.

**Lesson (the recurring rule set, Biome 2.5 + React):**
1. **`aria-label` on a plain `<span>`/`<div>` with no ARIA role is a hard Biome error**
   (`useAriaPropsSupportedByRole`). Either add `role="status"` (for a live-region badge that needs an
   accessible label) or drop the `aria-label` and let visible text carry the semantics via `title=` for a
   tooltip.
2. **`role="group"` on a `<div>`/`<span>` pushes Biome to demand `<fieldset>`** (`useSemanticElements`) —
   `fieldset` is for form groups, not visual/decorative groupings. For a non-interactive decorative
   grouping whose meaning is already in visible text, drop the role entirely and use `title=`.
3. **`role="treeitem"`/any interactive ARIA role on a `<div>` requires `tabIndex={0}`**
   (`useFocusableInteractive`) — any element given an interactive role must be keyboard-reachable.
4. **`<nav role="tablist">` is rejected** (`noNoninteractiveElementToInteractiveRole` — `<nav>` is a
   landmark, not a tablist container). Use `<div role="tablist">` for tab bars. Same for
   `<li role="button">` — wrap a real `<button>` inside the `<li>` instead.

**Apply next time:** Before adding an ARIA role/label to a non-semantic element, check this rule set
first — it is the dominant class of a11y lint churn in a React+Tailwind+Biome project. Candidate for
`promotion: proposed` into `factory/standards/` (a per-stack a11y quick-reference) given the recurrence
count within a single project.
