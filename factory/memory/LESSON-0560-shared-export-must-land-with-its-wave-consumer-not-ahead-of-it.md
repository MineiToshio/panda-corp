---
id: LESSON-0560
type: gotcha
domain: build-engine
tags: [knip, dead-code, shared-module, multi-wave, work-orders, unused-export]
context: a multi-wave build lands a shared primitive (a constant, type, or wrapper component) in one work order before the work order that actually consumes it has landed
trigger: "use this when adding a new shared constant/type/wrapper that a LATER work order (a different wave) will consume, or when knip goes red on a newly-added export with zero current importers"
source: "mission-control factory/memory/_inbox.md 2026-10-30 (agent-inferred) — two notes from the same build: a knip fix-forward where knip rejected exports of primitives with no consumers yet, fixed by keeping constants/aux types local and retiring unused wrapper exports; and an exported wrapper for a later-wave consuming WO left knip red in the intermediate tree, fixed by landing the wrapper together with its consumer"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0278, LESSON-0266]
---

**Situation:** two related incidents in the same multi-wave build: (1) knip flagged exported
constants/auxiliary types as unused because the work order that would consume them had not landed yet;
(2) an exported wrapper component built for a later-wave consumer left the intermediate tree (the state
after the producing WO lands but before the consuming WO does) with a knip-red "unused export". Both are
the mirror image of LESSON-0278's family (a shared module's correct shape tracks its LIVE consumer
count) — but here the count is rising from zero as a multi-wave plan stages work across WOs, not falling
from two to one after a code change.

**Lesson:** knip (and any dead-code linter) only sees the CURRENT tree, never the plan — a primitive
exported ahead of the WO that will actually import it is indistinguishable from genuine dead code at the
moment it lands, and nothing automated knows a later wave will use it. Two concrete fixes apply depending
on whether the export is strictly needed yet: (a) if nothing in THIS wave needs the symbol exported, keep
it local/unexported (a local constant, an internal type) until a real consumer lands — don't export ahead
of need just because the plan says something will use it eventually; (b) if the symbol genuinely must be
a shared, exported primitive (e.g. a wrapper component another WO's file will import), land it in the
SAME wave/commit as that first real consumer, not in an earlier WO on its own — the intermediate,
consumer-less state is exactly what trips the gate.

**Apply next time:** when a work order introduces a constant/type/wrapper that only a LATER wave's work
order will consume, default to NOT exporting it until that consumer lands in the same wave; if it must be
exported earlier for structural reasons, plan the WOs so the export and its first consumer land together,
never split across waves with the export alone first.
