---
id: LESSON-0077
type: anti-pattern
domain: data-modeling
tags: [single-source-of-truth, derived-state, dr-092, dr-085, dashboard]
context: more than one UI surface independently deriving the same cross-cutting count/status (e.g. "how many things are launched/shipped") from a source record that has more than one path to the same conceptual answer
trigger: use this when a new surface needs to count/derive a fact that already has an existing bridge rule spanning more than one underlying state field (e.g. a status enum PLUS a separate phase field that both mean "done" under different conditions)
source: "panda-corp Mission Control — Pulso showed 0 launched while Logros showed 2, both reading idea-card status alone and missing the DR-085 bridge (project phase=release also counts as launched); fixed via a single countLaunched resolver, 2026-07-02. Corroborated on a SECOND, distinct project (pandasaga, .pandacorp/run/lessons.md, 2026-10-14, agent-inferred) with the same root cause in a different concrete shape: (1) a reading-unit numbering scheme (prologue 0.5, interlude 5.5, encoded as fractional points to keep one gating rule) correctly resolved its own gate internally, but any UI surface that printed the raw point number directly leaked it (\"Número 5.5\") instead of a human label, because printing was not routed through a shared naming/formatting function; (2) a display MODE that changes how numbers read (a two-volume edition) was implemented only where it was first built (one dialog) — the band, toast and library surfaces kept the old numbering because none of them called through the same resolver."
provenance: agent-inferred
created: 2026-07-05
status: active
promotion: proposed   # 2026-10-15 (librarian review) — target: factory/standards/data-modeling.md (or patterns.md's review checklist), add as a corollary to DR-092's "compute a shared derived value once": whenever a value is BOTH an internal encoding/gating state AND rendered/derived on more than one UI surface, route every render/count/derivation site through one shared resolver/formatter — multi-field bridges (a status enum plus a separate phase field) and mode-dependent display values (an edition-dependent numbering scheme) are the two concrete shapes seen so far, and a regression check on a surface far from where the feature was first built is the cheapest way to catch the gap. Corroborated across 2 distinct projects (panda-corp/mission-control origin; pandasaga, independent occurrence in a different concrete shape) with zero contradicting evidence.
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** two dashboard surfaces (a KPI summary and an achievements/funnel view) each independently
counted "launched" projects by reading only idea-card `status`. Neither counted a card that stays frozen
at `in-pipeline` (by design, DR-085) whose linked project actually reached `phase: release` — a real
launch that the card-status-only count silently missed. The two surfaces disagreed (0 vs 2) because only
one of them had separately, ad hoc, added the phase-based half of the logic.

**Lesson:** when a durable state model has a documented BRIDGE rule spanning two fields (a card's frozen
`status` plus a project's live `phase`, DR-085's "in-pipeline card + release phase ⇒ launched"), any count
or derivation of that concept must go through ONE shared resolver that implements the whole bridge — never
just the status field, and never re-derived ad hoc per surface. This is the general form of the
component-inventory / single-derived-value principle (DR-092: compute a shared derived value once, consume
it everywhere) applied specifically to a MULTI-FIELD bridge, which is easier to under-implement than a
single field because it's tempting to read only the "obvious" half.

**Apply next time:** before adding a new surface that counts/derives a concept governed by a documented
bridge rule between two state fields, locate (or create) the single resolver that implements the full
bridge and call it — never re-read just one of the two fields directly.

**Corroborated in a broader form (pandasaga, 2026-10-14):** the same failure reproduces for ANY derived
or mode-dependent DISPLAY value with more than one read/render surface, not only multi-field bridge
counts. A raw internal encoding (a fractional "point" number) that is correct for gating but not meant
for display leaked verbatim wherever a surface printed the number directly instead of calling a shared
naming function; and a display mode that changes how a value is formatted (an edition-dependent
numbering scheme) was wired into only the ONE surface where the feature was first built, leaving every
other surface (a status band, a toast, a library list) silently out of sync. The general form of this
lesson: whenever a value is both an internal encoding/state AND something read/rendered on more than one
surface, route EVERY render site through one shared resolver/formatter, and when introducing such a
value, grep for every place that currently prints the raw equivalent before shipping. Add a regression
check on a surface deliberately far from where the feature was first built, since that is where the gap
reliably hides.
