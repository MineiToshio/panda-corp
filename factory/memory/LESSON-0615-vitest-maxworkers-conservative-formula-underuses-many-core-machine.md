---
id: LESSON-0615
type: gotcha
domain: testing
tags: [vitest, maxWorkers, performance, parallelism]
context: a vitest config caps `maxWorkers` with a conservative formula like `min(2, cores - 1)` on a machine with many more cores than that cap, and a large suite of isolated per-file tests (e.g. worker/render tests) is slow
trigger: use this when a vitest suite of many independent per-file tests runs much slower than the machine's core count would suggest, and `maxWorkers` is capped at a small fixed/conservative value
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-03 (agent-inferred): vitest maxWorkers capped at min(2, cores-1) on a 10-core machine; 5 src/worker render tests took ~360s of ~820s total file time"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a vitest config set `maxWorkers: Math.min(2, cores - 1)` to keep a predictable, light
resource footprint for jsdom/DB-backed tests on a shared machine. On a 10-core machine, a handful of
independent worker/render test files ended up taking roughly 44% of the whole suite's measured file time,
running effectively near-serially despite the machine having far more idle cores available.

**Lesson:** a conservative `maxWorkers` cap chosen to protect shared/DB-backed tests from resource
contention applies uniformly to the WHOLE suite, including test files that are CPU/render-bound and
genuinely independent of each other — those files pay the same artificial ceiling the DB-safety reasoning
was meant for, even though their failure mode (contention) doesn't apply to them.

**Apply next time:** when a specific subset of a test suite is CPU-bound and independent (no shared
DB/daemon dependency), consider giving it its own vitest project/config with a higher `maxWorkers` instead
of applying one global conservative cap to every test file — measure the split's effect on real wall-clock
before committing to it, since this is a tuning observation, not a universally-correct value.
