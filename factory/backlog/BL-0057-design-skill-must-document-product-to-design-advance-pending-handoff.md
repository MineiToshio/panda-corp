---
id: BL-0057
type: bug
area: plugin-skill
title: "design/SKILL.md never documents that invoking /pandacorp:design IS the owner's 'ok, advance' when status.yaml still shows phase: product + advance_pending: true"
status: open
severity: p2
opened: 2026-07-10
closed:
source: "pandacast .pandacorp/run/lessons.md 2026-07-10 (agent-inferred): /pandacorp:design was invoked while .pandacorp/status.yaml still read phase: product, advance_pending: true (the spec phase's own gate, per DR-032/CLAUDE.md 'iterate without advancing') — the agent had to infer that running design at all is the owner's advance signal and that design itself must write the product→design transition; SKILL.md's Step 9 only describes the design→architecture transition, not the incoming one"
closes:
links: []
---

## Problem
Per DR-032 (`AGENTS.md` "Iterate without advancing"), a manual phase like `spec` produces its output and
sets `advance_pending: true`, waiting for the owner's explicit "ok, advance" before the project's `phase`
moves forward. In practice, the owner's actual "ok, advance" gesture for the product→design transition IS
invoking `/pandacorp:design` — but `plugin/skills/design/SKILL.md` never says this. Its Step 9 documents
ONLY the outgoing transition (design→architecture); an agent running `/pandacorp:design` on a project
still stamped `phase: product, advance_pending: true` has no written instruction telling it (a) that this
invocation itself satisfies the pending gate, and (b) that `design` itself is responsible for writing the
`product → design` phase transition in `status.yaml`. This was worked out by inference during the
pandacast build, not by following documented steps — a future agent doing the same inference wrong
(e.g. refusing to proceed, or advancing a phase it shouldn't) is a live risk.

## Root cause
`SKILL.md`'s preflight/Step-early section was written assuming the incoming phase transition is always
already-closed by the time `design` runs; DR-032's "the invocation IS the ok" convention was never spelled
out symmetrically for design's own entry condition, only for the phase it hands off to next.

## Fix plan
1. Add an explicit preflight step to `plugin/skills/design/SKILL.md` (near Step 0/1): if
   `status.yaml` reads `phase: product` and `advance_pending: true`, treat the `/pandacorp:design`
   invocation itself as the owner's advance signal — write `phase: design`, clear `advance_pending`,
   and proceed; do not ask again.
2. Cross-reference DR-032 in that step so the convention (invocation-of-the-next-phase = the gate) is
   documented once at the source, not re-derived per skill.

## Tests (prove the fix — TDD, RED → GREEN)
Documented manual repro: set a project's `status.yaml` to `phase: product, advance_pending: true`, run
`/pandacorp:design`; before the fix, the skill's own doc gives no instruction for this state (relies on
agent inference); after the fix, Step 0/1 explicitly handles it and the resulting `status.yaml` shows
`phase: design, advance_pending: false` deterministically, not by inference.

## Done when
`design/SKILL.md` documents the incoming `product→design` transition symmetrically with the outgoing one;
plugin version bumped; Manual reference regenerated if it lists SKILL.md steps.

## Out of scope
Changing DR-032 itself or any other skill's incoming-transition documentation (file separate items if the
same gap is found elsewhere).
