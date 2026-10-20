---
id: BL-0262
type: change
area: build-engine
title: "architecture plan's consistency gate should check that a WO consuming another FRD's engine declares every upstream file it must extend"
status: open
severity: p2
opened: 2026-10-19
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-19 (agent-inferred): WO-07-001 (FRD-07 delta engine) declared only two FRD-06 files in its artifacts list, but integrating the delta needed FRD-06 run hooks, plan/apply empty-snapshot handling, finalizer windows and nullable report counts — a FRD-06 dispatcher test had pinned delta:window as a not_wired stub. Codex (the WO's builder) stopped with a precise list of the missing seams instead of editing out of scope, rather than silently expanding the diff (see LESSON-0442)."
closes:
links: [LESSON-0417, LESSON-0442]
---

## Problem

WO-07-001's declared artifact list under-counted what it actually needed to touch in an EARLIER FRD's
engine (FRD-06): it named only two files, while actually integrating the delta engine required FRD-06
run hooks, plan/apply empty-snapshot handling, finalizer windows and nullable report counts — upstream
seams the WO's author never enumerated. The builder (Codex) correctly refused to silently expand scope
and stopped with a precise list of what was missing instead — a good outcome this time, but the
architecture plan itself produced an incomplete artifact declaration that a less disciplined builder
could just as easily have edited past without anyone noticing until review.

## Root cause

The architecture skill's consistency gate (whatever currently checks a work-order plan for internal
coherence — dependency cycles, declared-vs-actual file ownership) has no check specifically for "a WO
that consumes/extends another FRD's engine declares every upstream file/seam it must touch," distinct
from the ordered-seam PATTERN already captured in LESSON-0417 (which addresses HOW to structure such a
seam once identified, not whether the plan correctly enumerated it in the first place).

## Fix plan

1. Identify the architecture skill's existing consistency-gate step (readiness gate / DR-100 checklist)
   that validates a WO's declared artifact list.
2. Add a check: for any WO whose work depends on (`dependsOn`) a WO from a DIFFERENT FRD that owns an
   "engine" (a reusable module other FRDs extend — run hooks, dispatcher registries, plan/apply steps),
   flag if the downstream WO's declared artifacts list does not include every file the upstream engine's
   own extension points live in, per LESSON-0417's ordered-seam pattern.
3. Where the check cannot fully automate "did you name every seam" (requires domain judgment), at minimum
   surface a WARN prompting the architecture agent to re-verify cross-FRD artifact declarations before
   finalizing the plan.

## Tests (prove the fix — TDD, RED → GREEN)

- A fixture work-order plan where a downstream WO depends on an upstream FRD's engine WO but its declared
  artifacts list omits a known extension-point file: the consistency gate flags it. RED today (no such
  check exists).
- A fixture plan where the downstream WO's declared artifacts correctly include the upstream seam: the
  gate passes clean.

## Done when

- Both tests above are green; `bash plugin/scripts/run-engine-tests.sh` stays green.
- `plugin/skills/architecture/SKILL.md` (or its readiness-gate script) updated; plugin version bumped;
  `plugin/docs/decision-log.md` entry; LESSON-0417 and LESSON-0442 back-linked.

## Out of scope

Automatically inferring EVERY upstream seam a downstream WO might need (a full static-analysis
cross-FRD dependency scan) — this item only adds a check for the declared-vs-actual mismatch pattern
this incident surfaced, not a general completeness guarantee.
