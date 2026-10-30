---
id: LESSON-0549
type: anti-pattern
domain: data-pipeline
tags: [provenance, data-integrity, export, promotion-path, guard-rail, escape-hatch]
context: a data export/promotion pipeline that enforces a provenance/baseline guard (e.g. "an authoritative/official source row cannot be silently replaced") to protect against accidental overwrites of a trusted source
trigger: use this when a promotion/export pipeline's provenance guard rejects a change, and the change in question is a deliberate, sanctioned correction made through a DIFFERENT (e.g. DEV-only, manual) path than the one the guard was designed to protect
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-28 (agent-inferred) — the catalog's SQL delta exporter refused any `media_asset` change whose baseline row was `kind=render/source_tier=official` (\"Official renders cannot be replaced\"), even for a legitimate re-crop of the SAME official source image produced by a DEV-only script — the guard could not distinguish a sanctioned correction from the accidental overwrite it exists to prevent"
provenance: agent-inferred
created: 2026-10-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0526]
---

**Situation:** an exporter that promotes catalog changes from a working/DEV environment into the
canonical dataset carries a guard: once a `media_asset` row is marked as an "official" baseline (a
manufacturer/retailer-sourced render), the guard refuses to let the export pipeline overwrite it — this
correctly prevents an accidental, lower-quality replacement from silently clobbering a trusted source.
But a DEV-only tool was used to produce a legitimate, deliberate re-crop of that SAME official image
(same source, corrected framing) — and the guard rejected it exactly the same way it would reject a
genuine accidental overwrite, because it has no way to tell the two apart. The sanctioned promotion path
had no way to carry the DEV-only writer's output through.

**Lesson:** a provenance/baseline guard that hard-blocks any change to an "authoritative" row protects
against the failure mode it was built for (accidental overwrite) but, by the same mechanism, also blocks
every LEGITIMATE correction to that same row — because a binary guard cannot distinguish "someone
accidentally regenerated this" from "someone deliberately fixed this" using only the state it has access
to (the row's own provenance tag). Any tool/writer that can create a state outside the guard's blessed
promotion path (a DEV-only script bypassing the normal ingestion pipeline) will eventually need to push a
legitimate change through that the guard cannot see as legitimate.

**Apply next time:** when designing or hitting a hard-block provenance guard, build in an explicit,
auditable override path from the start (a flag, a reviewed exception queue, a second provenance tag like
`source_tier=official-corrected` that re-enters the guard's logic as allowed) rather than only a binary
accept/reject — and treat "the guard rejected a change I know is correct" as a signal that an escape
hatch is missing, not as a reason to bypass the guard silently or weaken it for everyone. Never grant a
DEV-only writer the ability to create states the sanctioned path cannot carry without also giving it (or
a human reviewer) an explicit, logged way to push that state through properly.
