---
id: LESSON-0077
type: anti-pattern
domain: data-modeling
tags: [single-source-of-truth, derived-state, dr-092, dr-085, dashboard]
context: more than one UI surface independently deriving the same cross-cutting count/status (e.g. "how many things are launched/shipped") from a source record that has more than one path to the same conceptual answer
trigger: use this when a new surface needs to count/derive a fact that already has an existing bridge rule spanning more than one underlying state field (e.g. a status enum PLUS a separate phase field that both mean "done" under different conditions)
source: "panda-corp Mission Control — Pulso showed 0 launched while Logros showed 2, both reading idea-card status alone and missing the DR-085 bridge (project phase=release also counts as launched); fixed via a single countLaunched resolver, 2026-07-02"
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
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
