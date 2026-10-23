---
id: BL-0276
type: bug
area: plugin-skill
title: "check-fdd-coverage --plan scans SUPERSEDED legacy work-order bodies instead of skipping them"
status: open
severity: p2
opened: 2026-10-22
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred), found during the v2 Orbita plan gate pass: check-fdd-coverage.mjs has no status:SUPERSEDED special-case at all (confirmed by grep, zero hits for the string in plugin/skills/design/scripts/check-fdd-coverage.mjs)."
closes:
links: []
---

## Problem
`plugin/skills/design/scripts/check-fdd-coverage.mjs` (added by BL-0239, shipped in plugin v9.128.0) walks
every work-order body under a UI FRD to check that quoted copy/microcopy keys are drawn in the FRD's
captured oracle states. It does not skip work orders whose `status:` frontmatter is `SUPERSEDED` —
legacy, retired work-order bodies that quote copy from a PRIOR design round get scanned exactly like live
work orders. On Mission Control's v2 Orbita plan gate pass, superseded history lines that legitimately
quote old copy had to be hand-annotated with "(drawn in FRD-XX's captured states)" notes to pass the
checker, purely because the checker has no concept of "this work order is historical, don't hold its
quoted copy to the live oracle."

## Root cause
The coverage walk (step (c) of BL-0239's fix plan: "every microcopy key in backticks ... is drawn in this
FRD's captured states") iterates work-order files without filtering on `status:`. A `SUPERSEDED` work
order is retained as traceability history (per `factory/standards/build-orchestration.md`'s treatment of
superseded WOs), not as a plan the build will execute — so its quoted copy should never need to match the
CURRENT oracle.

## Fix plan
1. In `plugin/skills/design/scripts/check-fdd-coverage.mjs`, read each work order's `status:` frontmatter
   before running the copy/microcopy coverage check; skip (or scan with a relaxed, history-only mode) any
   work order whose `status` is `SUPERSEDED`.
2. Keep `--plan`'s other checks (blueprint/plan-level coverage) unaffected — this only narrows the
   per-work-order scan.
3. Update `plugin/scripts/fixtures/fdd-coverage/` with a fixture work order carrying `status: SUPERSEDED`
   and legacy quoted copy that would otherwise fail, to prove the skip.

## Tests (prove the fix — TDD, RED → GREEN)
- `plugin/scripts/test-fdd-coverage.mjs`: a new fixture case with a `SUPERSEDED` work order quoting
  retired copy not in the oracle — RED before the fix (false positive), GREEN after (skipped).
- Existing fixtures (`funko-like`, `synced`) stay unchanged/green.

## Done when
- The new fixture test passes; the existing test-fdd-coverage.mjs suite stays green.
- Plugin version bumped (PATCH) and manifests regenerated.

## Out of scope
- Any change to how/whether superseded work orders are retained as history — only the coverage checker's
  treatment of them changes.
