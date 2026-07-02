---
id: LESSON-0011
type: gotcha
domain: design-fidelity
tags: [prototype, fidelity, design, mocks, canonical-source]
context: when multiple prototype mocks exist for the same screen/feature (an older one and a newer canonical one), a build anchors fidelity to the wrong one
trigger: use this when building or reviewing fidelity against a prototype mock and more than one mock file exists for the same screen
source: mission-control lessons.md — CampaignPipeline built faithful to la-campana.html (stone-bridge PNGs, no roam) when the current canonical prototype was party-pipeline.html (CSS roads, roaming cast), 2026-06-2x
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: [LESSON-0002]
---

**Situation:** Mission Control's `CampaignPipeline` component was built pixel-faithful to an OLD mock
(`la-campana.html` — stone-bridge PNG assets, static layout) while the actual current, owner-approved
prototype for that screen was `party-pipeline.html` (CSS-drawn roads, a roaming cast). The build passed its
fidelity gate because it matched *a* prototype file — just not the one that was canonical at build time.

**Lesson:** "Faithful to the prototype" is only a meaningful gate criterion when there is exactly one
unambiguous canonical prototype per screen. When a design iterates and produces multiple mock files for
the same screen over time, an agent (or a fidelity reviewer) that finds *any* matching mock can silently
anchor to a stale one — the gate stays green while the build diverges from what the owner actually
approved most recently.

**Apply next time:** Before judging or building to a mock, verify which mock file is the CURRENT canonical
reference for that screen (check the FRD's `mocks/` pointer or the most recent design decision-log entry,
not just "a file that looks like this screen exists"). When redesigning a screen, retire/mark superseded
mocks so they can't be picked up by mistake, or record the canonical pointer explicitly in the FRD.
