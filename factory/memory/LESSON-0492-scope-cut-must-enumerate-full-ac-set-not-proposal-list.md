---
id: LESSON-0492
type: gotcha
domain: factory-engineering
tags: [design-skill, scope-decision, acceptance-criteria, owner-gate]
context: presenting the owner a scope-cut decision for a redesign ("drop what the new prototype doesn't draw") based on a curated short list rather than the full acceptance-criteria set
trigger: use this before asking the owner to confirm a scope cut ("features the new prototype doesn't draw stay out") during a design-freeze/redesign reconciliation
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — Mission Control v2 design freeze"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [BL-0270]
---

**Situation:** an owner scope decision ("features the prototype doesn't draw stay out of v2") was framed
around a six-item list drawn from the redesign proposal document. Once the freeze's own context packs
enumerated every acceptance criterion from the actual FRDs, dozens of undrawn ACs turned up — including
features already built AND verified in the live product (a snapshot panel, a global accounts directory,
a pending-merges indicator).

**Lesson:** a redesign proposal document is a PITCH, not an inventory — it names the highlights the
proposal's author thought to mention, not the complete set of acceptance criteria the live FRDs actually
commit to. Asking the owner to confirm a scope cut against that short list silently risks cutting
already-shipped, verified functionality the proposal simply never mentioned, because the owner is
confirming against an incomplete menu without being told it's incomplete.

**Apply next time:** before presenting ANY "drop what isn't drawn" scope decision, enumerate the full
undrawn set mechanically from the FRDs' own acceptance criteria (not from a proposal/brief's illustrative
list), and flag any undrawn item that is ALREADY built-and-verified in the live product as a distinct,
higher-stakes line in the owner's confirmation — don't let it ride silently inside a generic "ungrouped
gap" bucket.
