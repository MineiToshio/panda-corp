---
id: BL-0267
type: bug
area: build-engine
title: "Build Plan table parser conflates a nested informational table with the canonical WO table"
status: open
severity: p2
opened: 2026-10-21
closed:
source: "LESSON-0462; funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred), FRD-03 Build Plan"
closes:
links: [LESSON-0462]
---

## Problem

During FRD-03's architecture integration, the Build Plan doc contained a purely informational/visual
table nested under a `###` heading, directly below (same section scope as) the canonical WO table,
listing WO-style IDs for human readability. The canonical Build Plan integrator read the visual
table's rows as additional rows of the canonical table and overwrote real work orders' dependencies
with the visual table's data, corrupting the DAG. The observed fix (promoting the visual table's
heading from `###` to `##`, making it a sibling top-level section instead of a nested subsection)
worked without any change to the DAG data or the parser's own code — which means the parser's
table-scoping logic depends entirely on heading nesting, with no additional check (e.g. a distinct
column signature, an explicit "informational, do not parse" marker, or a strict match against the
set of WO IDs already registered in the plan) to protect against this class of accidental conflation.

**Exact file/line of the parsing logic was not pinned down during this harvest** — the implementer
should locate it starting from the Build Plan integration path (`plugin/runtime/build-state.mjs`'s
`applyChangePlan` and/or the architecture-phase `plan-consistency.mjs` gate) before writing the fix.

## Root cause

The Build Plan table parser scopes "what belongs to the canonical WO table" purely by markdown
heading nesting (rows following the canonical heading until the next heading of equal-or-higher
level). It has no secondary signal — a required exact heading text match, a check that a row's ID is
among the WOs already known to the plan, or an explicit "do not parse" marker — to reject a
differently-intentioned table that happens to reuse WO-ID-shaped text and is accidentally nested one
level too deep.

## Fix plan

1. Locate the exact Build Plan table-parsing code (likely in `plugin/runtime/build-state.mjs` near
   `applyChangePlan`, or in the architecture-phase table-reading helper used by `plan-consistency.mjs`
   / the map/plan tooling referenced in `factory/standards/build-orchestration.md`).
2. Harden the scope check: require the canonical table to start from an EXACT heading match (not "any
   heading containing WO-like rows"), and/or validate that every parsed row's ID is a WO ID already
   known to the plan before accepting it as a dependency mutation — reject/flag unknown IDs loudly
   instead of silently overwriting.
3. Add a template/doc-lint note (or extend `check-fdd-coverage.mjs`'s sibling consistency checks) that
   flags a WO-ID-shaped table nested as a subsection under the canonical table's heading, suggesting it
   be promoted to a sibling top-level heading.

## Tests (prove the fix — TDD, RED → GREEN)

A fixture Build Plan doc reproducing the FRD-03 shape (canonical WO table under `## Work Orders`,
followed by a visual/informational table with WO-style IDs nested under a `###` subheading within
that same section) must RED on the current parser (duplicate/overwritten dependencies) and GREEN
after the fix (either the informational table is ignored, or the parser raises a loud, actionable
error instead of silently corrupting the DAG).

## Done when

- The hardened parser (or its gate) rejects/ignores the misplaced informational table instead of
  silently merging it, proven by the fixture test above.
- `LESSON-0462` is back-linked with `promotion: approved` once this ships, if promoted to a standard.

## Out of scope

Redesigning the Build Plan markdown schema wholesale; this item only hardens the existing parser
against this specific conflation class.
