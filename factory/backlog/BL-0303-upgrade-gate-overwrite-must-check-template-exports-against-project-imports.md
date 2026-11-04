---
id: BL-0303
type: bug
area: build-engine
title: "upgrade's gate-overwrite path only diffs tool/schema versions, never checks whether the project's own specs import something the new template doesn't export"
status: open
severity: p2
opened: 2026-11-04
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-03 (agent-inferred): 'upgrade: before overwriting gate files, grep project specs for exports the template lacks (detect-gate-config-newer.sh only compares tool versions, missed this)' -- the exact gap that let the 8.117.0 stack-a-nextjs upgrade overwrite e2e/_hydration.ts with a version lacking the waitForHydrated export that funko-tracker's own specs (to-get, visitor-resume) imported, confirmed live: `plugin/scripts/detect-gate-config-newer.sh` only implements a biome.json schema-semver compare and reports everything else `unknown`, with no check of project-spec imports/exports at all"
closes:
links: [BL-0302, LESSON-0004]
---

## Problem
`/pandacorp:upgrade`'s DR-059 conformance overwrite copies the plugin template's canonical gate files
(e.g. `e2e/_hydration.ts`, `e2e/_responsive-helper.ts`) over a project's own copy. The only pre-overwrite
safety check is `plugin/scripts/detect-gate-config-newer.sh`, which compares `biome.json`'s `$schema`
semver (and reports every other file `unknown`) — it has NO notion of "does the project's own test suite
import a helper/export that the TEMPLATE's version of this file does not provide." On the funko-tracker
8.117.0 upgrade, the template's `e2e/_hydration.ts` lacked the `waitForHydrated` export that funko-tracker's
own `to-get`/`visitor-resume` specs imported; a verbatim overwrite would have red-locked those specs with
an import error, a distinct failure class from the biome/complexity issue BL-0302 already fixed for the
SAME upgrade. BL-0302 fixed this one occurrence by back-porting `waitForHydrated` into the template itself,
but the general upgrade-time check this item is about — grep the project's own specs for names imported
from a file about to be overwritten, and flag any the new template version doesn't export — still does not
exist, so the NEXT template/project divergence of this shape will repeat the same red-lock discovery process
live during an upgrade instead of being caught before the overwrite.

## Root cause
`detect-gate-config-newer.sh`'s classifier is scoped to "is the template newer or the project newer for
this SAME file's own config version" (DR-076/LESSON-0004's downgrade-prevention case). It was never extended
to the structurally different question "does the project depend on a symbol the incoming template file
doesn't provide" — a gap in scope, not a bug in the existing semver-compare logic.

## Fix plan
1. Add a check (either inside `detect-gate-config-newer.sh` or a sibling script called from the same
   `/pandacorp:upgrade` preflight step) that, for each canonical gate/e2e file about to be overwritten:
   extracts the named exports of the TEMPLATE's incoming version, greps the PROJECT's own spec files for
   `import { ... } from '<that file>'` statements, and reports any imported name absent from the incoming
   template version as a blocking finding (verdict `project-depends-on-missing-export`), alongside the
   existing `project-newer`/`template-current`/`unknown` verdicts.
2. Wire `/pandacorp:upgrade` to treat that verdict the same way it already treats `project-newer`: stop and
   require a back-port (extend the template to add the missing export, per BL-0302's own remedy) before the
   overwrite proceeds, never a silent overwrite that red-locks the project's own specs.
3. Bump plugin PATCH; add a decision-log entry; link this item from `detect-gate-config-newer.sh`'s own
   header comment alongside the existing DR-076/LESSON-0004 reference.

## Tests (prove the fix — TDD, RED → GREEN)
A fixture pairing a template e2e helper file missing an export with a project spec file importing that
export: RED today (the detector reports nothing, or `unknown`); GREEN after the fix (the detector reports
`project-depends-on-missing-export` for that file/export pair) and `/pandacorp:upgrade`'s preflight blocks
the overwrite on that verdict.

## Done when
- [ ] The detector (or a sibling script) flags a project spec's import of a template-file export that the
      incoming template version does not provide.
- [ ] `/pandacorp:upgrade` blocks the overwrite on that finding instead of overwriting silently.
- [ ] Plugin version bumped; decision-log entry recorded; new fixture test is RED before the fix and GREEN
      after.

## Out of scope
Re-deriving the biome/complexity/`.claude`-scanner fixes BL-0302 already shipped for the specific
`waitForHydrated`/biome occurrence — this item is the general upgrade-time CHECK that would have caught it
before the overwrite, not a re-fix of that one file.
