---
id: LESSON-0538
type: gotcha
domain: factory-engineering
tags: [design-skill, freeze.mjs, shard, oracle-states, oracle-recipes, fidelity]
context: re-running the design skill's `freeze.mjs shard` stage to capture new/updated configured states for a prototype
trigger: use this when running or re-running `freeze.mjs shard` (directly or via `--only`/`--all`) to add new configured states, and before assuming the oracle/build-recipe artifacts are already in sync
source: "mission-control .pandacorp/run/lessons.md 2026-10-23 (agent-inferred) — design-freeze fidelity pass"
provenance: agent-inferred
created: 2026-10-28
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** `freeze.mjs shard` re-captures a configured state's fixtures/screenshots, but the matching
`oracle-states.json`/`oracle-recipes.json` entries (the prototype-side oracle state plus the build-side
recipe columns: route, profile, seed, doubles) are written by a separate stage (the design skill's S2.6),
not by `shard` itself. Re-running `shard` to add or change states leaves those two files stale unless
someone edits them by hand.

**Lesson:** `freeze.mjs`'s staged pipeline (split/measure/shard/screens/catalog/identity) does not imply
every artifact a later stage depends on gets refreshed together — `shard`'s own cache/output tracks only
the mocks it captures, so a new shard-captured state silently has no oracle entry until S2.6 (or a human)
adds one. Treat "shard ran clean" as "mocks captured," not as "the oracle/build-recipe artifacts are in
sync."

**Apply next time:** after re-running `freeze.mjs shard` to add/update configured states, cross-check
`oracle-states.json` and `oracle-recipes.json` against the shard output and add the missing entries by
hand (one state per line, matching the existing column shape) before relying on the oracle/build-doubles
pass — don't assume `shard`'s own success implies these files are current.
