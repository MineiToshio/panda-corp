---
id: LESSON-0435
type: pattern
domain: build-orchestration
tags: [fidelity-gate, build-recipes, harness-noise, advisory-gate, cost-control]
context: running an advisory fidelity/visual gate per-FRD when the harness itself is known to have gaps (e.g. incomplete state recipes) that produce false mismatches
trigger: use this when an advisory fidelity gate's own build-side configuration (state recipes, interaction scripts) is incomplete, and the instinct is to keep running the expensive per-FRD measurement anyway
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a fidelity gate shipped with its build-side state recipes empty (`build-recipes.json =
{}`). With no recipe to drive it into an interactive state (open a dialog, apply a filter), the harness
captured every oracle "state" as the SAME at-rest build screenshot while the prototype oracle genuinely
showed the interactive state — so most of the reported "mismatches" were pure harness noise, not real
defects, and each per-FRD run still cost 1–2.5 hours to produce that noise.

**Lesson:** an advisory gate that is known to be mis-measuring (because its own configuration, not the
product, is incomplete) does not get cheaper or more informative by running it more — every run just
re-produces the same category of false signal at full cost. The fix belongs in the harness
configuration (author the missing state recipes, and add a smoke check that a recipe-bearing state
actually changes the rendered page before trusting any of its captures), not in re-running the
expensive measurement hoping for a different result.

**Apply next time:** when a fidelity/visual gate's own build-side wiring is suspected or known
incomplete, stop running the full per-FRD measurement, fix the harness configuration once (author every
state recipe the oracle actually exercises, add a smoke check that a recipe changes the page, and fail
fast on a missing root rather than waiting out a long timeout), then run ONE consolidated measurement
pass before close-out — not a per-FRD cadence against a harness you already know is wrong.
