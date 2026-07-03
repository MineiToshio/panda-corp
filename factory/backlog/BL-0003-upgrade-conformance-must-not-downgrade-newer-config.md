---
id: BL-0003
type: bug
area: plugin-skill
title: "/upgrade conformance overwrote a newer-than-template gate config and red-locked the baseline"
status: done
severity: p1
opened: 2026-06-30
closed: 2026-07-03
source: "LESSON-0004"
closes: "DR-076 amendment (registry) + plugin/scripts/detect-gate-config-newer.sh + /upgrade step 3b (post-conformance project gate) + build-orchestration.md §5; plugin v9.59.0"
links: [LESSON-0004, DR-076, DR-059, DR-048]
---

## Problem
`/pandacorp:upgrade`'s DR-059 conformance step overwrites canonical gate files verbatim from the plugin
template on the doctrine that the template is never behind a project (DR-076). On personal-page-v2 the
project's `biome.json` was NEWER than the template (schema 2.5.1 + `preset: recommended`, required by biome
2.5.1) and conformance reverted it to the stale form (schema 2.5.0 + deprecated `recommended: true`). Under
`biome check --error-on-warnings` that red-locks the whole-project baseline; it did not surface in pass-1
(`verify.sh --since` lints only changed files) and only the pass-2 full baseline self-heal caught it
(builtFrds:[], blockedReasons:{baseline:error}). Impact: an upgrade silently reverted a real fix and left the
next build to discover a dead gate.

## Root cause
DR-076's "the template is never behind a project" is treated as an INVARIANT but is only an ASSUMPTION.
Conformance overwrites blindly, and the at-upgrade "functionally identical" check tested rule *behavior*, not
whether the config still passes its own gate under `--error-on-warnings`. So a project that legitimately raced
ahead of the template (newer tool + newer config) gets silently downgraded, and nothing runs the gate on the
freshly-synced config to catch the red-lock.

## Fix plan
1. **Upgrade runs the gate AFTER re-syncing conformance files, on the project.** After the DR-059 overwrite,
   `/upgrade` runs `verify.sh` (or at least `biome check --error-on-warnings` + `knip` + `tsc`) on the project
   and FAILS LOUD if the freshly-synced config red-locks the gate — never leave a broken baseline for the next
   build to discover (the DR-079 canary proves gates bite on a broken fixture; it does NOT prove the project
   still passes after the overwrite). Edit `plugin/skills/upgrade/SKILL.md` (post-conformance project gate run)
   + note in `factory/standards/build-orchestration.md`.
2. **Detect "project config newer than template" before overwriting (DR-076 amendment).** The loud back-port
   detector compares tool/schema versions (e.g. biome `$schema` URL vs installed tool in package.json): if the
   project's is newer/correct for the installed tool, back-port the project's version to the template FIRST,
   then overwrite (no-op) — never silently downgrade. Strengthen the detector in `plugin/skills/upgrade/SKILL.md`.
3. **An "equivalent configs" claim must run the FULL gate on both forms** (incl. `--error-on-warnings`), never
   a hand sample.

## Tests (prove the fix — TDD, RED → GREEN)
- **Post-conformance gate (manual repro / script assertion):** stand up a fixture project whose `biome.json` is
  the newer 2.5.1 form (matching an installed biome 2.5.1) and run `/upgrade`. The old flow silently downgrades
  to 2.5.0 and leaves the baseline RED; after the fix, the post-conformance `verify.sh` run must FAIL LOUD (or
  the back-port must prevent the downgrade so the gate stays green). Automation is a shell fixture + a
  `verify.sh` exit-code assertion; a scripted-repro is acceptable here because it exercises the real tool.
- **Back-port detector (unit/script, `upgrade` SKILL logic):** given a project schema URL newer than the
  template's for the same installed tool, assert the detector reports "project newer" and triggers back-port,
  not overwrite. The stale-project case (project older) must still overwrite. Fails today (no version compare).
- **Canary sanity:** confirm the DR-079 gate canary still goes RED on the deliberately-broken fixture (proves
  this change didn't neuter the gate), separate from the new post-overwrite project run.

## Done when
`/upgrade` runs a post-conformance project gate and fails loud on a red-locking overwrite (proven by the
fixture repro); the back-port detector catches a newer-than-template config; DR-076 amended in the registry;
`factory/standards/build-orchestration.md` updated; plugin bumped. Then set LESSON-0004 `promotion: approved`
and back-link this item. (Note: the specific biome 2.5.1 back-port already shipped — `OVERLAY_VERSION` 8.52.0,
plugin 9.36.1 — this item is the SYSTEMIC guard so the class can't recur.)

## Out of scope
The already-shipped one-off biome 2.5.1 back-port itself (done); redesigning DR-059 conformance for
non-gate files — this item only hardens the gate-config path against silent downgrade.
