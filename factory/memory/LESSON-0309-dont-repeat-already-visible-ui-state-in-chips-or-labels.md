---
id: LESSON-0309
type: pattern
domain: ux-patterns
tags: [filters, redundant-state, information-density, chips]
context: deciding whether to show a summary chip/label (an "applied filters" chip, a scope/count badge, a "results for X" line) alongside a filter/control rail that is already visibly showing the same state
trigger: use this when a filtered-list or filtered-catalog UI is about to add a chip/badge/label that restates a filter or scope value already visible in a persistent control (a filter rail, a checked checkbox, a visible search box)
source: "funko-tracker .pandacorp/comms/iteration.md ronda 4, 2026-10 (owner-stated): a catalog screen showed an 'applied filters' chip row AND a scope chip with counts AND a 'resultados para X' line right under the search box, while the filter rail showing the exact same checked state was simultaneously visible; the owner called it 'cargado' (cluttered)"
provenance: owner-stated
created: 2026-10-13
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a filtered catalog screen simultaneously showed: a persistent filter rail with
checked/active filters, a separate "applied filters" chip row restating those same filters, a scope chip
with counts, and a "results for X" line echoing the active search term — all visible at once. The owner's
reaction was that it felt cluttered/overloaded.

**Lesson:** when the UI already has a persistent, always-visible representation of a piece of state (a
filter rail showing checked boxes, a visible search input holding the typed query), adding a SEPARATE
chip/badge/label that restates the same state adds visual weight without adding information — it is
redundant, not reinforcing. The redundancy is often introduced piecemeal (one chip here for clarity, one
badge there for count) without noticing the rail already says the same thing.

**Apply next time:** before adding a chip/badge/label that echoes current filter/search/scope state,
check whether that state is ALREADY continuously visible elsewhere on screen (a rail, a checked box, a
filled search field); if so, suppress the redundant chip in that context and reserve it only for contexts
where the primary state display is hidden (e.g. a collapsed mobile filter sheet).
