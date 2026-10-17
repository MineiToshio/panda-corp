---
id: LESSON-0370
type: gotcha
domain: react
tags: [disclosure, aria-expanded, aria-label, accessibility, menu]
context: implementing a disclosure/menu component (open/close toggle) whose accessible name changes depending on its open/closed state
trigger: use this when a disclosure/menu toggle's accessible label text changes between its open and closed states (e.g. "Open menu" vs "Close menu")
source: "factory/memory/_inbox.md agent-inferred note — Mission Control visual prototype, 2026-10-17: testing Escape against the disclosure's accessible name found that closing the menu updated aria-expanded but left aria-label stuck at \"Cerrar\" (Close)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a disclosure/menu component correctly updated `aria-expanded` to `false` when closed via
Escape, but its `aria-label` stayed at the OPEN-state text ("Cerrar"/"Close") — the two pieces of state that
together describe the control (its expanded/collapsed boolean and its human-readable label) were updated by
different code paths and drifted out of sync on at least one close path.

**Lesson:** a disclosure's open/close contract has at least three parts that must change TOGETHER on every
transition — visibility of the controlled content, the accessible label describing the current action, and
where keyboard focus lands — and it is easy to wire one transition path (e.g. a click handler) to update all
three while another path (e.g. an Escape-key handler) only updates one of them.

**Apply next time:** when implementing or testing any open/close toggle whose label text depends on state,
route EVERY close path (click-away, Escape, programmatic close) through the same single state-transition
function that updates visibility, `aria-expanded`/`aria-label`, and focus together — never let a keyboard
shortcut or an alternate close trigger bypass the function that keeps them in sync. Test every close
trigger, not just the primary click path.
