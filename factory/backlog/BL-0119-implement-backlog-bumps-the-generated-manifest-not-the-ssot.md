---
id: BL-0119
type: bug
area: plugin-skill
title: "implement-backlog tells agents to bump the GENERATED plugin.json instead of the plugin-metadata.json source"
status: open
severity: p1
opened: 2026-09-02
closed:
source: "discovered while planning docs/proposals/33-model-era-audit.md §14 — outside the audit's own catalogue"
closes:
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
