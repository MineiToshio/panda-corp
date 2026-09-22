---
id: LESSON-0247
type: gotcha
domain: build-engine
tags: [refactoring, side-effects, safe-point, lease-renewal, background-promise, unhandled-rejection, adversarial-review]
context: optimizing/refactoring a multi-step pipeline (a build engine, an orchestrator) by skipping, merging or fast-pathing a step that LOOKS purely mechanical (a commit, a bookkeeping stamp, a safe-point boundary)
trigger: use this when removing, merging, collapsing per-wave/per-step cadence into a coarser one, or fast-pathing any step in an existing pipeline that appears to be pure plumbing with no decision content
source: "mission-control .pandacorp/run/lessons.md 2026-09-22 (agent-inferred), corroborated by plugin/docs/decision-log.md 'WP-11 + D-1' and the round-1 adversarial-review entry (2026-09-22, plugin v9.103.0, commit fbeef8b3): the 2026-09 implement-speed sprint's WP-11 package moved the build engine's safe-point cadence from per-wave to per-run to cut checkpoint overhead. The ONLY place the engine's lease-renewal call lived was inside that per-wave safe-point prompt — coarsening the cadence silently dropped lease renewal on any run whose waves now skip that boundary (D-1). The same review pass separately found (D-2) that WP-02's backgrounded visual-qa agent() call, launched fire-and-forget for lean close-out, had no .catch — an unhandled rejection there would silently skip the downstream cleanup/fail-safe instead of surfacing as a reported failure. Both were caught by an independent adversarial review deliberately not shown the implementers' own reasoning, not by the 6 TDD suites the implementers themselves wrote for their own packages."
provenance: agent-inferred
created: 2026-09-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0074]
---

**Situation:** a build-engine speed optimization coarsened the safe-point/checkpoint cadence from
per-wave to per-run, treating it as a pure scheduling/plumbing change. The lease-renewal call, which had
no dedicated home of its own, happened to live inside that per-wave prompt — so thinning the cadence
silently thinned lease renewal along with it, risking a stale/expired lease on a long-running skip. In the
same review pass, a separately-optimized step (a backgrounded agent call for lean close-out) turned out to
have no `.catch`/error boundary — an unhandled rejection there would vanish instead of triggering the
fail-safe (`running: false`) the synchronous path already guaranteed.

**Lesson:** a step that looks "mechanical" (a commit, a stamp, a checkpoint, a plumbing call) is not
necessarily FUNCTIONALLY minimal — other, unrelated concerns (a lease renewal, a heartbeat, a cleanup
trigger) can be piggybacked on its execution simply because it was a convenient, reliably-hit point in the
pipeline, not because it's logically part of that step's nominal purpose. Removing, merging or coarsening
such a step evaluated only against its OWN stated job silently drops whatever else was riding along with
it — the same failure shape as a hidden dependency. Separately: any `agent()`/async call launched in the
BACKGROUND (fire-and-forget, off the critical path) needs an explicit `.catch()` or try/catch — without
one, a rejection is not "no-op," it is a silently skipped guarantee (the fail-safe that would have run on
the synchronous path never fires). Both gaps were found only by an INDEPENDENT adversarial review with
fresh context, not by the implementers' own TDD suites (each suite only tests what its author thought to
verify) — this generalizes LESSON-0074's point ("a green suite answers 'did this change', not 'is this
right'") to a concrete engineering discipline for optimization/refactoring work specifically.

**Apply next time:** before removing, merging or coarsening any step in an existing pipeline/workflow —
even one that looks purely mechanical — grep the codebase for every OTHER thing that currently happens to
fire at that exact boundary (not just what the step is named for) and explicitly re-home each one. When
launching an async call in the background (not awaited on the critical path), always attach `.catch`/a
try-catch boundary that runs the same fail-safe cleanup the synchronous path would have. And route any
speed/cost optimization through an independent adversarial review pass (fresh context, not the
implementer's own suite) before trusting it — that is what catches side-effect loss and missing error
boundaries that a same-author TDD suite structurally cannot.
