---
id: BL-0244
type: change
area: plugin-skill
title: "architecture skill should explicitly propose an app-build vs. real-content-production track split for content-heavy products"
status: open
severity: p2
opened: 2026-10-17
closed:
source: "pandasaga .pandacorp/run/lessons.md 2026-10-16 (owner-stated): \"In architecture, propose explicitly that the app build and real-content production are separate tracks (content ingested later by a dedicated generic skill/WO) instead of leaving it implicit; the owner read the fixture-heavy, many-round plan as 'you are building the content'.\""
closes:
links: []
---

## Problem

On pandasaga (a content-heavy product), the architecture phase produced a plan with many fixture/mock
content work orders needed to exercise and verify the app's structure. The owner read this fixture-heavy
plan as the architecture skill actually building the project's real content, when the intent was that real
content would be ingested later by a separate, dedicated track/skill/work order. Nothing in the
architecture skill's current output makes this track split explicit, so the owner had to ask for the
clarification rather than receiving it proactively.

## Root cause

The architecture skill (`plugin/skills/architecture/`) has no instruction to call out, when a plan
contains a non-trivial amount of fixture/placeholder content work, that this is NOT the real-content
production track — that real content is a separate, later concern. The gap is a missing communication
step, not a planning defect: the plan itself may have been structured correctly, but the owner wasn't told
about the separation explicitly.

## Fix plan

1. In the architecture skill's plan-authoring/summary step, add an instruction: when a plan includes
   fixture/placeholder/mock content work orders that exist to exercise app structure (not to BE the
   product's final content), state this explicitly in the plan summary shown to the owner — name the two
   tracks (app build vs. real-content production) and note that real content is ingested later via its own
   dedicated flow.
2. Cross-check against `factory/standards/` guidance on seed/placeholder content (if any exists) so the
   language is consistent factory-wide.
3. Note the addition in `plugin/docs/decision-log.md`; bump the plugin version (PATCH).

## Tests (prove the fix — TDD, RED → GREEN)

- Documented manual repro (skill-prompt change, no automated harness): run architecture on a
  content-heavy fixture project. RED = current behavior produces a fixture-heavy plan with no explicit
  track-split note. GREEN = after the fix, the plan summary explicitly names the two tracks.

## Done when

- The architecture skill's plan summary explicitly surfaces the app-build vs. content-production track
  split whenever the plan contains non-trivial fixture/placeholder content work.
- Plugin version bumped (PATCH) + decision-log entry added.

## Out of scope

- Does not change how content is actually ingested/produced later — only how the architecture phase
  communicates the split up front.
