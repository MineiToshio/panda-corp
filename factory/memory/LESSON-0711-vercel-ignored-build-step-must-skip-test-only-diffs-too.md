---
id: LESSON-0711
type: gotcha
domain: deployment
tags: [vercel, ignored-build-step, ci-cost, build-cpu]
context: auditing or writing a Vercel "Ignored Build Step" script that decides whether a push should trigger a full build
trigger: use this when a Vercel project's Ignored Build Step script only special-cases a docs-only diff before deciding whether to skip the build
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-22 (agent-inferred): `scripts/deploy/vercel-ignore.sh` only skips docs-only diffs; 3 of 9 production builds over Nov 19-21 were test-only (changes confined to `_tests/`, `e2e/`, `scripts/test`) and still ran a full billed build, Build CPU being the largest Vercel cost line on this account."
provenance: agent-inferred
created: 2026-11-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0712, LESSON-0693]
---

**Situation:** a Vercel "Ignored Build Step" script classified a push as skippable only when every changed
file matched a docs-path allowlist. Three of nine production builds over a three-day window touched
nothing but test files (`_tests/`, `e2e/`, `scripts/test`) — no runtime code, no deployed behavior change —
yet still triggered a full, billed build because none of those paths matched the docs allowlist.

**Lesson:** an "Ignored Build Step" (or any CI skip-the-build heuristic) that classifies a diff as skippable
by a single narrow allowlist (docs) misses every OTHER class of diff that also cannot change the deployed
app's runtime behavior — most commonly a test-only diff (new/changed tests, e2e specs, test-only scripts)
that exercises code paths but ships nothing production-affecting. Each such push still pays a full build.

**Apply next time:** when writing or auditing a build-skip script, enumerate every path class that cannot
affect the deployed artifact (docs, tests, CI config, the skip script's own tests) rather than allowlisting
only docs, and verify the skip decision against the FULL diff (every changed file matches a skippable
class), not a single heuristic category.
