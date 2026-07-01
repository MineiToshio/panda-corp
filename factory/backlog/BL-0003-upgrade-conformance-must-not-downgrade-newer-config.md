---
id: BL-0003
type: bug
area: plugin-skill
title: /upgrade conformance overwrote a newer-than-template gate config and red-locked the baseline
status: open
severity: p1
opened: 2026-06-30
closed:
source: LESSON-0004
closes:
links: [LESSON-0004, DR-076, DR-059, DR-048]
---

**Problem:** `/pandacorp:upgrade`'s DR-059 conformance step overwrites canonical gate files verbatim from
the plugin template on the doctrine that the template is never behind a project (DR-076). On personal-page-v2
the project's `biome.json` was NEWER than the template (schema 2.5.1 + `preset: recommended`, required by
biome 2.5.1) and conformance reverted it to the stale form (schema 2.5.0 + deprecated `recommended: true`).
Under `biome check --error-on-warnings` that red-locks the whole-project baseline; it did not surface in
pass-1 (`verify.sh --since` lints only changed files) and only the pass-2 full baseline self-heal caught it
(builtFrds:[], blockedReasons:{baseline:error}). The at-upgrade "functionally identical" check tested rule
behavior, not the config passing its own gate. So DR-076's "template is never behind a project" is an
ASSUMPTION, not an invariant, and blind conformance can revert a real fix and red-lock the gate.

**Fix plan:**
1. **Upgrade runs the gate AFTER re-syncing conformance files, on the project.** After the DR-059 overwrite,
   `/upgrade` runs `verify.sh` (or at least `biome check --error-on-warnings` + `knip` + `tsc`) on the
   project and FAILS LOUD if the freshly-synced config red-locks the gate — never leave a broken baseline for
   the next build to discover (the DR-079 canary proves gates bite on a broken fixture; it does NOT prove the
   project still passes after the overwrite). Edit `plugin/skills/upgrade/SKILL.md` (post-conformance project
   gate run) + note in `factory/standards/build-orchestration.md`.
2. **Detect "project config newer than template" before overwriting (DR-076 amendment).** The loud back-port
   detector compares tool/schema versions (e.g. biome `$schema` URL vs installed tool in package.json): if
   the project's is newer/correct for the installed tool, back-port the project's version to the template
   FIRST, then overwrite (no-op) — never silently downgrade. Strengthen the detector in
   `plugin/skills/upgrade/SKILL.md`.
3. **An "equivalent configs" claim must run the FULL gate on both forms** (incl. `--error-on-warnings`),
   never a hand sample.

**Done when:** `/upgrade` runs a post-conformance project gate and fails loud on a red-locking overwrite;
the back-port detector catches a newer-than-template config; DR-076 amended in the registry;
`factory/standards/build-orchestration.md` updated; plugin bumped. Then set LESSON-0004 `promotion: approved`
and back-link this item. (Note: the specific biome 2.5.1 back-port already shipped — `OVERLAY_VERSION`
8.52.0, plugin 9.36.1 — this item is the SYSTEMIC guard so the class can't recur.)
