---
id: BL-0224
type: bug
area: templates
title: "stack-a-nextjs template ships e2e/tokens.spec.ts and e2e/screenshot-prototype.mjs that fail the template's own biome.json"
status: open
severity: p2
opened: 2026-10-07
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-10-06 (agent-inferred) + docs/decision-log.md 2026-10-06 'overlay upgraded 8.81.0 to 8.98.0' (the upgrade skipped both files for this reason); reproduced live by the librarian 2026-10-07 with biome check --error-on-warnings on a scratch copy of plugin/templates/stack-a-nextjs/{biome.json,e2e/tokens.spec.ts,e2e/screenshot-prototype.mjs}: tokens.spec.ts:38 lint/complexity/noExcessiveCognitiveComplexity (31, max 15) + tokens.spec.ts:52 useOptionalChain; screenshot-prototype.mjs organizeImports + format. 3 errors, 1 warning."
closes:
links: [LESSON-0004]
---

## Problem
`plugin/templates/stack-a-nextjs/e2e/` contains `tokens.spec.ts` and `screenshot-prototype.mjs`. Both fail the
SAME template's `biome.json` under `--error-on-warnings` (the flag the canonical `verify.sh` uses). A project
that installs them during `/pandacorp:upgrade` conformance (DR-059) is red-locked on its own lint gate with
no project code changed. personal-page-v2 hit this on the 8.81.0 to 8.98.0 upgrade and had to skip both files
(logged in its decision-log) instead of conforming. Reproduced 2026-10-07 against plugin 9.121.0 sources:
`tokens.spec.ts:38` cognitive complexity 31 (max 15), `tokens.spec.ts:52` `useOptionalChain`,
`screenshot-prototype.mjs` unsorted imports + unformatted.

## Root cause
Nothing verifies that every file the template ships passes the template's own gate configuration. The
template files were authored/edited without running the template's `biome.json` over them, and no factory test
asserts "template files are clean under the template's biome".

## Fix plan
1. Refactor `tokens.spec.ts` to complexity <= 15 (extract per-token-kind helpers into `e2e/` scoped helper
   file, apply the optional-chain fix) and run `biome check --write` on `screenshot-prototype.mjs`.
2. Add a factory-side check (a script under `plugin/scripts/` wired into the plugin's test/lint run) that,
   for each `plugin/templates/stack-*/`, copies `biome.json` + `e2e/` to a temp dir and runs
   `biome check --vcs-enabled=false --error-on-warnings`; RED on any finding.
3. Bump plugin PATCH and the overlay version (templates changed).

## Tests (prove the fix: TDD, RED to GREEN)
The new template-self-lint script is RED today (3 errors) and GREEN after step 1. Add it to the plugin's own
regression suite so a future template edit cannot reintroduce it.

## Done when
The template-self-lint script passes for every stack template; plugin version + overlay version bumped; a
fresh `/pandacorp:upgrade` on a project installs both e2e files and `verify.sh` stays green.

## Out of scope
Changing the biome rules themselves (complexity cap, formatting) for projects.
