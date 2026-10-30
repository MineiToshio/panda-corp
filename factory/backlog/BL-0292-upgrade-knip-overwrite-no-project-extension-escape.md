---
id: BL-0292
type: bug
area: plugin-skill
title: "/pandacorp:upgrade's unconditional knip.json conformance overwrite has no escape for a project's own entry/ignore globs, red-locking the gate"
status: open
severity: p2
opened: 2026-10-30
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-29 (agent-inferred): the DR-059 conformance overwrite replaced mission-control's knip.json with the template's, dropping the project's own `scripts`/navigation entry points and `isNavigationSlug`/`validateNavigationCatalog` ignore globs — knip then flagged them as unused, red-locking the baseline gate."
closes:
links: [LESSON-0004, BL-0003, DR-059, DR-076]
---

## Problem

`/pandacorp:upgrade`'s DR-059 gate-config conformance step (`plugin/skills/upgrade/SKILL.md` step 3) copies
`knip.json` verbatim from the plugin template, overwriting the project's own copy. Unlike `biome.json`
(covered by `detect-gate-config-newer.sh`'s project-newer-than-template detector, BL-0003/LESSON-0004),
knip's schema is major-only and always classifies `unknown`, so the overwrite proceeds unconditionally
(DR-059's own guarantee) regardless of content. On Mission Control this knip.json carried PROJECT-SPECIFIC
entries (extra `entry`/`project` globs, and `ignoreExportsUsedInFile`-style allowances for
`isNavigationSlug`/`validateNavigationCatalog`) that the template has no equivalent for. After the overwrite,
knip reported those symbols as unused/dead code, red-locking the baseline gate (DR-059 step 3b: "If the
freshly-synced config RED-LOCKS the gate, STOP").

The skill's own text (`upgrade/SKILL.md` step 3) says "Leave untouched any project-specific lint/knip config
the owner added in a **separate** file (only the canonical ones are conformance-checked)" — but knip has
exactly ONE config file by its own tool design (no native "extends"/project-override layering comparable to,
say, ESLint's cascading configs), so this escape hatch literally does not exist for knip: a project cannot
add project-specific entries in a separate file the way the prose implies it can.

## Root cause

The DR-059 conformance model assumes every canonical gate config is either (a) identical across all
projects of a stack, or (b) has a native mechanism for a project to extend/override it in a side file. Knip
satisfies neither: a single `knip.json` is both the template's enforcement surface AND the only place a
project could declare its own legitimate entries/ignores, so an unconditional overwrite has no way to
preserve project-specific content without a merge step the skill doesn't perform.

## Fix plan

1. Give the conformance step a MERGE path for `knip.json` specifically (not a blind overwrite): read the
   project's current `entry`/`project`/`ignoreExportsUsedInFile`-equivalent arrays BEFORE overwriting, diff
   them against the template's, and re-append any project-only entries the template doesn't already cover
   — rather than discarding them. Land this in `plugin/skills/upgrade/SKILL.md` step 3 and (if a merge helper
   is warranted) a small script alongside `detect-gate-config-newer.sh`.
2. Alternatively/additionally, support a project-local `knip.project.json` (or similar) that the TEMPLATE's
   own `knip.json` can declare as an extension point (if knip's own config format supports composing configs
   — verify against the installed knip version's docs before committing to this path), matching the "separate
   file" escape the skill's prose already promises for other gate configs.
3. Whichever path is chosen, step 3b's post-conformance project gate run (already required by DR-059/BL-0003)
   must catch any REMAINING red-lock and block the upgrade rather than let it land silently — confirm this
   backstop still fires for a knip-caused red, not just a biome-caused one.

## Tests (prove the fix — TDD, RED → GREEN)

A fixture project whose `knip.json` carries a project-specific `entry`/ignore-equivalent entry not present
in the template; run the conformance step and assert the project-specific entry survives the overwrite (or,
if the fix is the extension-file path, assert the new file is read and respected). RED today (the entry is
silently dropped); GREEN after the fix.

## Done when

`/pandacorp:upgrade`'s conformance step preserves (merges or extends) a project's own knip entries/ignores
instead of discarding them wholesale, proven by the fixture test; the decision log records the mechanism
chosen.

## Out of scope

Redesigning DR-059 conformance for every other gate-config file (biome.json's newer-than-template path is
already handled by BL-0003); this item is scoped to knip.json's specific "one file, no extension point"
shape.
