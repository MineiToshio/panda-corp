---
id: LESSON-0592
type: gotcha
domain: testing
tags: [playwright, next-dev, parallelism, workers, measurement]
context: deciding whether to raise Playwright worker count against a Next.js `next dev` webServer, or how to measure the effect of a parallel-e2e change
trigger: use this when a Playwright suite runs against `next dev` and you are tempted to bump the worker count for speed, or when reporting the result of such a change
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-31 (agent-inferred) — per-test time roughly tripled at 3 workers against a single `next dev` server; see also BL-0296 (parallel e2e tier, plugin 9.147.0)"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0296, LESSON-0185]
---

**Situation:** raising Playwright's worker count against a `next dev` webServer barely scaled: at 3
workers, per-test time roughly TRIPLED instead of the suite finishing faster — one dev server compiling
routes on demand and serving every request is the bottleneck, not the test runner's own concurrency.

**Lesson:** `next dev`'s on-demand compilation and single-process request handling make it a shared,
contended resource exactly like a single local database (LESSON-0463/LESSON-0480's class) — adding
Playwright workers multiplies contention on that one process rather than adding real parallelism.
Wall-clock time for a parallel run is also a poor signal on a machine running other sibling load (gate
worktrees, sessions, builds): it conflates the suite's own cost with whatever else is competing for the
box's CPU/IO at that moment.

**Apply next time:** before raising worker count against a dev server, check whether the target can
actually serve concurrent requests cheaply (a production build via `next start`, not `next dev`, removes
the on-demand compilation bottleneck — see BL-0296's "out of scope" note on a production-build e2e server
as the next lever). When measuring a parallelism change, report each test's own SPAN (its measured
execution time), not the run's wall clock — wall time is dominated by machine lease and sibling load, not
by the change under test.
