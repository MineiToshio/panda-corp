---
id: BL-0059
type: change
area: plugin-skill
title: "Design skill's Stage-1 pull-and-review (§1c) must check for declared-but-unwired variants within the design system itself, not only at the cross-screen closing sweep"
status: open
severity: p2
opened: 2026-07-10
closed:
source: "pandacast .pandacorp/run/lessons.md 2026-07-10 (agent-inferred, paired with LESSON-0138): the generated Nav component implemented layout=\"rail\" with a docstring promising activation at >=1024px, but AppShell always mounted the bottom-bar variant — the rail existed only as a hand-drawn responsive mock, never wired at runtime; found only by manual inspection, not by any documented review step"
closes:
links: [LESSON-0138]
---

## Problem
`plugin/skills/design/references/canvas-procedure.md` step 7 ("Closing sweep — bidirectional component
reconciliation", DR-109) only reconciles components/patterns actually USED ACROSS SCREENS against the
Stage-1 gallery — it runs once, after every screen row is `owner-approved`. It has no check for a
DIFFERENT defect class found during pandacast: a component generated in Stage 1 itself can declare a
prop/variant (e.g. `Nav` with `layout="rail"`, docstring: activates at `>=1024px`) that is never actually
WIRED into its runtime consumer (`AppShell` always mounted the bottom-bar variant instead) — a defect
entirely internal to the design system, invisible to a cross-screen usage diff because no screen would
ever "use" a variant its consumer never selects.

## Root cause
Stage-1 pull-and-review (canvas-procedure.md step 4, scored against the §1c checklist) verifies the
system's components/states/breakpoints EXIST, but never verifies that a component's documented
conditional behavior (a variant meant to activate under some condition) is actually reachable/wired by
its consumer at runtime — that check currently only exists, and only for cross-screen usage, at the very
end (step 7), which is both too late (Stage 2 may already assume the unwired behavior works) and the
wrong shape of check (usage-across-screens, not internal wiring).

## Fix plan
1. Add to the Stage-1 pull-and-review loop (canvas-procedure.md step 4 / design.md §1c checklist): for
   every component with a documented conditional variant (a breakpoint-activated layout, a state-triggered
   style), verify its declared trigger condition is actually READ and BRANCHED ON by the component/its
   consumer in the generated code — not just declared in a prop type or docstring.
2. Keep the closing sweep (step 7) as-is for its original cross-screen usage-diff purpose; this is an
   ADDITIONAL earlier check, not a replacement.

## Tests (prove the fix — TDD, RED → GREEN)
Documented manual repro: a synthetic Stage-1 system where a component declares a responsive variant via
docstring/prop but its consumer hardcodes the non-responsive branch; before the fix, step 4's checklist
review passes (no check exists for this); after the fix, step 4 flags the unwired variant and issues a
corrective prompt. Automated canary infeasible (prompting-doc behavior) — manual repro is the proof.

## Done when
`canvas-procedure.md` step 4 documents the declared-vs-wired check; `design.md` §1c checklist references
it; plugin version bumped.

## Out of scope
Building a static-analysis tool that verifies wiring programmatically — this stays a documented review
step for the agent to apply, same rigor level as the rest of §1c.
