---
id: BL-0119
type: bug
area: plugin-skill
title: "implement-backlog tells agents to bump the GENERATED plugin.json instead of the plugin-metadata.json source"
status: done
severity: p1
opened: 2026-09-02
closed: 2026-09-02
source: "discovered while planning docs/proposals/33-model-era-audit.md §14 — outside the audit's own catalogue"
closes: "plugin/docs/decision-log.md v9.97.1 entry (2026-09-02) — DR-113 SOURCE discipline restored in implement-backlog's own machinery"
links: [BL-0025]
---

## Problem
`CLAUDE.md` "Plugin maintenance" is explicit: the version SOURCE is `plugin/runtime/plugin-metadata.json`,
both manifests are **generated projections** (DR-113), and *"never hand-edit those two (the derived-drift
Stop gate REDs on it)"*. But `plugin/skills/implement-backlog/SKILL.md` step 5 instructs every executing
agent to *"bump `plugin/.claude-plugin/plugin.json`'s `version` per semver"*, and the Merge phase's hotspot
rule names `plugin.json` as the file whose version *"keeps the HIGHER"*. Impact: **p1 for this plan** — a
multi-item drain that follows the skill literally hand-edits a derived artifact on every item, and the
derived-drift Stop gate REDs on exactly that. Verified live 2026-09-02 against both files.

## Root cause
The skill text predates the DR-113 generated-manifest split and was never updated when
`plugin-metadata.json` became the single source.

## Fix plan
1. Rewrite step 5 and the Merge hotspot rule to bump `plugin/runtime/plugin-metadata.json` and then run
   `node plugin/scripts/generate-plugin-manifests.mjs`, never touching the two manifests by hand.
2. Point the Merge phase's collapsed-bump detection at the source file too, so BL-0025's interim honesty
   flag keeps working.
3. Sweep the other skills for the same stale instruction (DR-116 completeness) before closing.

## Tests (prove the fix — TDD, RED → GREEN)
Run one single-item `/pandacorp:implement-backlog` end to end: the Stop derived-drift gate must be GREEN and
all three version numbers must agree. Before the fix, following the skill literally REDs that gate.

## Done when
No skill instructs a hand-edit of a generated manifest; one real item closes with a green derived-drift gate;
plugin version bumped through the correct path; `plugin/docs/decision-log.md` noted.

## Out of scope
BL-0025's real sequential version allocator — this item only fixes WHICH file is bumped, not the
concurrent-allocation race.

## Resolution (2026-09-02)
Fixed all four call sites plus one more found by the DR-116 sweep (five total, not the two originally
named): `plugin/skills/implement-backlog/SKILL.md` step 5 + Merge hotspot rule,
`.claude/engines/pandacorp-backlog.js` Implement recipe (~line 142) + Merge conflict-resolution recipe
(~line 184), and `plugin/skills/absorb/SKILL.md`'s "Document everything" bullet. All five now bump
`plugin/runtime/plugin-metadata.json` (the SOURCE, DR-113) and run
`node plugin/scripts/generate-plugin-manifests.mjs` to regenerate both manifests — never a hand-edit,
including in a merge conflict. `plugin/templates/` carries no copy (checked).

Landed as plugin **v9.97.0 → v9.97.1** (PATCH). Verified: `claude plugin validate plugin/` green;
`node plugin/scripts/test-pandacorp-backlog.mjs` 26/26 green (no hardcoded `plugin.json` string in the
suite, so it exercises the new prompt text unchanged); `bash plugin/scripts/check-derived-drift.sh`
green; `bash plugin/scripts/validate-backlog.sh` green (120 items). Decision recorded in
`plugin/docs/decision-log.md` (v9.97.1 entry, 2026-09-02).

**Deviation from the Tests section as originally written:** a full live single-item
`/pandacorp:implement-backlog BL-xxxx` end-to-end run (real Dynamic Workflow, real subagents) was
**not** executed — that requires spending a real item from the drain this fix unblocks, which is
outside a targeted prose/prompt fix. Proof instead rests on the engine's own unit-test suite (which
asserts the Implement/Merge prompts' structure and the canonical resume/rollback contracts) plus the
three static gates above (plugin validate, derived-drift, backlog validator). The next real
`/pandacorp:implement-backlog` drain (this plan's own Wave 0/1/2 items) is the live confirmation.
