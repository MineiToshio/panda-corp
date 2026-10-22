---
id: LESSON-0491
type: gotcha
domain: factory-engineering
tags: [design-skill, freeze, context-pack, enumeration, silent-gap]
context: "a design-freeze step that must produce one artifact per UI FRD, built by enumerating FRDs from an already-populated downstream structure (a config's accumulated `states` keys) instead of the FRDs' own authoritative declaration (`ui: true` frontmatter)"
trigger: use this when a build/freeze step must enumerate "every UI FRD" (or a similar authoritative set) and the implementation reads that set from a downstream artifact that is only populated as a side effect of earlier work, rather than from each unit's own declared flag
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — Mission Control v2 design freeze, FRD-14"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [BL-0269]
---

**Situation:** a design-freeze step (S0.3) that builds one context pack per UI FRD derived its FRD list
from the fidelity config's accumulated `states` folders rather than from each FRD's own `ui: true`
frontmatter. FRD-14 is `ui: true` but had no `states` folder populated yet (nothing had configured a
state for it), so it silently got no context pack and escaped a reconciliation step meant to cover every
UI FRD — with no error, because the step's own enumeration never knew FRD-14 existed.

**Lesson:** enumerating "every X that needs step N" from a downstream artifact that is only populated BY
an earlier step (here: config states accumulated round by round) silently drops any X that hasn't been
touched yet — the omission produces no error, because the enumeration source itself has no entry to be
missing. The authoritative set must come from the SOURCE declaration (the unit's own flag/frontmatter),
not from whatever has incidentally accumulated downstream.

**Apply next time:** when a step claims to cover "every FRD/unit of kind X", build its worklist from the
units' own declared flag/frontmatter, never from a downstream artifact whose population is itself
incomplete or in progress; treat a unit present in the source set but absent from the downstream artifact
as a signal to backfill, not as "not applicable."
