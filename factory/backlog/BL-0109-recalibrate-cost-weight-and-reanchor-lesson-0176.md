---
id: BL-0109
type: bug
area: build-engine
title: "Recalibrate COST()'s opus weight (real ratio is 2.5x, not 3x) and re-anchor LESSON-0176's ~10x claim"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-13"
closes:
links: [LESSON-0176]
---

## Problem
`.claude/engines/pandacorp-build.js:141` sets `COST = (m) => (m === 'opus' ? 3 : 1)`, derived from a single
incident's estimate in `docs/proposals/12-adaptive-repair-and-model-selection.md:85` and never recalibrated.
Against the verified 2026-09-02 price table the real opus:sonnet ratio on the audit's stated call-unit basis
is **2.5×, not 3×**. Separately, `LESSON-0176` holds a `~10x` cost claim at `provenance: agent-inferred`,
`confidence: medium`, `times_applied: 0` — an unvalidated estimate sitting in the retrieval store. Impact:
the brake is not badly wrong, but both numbers are unanchored.

## Root cause
Both figures were estimates recorded once and never re-derived when prices and models changed generation.

## Fix plan
1. With BL-0096's measured spend in hand, recompute the real opus:sonnet ratio for this factory's actual
   call shapes and set `COST()` from it (or document why 3× is deliberately conservative).
2. Re-anchor `LESSON-0176`: correct or qualify the `~10x` claim against the measured figure, keeping the
   never-delete/deprecate-only rule (`factory/memory/README.md:24-26`).

## Tests (prove the fix — TDD, RED → GREEN)
Measured opus and sonnet spend from one build compared against `COST()`'s assumption, with the delta written
down. `validate-memory.sh` green after the lesson edit.

## Done when
`COST()` matches a measured ratio or carries a written justification for diverging; `LESSON-0176` is
re-anchored to a measured number; `plugin/docs/decision-log.md` noted.

## Out of scope
Deleting `LESSON-0176` (never-delete rule) and any change to `MAX_AGENTS` (§9 item 6).
