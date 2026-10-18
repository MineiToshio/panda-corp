---
id: BL-0247
type: bug
area: plugin-skill
title: "check-fdd-coverage.mjs does not read aria-roledescription when matching drawn copy"
status: open
severity: p2
opened: 2026-10-17
closed:
source: "funko-tracker architecture phase 2026-10-16/17 (design mini-round, DR-130 findings); docs/proposals/architecture-skill-v2.md"
closes:
links: [DR-130, BL-0239]
---

## Problem

`plugin/skills/design/scripts/check-fdd-coverage.mjs` decides whether a string the FDD (or, with `--plan`, a
blueprint/work order) names is "drawn" in a captured state by reading the state's visible text plus the attributes in
`TEXT_ATTRS` (line ~69: `aria-label`, `placeholder`, `title`, `alt`, `value`, `aria-description`,
`aria-valuetext`). `aria-roledescription` is not in that list. funko-tracker's prototype draws the image viewer as
`<div class="iv-stage" role="img" aria-roledescription="visor de imagen" aria-label="Imagen ampliable" ...>`
(`docs/design/prototype/funko-tracker.html:3750`, also in `docs/frds/frd-05-checklist-export/mocks/checklist-export.html`),
so an FDD/WO line that names "visor de imagen" (a real, announced string) is reported as "not drawn" and the author
must either drop a correct sentence or annotate around a false positive.

## Root cause

`aria-roledescription` is a text-bearing ARIA attribute (screen readers announce it), but `TEXT_ATTRS` was written
from the attributes seen in the first fixtures only.

## Fix plan

1. Add `aria-roledescription` to `TEXT_ATTRS` in `check-fdd-coverage.mjs` (same handling as `aria-label`: counted when
   the element is not hidden/demo-only/script/svg).
2. Update the header comment's attribute list.
3. Plugin PATCH bump + `plugin/docs/decision-log.md` line.

## Tests (prove the fix — TDD, RED → GREEN)

`plugin/scripts/test-fdd-coverage.mjs`, "mock text extraction": add an element with
`aria-roledescription="visor de imagen"` to the inline HTML and assert `mockStates(...)` includes
`visordeimagen` (RED today, GREEN after). Keep the existing hidden/demo-only exclusions asserting the same attribute
on a hidden element is NOT counted.

## Done when

- The new assertions pass; `node plugin/scripts/test-fdd-coverage.mjs` and `bash plugin/scripts/run-engine-tests.sh` green.
- Plugin version bumped (PATCH) + decision-log entry.
