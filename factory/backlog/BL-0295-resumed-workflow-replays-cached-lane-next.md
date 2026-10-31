---
id: BL-0295
type: bug
area: build-engine
title: "a resumed Workflow (resumeFromRunId) replays its cached lane-next, so a parked chain is only retired by a brand-new run, never by resuming"
status: open
severity: p2
opened: 2026-10-31
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-30/31 (agent-inferred) — resuming a Workflow via resumeFromRunId replayed the SAME cached lane-next value a prior, now-stale planning pass had computed, instead of recomputing it; a parked chain from that stale plan stayed parked across the resume"
closes:
links: [LESSON-0565, BL-0131]
---

## Problem
When a build's Workflow run is resumed via `resumeFromRunId` (rather than launched fresh), the harness
replays its cached `lane-next` value from the run it is resuming — the per-lane "what to do next" decision
computed by an earlier planning pass. If that cached decision is stale (e.g. it points at a chain that has
since parked, or a plan that no longer matches the current state), the resumed run keeps acting on the
stale cached value instead of recomputing it. A parked chain produced under the old plan is therefore only
ever retired by starting a BRAND-NEW run (which recomputes lane-next from scratch); resuming the same run
id never clears it.

## Root cause
`resumeFromRunId`'s contract preserves and replays prior per-lane state (including `lane-next`) as a
resumability feature — useful when the prior state is still valid, but it has no invalidation check for
whether that cached value is still consistent with the CURRENT build state (WO statuses, parked chains)
at resume time. The harness has no "lane-next is stale, recompute" signal; it simply replays what it has.

## Fix plan
Before replaying a resumed run's cached `lane-next` for a lane, validate it against the current build
state: if the lane's targeted chain/WO is now parked, VERIFIED, or otherwise no longer matches the
assumption the cached `lane-next` was computed under, discard the cached value and recompute lane-next
fresh for that lane (the same computation a brand-new run would do), rather than blindly replaying it.
Scope this to the supervisor/engine side that calls `resumeFromRunId`, not the Workflow harness itself
(outside this repo's reach) — i.e. the engine should sanity-check the resumed state before trusting it,
the same posture used elsewhere for harness-relayed input (BL-0198).

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a run whose lane-next cached a chain that has since been parked by the time of resume. RED
(current engine): the resumed run replays the stale lane-next and keeps acting on the parked chain. GREEN
(fixed): the engine detects the mismatch at resume time, discards the stale cached value, and recomputes
lane-next for that lane against current state.

## Done when
- Resuming a run whose cached `lane-next` no longer matches current build state (parked/VERIFIED chain)
  recomputes lane-next instead of replaying the stale value; new test(s) pass.
- A resume where the cached value IS still valid is unaffected (no unnecessary recomputation).
- Plugin version bumped (PATCH) and `plugin/docs/decision-log.md` records the fix.

## Out of scope
Any change to the Workflow harness's own `resumeFromRunId` semantics (outside this repo); fixing why a
chain parked in the first place.
