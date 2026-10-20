---
id: LESSON-0322
type: pattern
domain: ui-filters
tags: [filters, combobox, chips, facets, forms]
context: designing a filter UI for a facet with many possible values (10+ options), where a tall checkbox stack would dominate the filter rail
trigger: use this when a filter/facet rail needs to support a long list of selectable values (formats, stores, variants, tags) and a tall checkbox stack is the default instinct
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated, referencing an established pattern from a sibling project — \"PandaTrack pattern\"): long filter facets (formats, stores, variants) were redesigned as multi-select comboboxes with autocomplete and accumulated removable chips instead of tall checkbox stacks; the rail height dropped sharply (from ~1466px to ~599px in this project), and the owner explicitly asked for no sticker/thumbnail imagery inside the filter options themselves to keep the list scannable"
provenance: owner-stated
created: 2026-10-15
status: active
promotion: none
confidence: medium
times_applied: 1
applied_in: [funko-tracker]
links: []
---

**Situation:** a filter rail had several facets (format, store, variant) each with 10+ possible
values. Rendered as checkbox stacks, the rail grew very tall and pushed the actual content down,
cluttering the page. Switching those facets to multi-select comboboxes with autocomplete and
accumulated removable chips collapsed the rail to a fraction of its height while keeping full
selection capability.

**Lesson:** a tall checkbox stack does not scale past roughly a handful of options per facet — it
costs vertical space proportional to the number of options regardless of how many are actually
selected. A multi-select combobox with autocomplete (type to narrow, select, see a removable chip for
each active selection) costs a small fixed height regardless of how many options the facet has, and
scales to facets with many more values than checkboxes ever could. Keep the combobox's own option
list plain text — decorative imagery per option adds noise without aiding scanning/typing-to-filter.

**Apply next time:** for any filter/facet with more than a handful of possible values, default to a
multi-select combobox with autocomplete and removable chips rather than a checkbox stack; reserve
checkbox stacks for facets with only a few, always-visible-at-a-glance options.
