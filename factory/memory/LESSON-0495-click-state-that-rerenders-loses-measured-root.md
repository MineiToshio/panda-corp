---
id: LESSON-0495
type: gotcha
domain: factory-engineering
tags: [design-skill, fidelity-measurement, playwright, click, state-simulation]
context: configuring a component state for the design-freeze fidelity measurement toolkit, where the state is reached via a `click` action
trigger: use this when authoring a `fidelity.config.json` component state that a `click` action is meant to reach, especially when that click causes the page to re-render
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — Mission Control v2 design freeze"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** the design-freeze fidelity config's measurement targets are resolved once, against the
DOM at the moment a state's root is located. A component state configured with a `click` action that
triggers a page re-render invalidated that already-resolved root — the measurement then ran against a
stale/detached reference instead of the new DOM.

**Lesson:** a click-based state-reaching action is unsafe for the fidelity measurement toolkit
specifically when the click causes a re-render, because the toolkit resolves its measured root BEFORE
running the action, and a re-render replaces the DOM the root pointed at — there is no automatic
re-resolution built in.

**Apply next time:** when a component state is reached by an interaction that re-renders the page (a
toggle, a tab switch, an expand/collapse), simulate the resulting DOM state directly via an attribute or
class action (`attr`/`cls` — e.g. setting `aria-pressed`, `aria-checked`, or a focus class) instead of a
`click` action, so the measured root resolves against the final DOM rather than an intermediate one that
gets replaced.
