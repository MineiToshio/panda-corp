---
id: BL-0101
type: bug
area: build-engine
title: "The backlog-scan step asks a haiku (MECH) agent to judge how much each item's Fix plan touches"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-05 + §7's non-agent re-tier"
closes: "plugin v9.98.10 — .claude/engines/pandacorp-backlog.js Scan dispatch re-tiered haiku->sonnet + id normalization/skipped reporting; plugin/docs/decision-log.md 2026-09-03 entry"
links: [LESSON-0076]
---

## Problem
`.claude/engines/pandacorp-backlog.js:87-91` dispatches the Scan phase at `model: 'haiku'` while its rubric
asks the agent to judge *"how much its `## Fix plan` section actually touches (read the file body, not just
the frontmatter)"*. `factory/standards/conventions.md:48` defines MECH as *"mechanical, zero judgment…
grep-and-report"*. The scan returns inventory facts (`id`, `path`, `status`) `[demonstrated]` **and** infers
a tier `[expected, not demonstrated]`. Impact: this step decides which model implements every future BL
item. Note the audit's own correction — `LESSON-0076` records a cheap-tier subagent returning a stale
**inventory** fact, not bad judgement, and is `status: candidate`, `promotion: none`, `confidence: medium`,
`times_applied: 0`; leaning on it as settled is what CONV-13 exists to stop. Risk is low either way: the
Merge phase re-validates with `validate-backlog.sh`, so a wrong tier wastes tokens, never corrupts state.

## Root cause
The tier inference was added to a step whose model was chosen for the inventory half of its job.

## Fix plan
Run the diff canary first (below). Then either (a) re-tier the Scan dispatch UP to `sonnet` (+$0.156 per
scan call, one per drain — negligible against wrong-tier dispatch of a whole item), or (b) replace the
inference with a deterministic `severity → tier` lookup table, leaving the agent only the inventory read.
Prefer (b) if the diff shows the inference is mostly mechanical anyway.

## Tests (prove the fix — TDD, RED → GREEN)
Run the scan over the current `BL-*` set with haiku and with a deterministic table; diff the assigned tiers;
investigate every mismatch and record the count.

## Done when
The Scan step no longer asks a MECH-tier agent for a judgment call; the tier diff is recorded in
`plugin/docs/decision-log.md`; plugin version bumped.

## Out of scope
CONV-12's rubric itself, and any change to the Implement/Merge phases.
