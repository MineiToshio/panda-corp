---
id: BL-0286
type: change
area: plugin-skill
title: "freeze.mjs shard should surface (or auto-write) the oracle-states.json/oracle-recipes.json entries newly-captured states still need"
status: open
severity: p2
opened: 2026-10-28
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-23 (agent-inferred): freeze.mjs shard re-captures mocks but does not write oracle-states.json/oracle-recipes.json; new configured states need their oracle entries and build doubles added by hand"
closes:
links: [LESSON-0538]
---

## Problem
`plugin/skills/design/scripts/fidelity/freeze.mjs`'s `shard` stage captures a configured state's
fixtures/screenshots, but the matching `oracle-states.json`/`oracle-recipes.json` entries (owned by the
design skill's separate S2.6 stage, per `plugin/skills/design/references/freeze-and-fidelity.md`) are not
written or updated as part of `shard`. Re-running `shard` (directly, or via `--only`/`--all`) to add new
configured states leaves those two files silently stale — the operator must notice and add the missing
entries by hand, with no signal from `freeze.mjs` itself that they are missing.

## Root cause
`shard`'s own cache/output (`STAGES`/`DEPENDS` in `freeze.mjs`) tracks only the mocks directory it writes;
it has no awareness of, or dependency edge to, the oracle/build-recipe files S2.6 owns. The two artifacts
can drift with no error on either side.

## Fix plan
1. In `freeze.mjs`'s `shard` stage (or a thin check run immediately after it), diff the set of configured
   states just captured against the keys already present in `oracle-states.json`/`oracle-recipes.json`.
2. At minimum, print a clear, actionable report of states missing an oracle/recipe entry (names, not just
   a count) so the gap is visible immediately after `shard` runs, instead of surfacing later as a confusing
   oracle/build-doubles failure.
3. If the recipe shape is mechanically derivable from the shard config for the common case (route, profile,
   seed, doubles following an established per-state pattern), consider auto-writing a draft entry for
   review rather than only reporting the gap — scope this only if it doesn't encode judgment calls S2.6
   is meant to make.
4. Note the addition in `plugin/docs/decision-log.md`; bump the plugin version (PATCH for the report-only
   fix, MINOR if auto-drafting entries ships too).

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: run `shard` against a config with one newly-added configured state and a pre-existing
`oracle-states.json` that doesn't mention it. RED = `shard` exits clean with no signal about the missing
entry. GREEN = `shard` (or its immediate follow-up check) reports the specific missing state by name.

## Done when
- The RED→GREEN fixture passes.
- `plugin/docs/decision-log.md` entry added; plugin version bumped.
- `factory/memory/LESSON-0538` remains the documented manual workaround until this ships, then its body is
  updated to point at the new automated check.

## Out of scope
Making S2.6's judgment calls (profile/seed/doubles selection) fully automatic — this item only closes the
visibility gap between `shard` and the oracle/recipe files, not S2.6's own authoring work.
