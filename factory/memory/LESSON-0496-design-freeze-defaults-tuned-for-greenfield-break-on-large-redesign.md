---
id: LESSON-0496
type: pattern
domain: factory-engineering
tags: [design-skill, design-freeze, redesign, scale, reflection]
context: running the design-freeze step of the design skill against a REDESIGN of an already-shipped, large, possibly-public app, rather than the greenfield small-prototype scale the step's defaults were tuned against
trigger: use this before running (or scoping/time-boxing) a design-freeze pass on a redesign of an existing, already-shipped app — especially one with many UI FRDs or a public repo — rather than a greenfield prototype
source: "synthesis of LESSON-0491, LESSON-0492, LESSON-0493, LESSON-0494 — all four surfaced during the same event, the Mission Control v2 Orbita redesign's design-freeze pass, 2026-10-21/22 (mission-control .pandacorp/run/lessons.md, agent-inferred)"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0491, LESSON-0492, LESSON-0493, LESSON-0494, BL-0269, BL-0270, BL-0271, BL-0272]
---

**Situation:** four distinct, independently-discovered gaps surfaced during ONE design-freeze pass on
Mission Control's v2 (Orbita) redesign: the per-FRD worklist silently dropped an untouched FRD because it
enumerated from a downstream artifact instead of the FRDs' own `ui: true` flag (LESSON-0491); the owner's
scope-cut confirmation was framed against the redesign proposal's short illustrative list instead of the
full acceptance-criteria set, risking cutting already-shipped verified features (LESSON-0492); the
freeze's time-box, tuned against a ~5-FRD greenfield prototype, blew ~5x over against 21 FRDs/159 states
(LESSON-0493); and the freeze's default of capturing real project data into the committed fidelity oracle
is a privacy leak the moment the repo is public (LESSON-0494).

**Lesson:** none of these four is really about the specific mechanism it names (an enumeration source, a
scope list, a time budget, a data-capture default) — all four are the SAME root cause wearing different
clothes: the design-freeze step's defaults were derived from, and validated against, a greenfield
small-prototype project (private repo, handful of FRDs, nothing pre-existing to reconcile against). Every
one of those assumptions — "the downstream state config has everything," "the proposal doc names
everything in scope," "a batch this size fits the time-box," "rendering real data is safe" — holds for
that calibration case and silently breaks for a REDESIGN of a large, already-shipped, possibly-public app,
because a redesign adds exactly what a greenfield build doesn't have: pre-existing shipped scope to
reconcile against, FRD counts an order of magnitude larger, and (sometimes) a public history. None of the
four failures threw an error — each one looked like the step working normally.

**Apply next time:** before running a design-freeze pass, explicitly classify the target as "greenfield
prototype" vs. "redesign of an existing, already-shipped app," and when it's the latter, treat every
freeze default as suspect, not just apply it: re-derive the worklist from source flags/frontmatter (not
downstream artifacts), enumerate scope cuts from the FRDs' own ACs (not a proposal doc), scale the
time-box and batch-splitting by FRD/state count, and check repo visibility before any real-data capture.
This is exactly the kind of pattern the `design` skill itself should absorb as a standing
"redesign-of-a-large-app" mode — see the linked BL-0269..0272 for the per-mechanism fixes this reflection
generalizes.
