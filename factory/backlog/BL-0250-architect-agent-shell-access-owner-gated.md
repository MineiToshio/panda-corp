---
id: BL-0250
type: change
area: plugin-agent
title: "Decide (owner-gated) whether the architect agent gets Bash for the architecture phase's read-only checks"
status: open
severity: p2
opened: 2026-10-17
closed:
source: "funko-tracker architecture phase 2026-10-16/17: architect/product-manager/copywriter could not run node, JSON parse, doc-lint, the plan checks or git rm; docs/proposals/architecture-skill-v2.md"
closes:
links: [DR-131]
---

## Problem

`plugin/agents/architect.md` (and `product-manager.md`, `copywriter.md`) declare `tools: Read, Write, Edit, Grep,
Glob, WebSearch, WebFetch`, no Bash. In funko-tracker's architecture phase every mechanical check (JSON parse of
`data-model.json`, `doc-lint.sh`, the residual-ambiguity scan, the waves/AC/plan checks, `check-fdd-coverage.mjs
--plan`) and every file deletion had to go through the lead: agents tombstoned files with `# OBSOLETE` and the lead
ran `git rm`. Plugin v9.130.0 makes that the explicit protocol (architecture SKILL "Agent reality"); this item is the
alternative: give `architect` Bash so an author can self-check before reporting.

## Fix plan

1. Owner decision (agent tools are a capability change, not a skill tweak): keep the protocol, or add `Bash` to
   `architect` only (not PM/copywriter), with the dangerous-command gate (`block-dangerous.sh`) as the guard.
2. If approved: edit `plugin/agents/architect.md` `tools:`, regenerate the Codex mirrors
   (`node plugin/scripts/generate-codex-agents.mjs`), simplify the SKILL's "Agent reality" paragraph and
   `references/blueprint-author-brief.md` ("you have no shell"), MINOR bump, decision-log.

## Tests (prove the fix — TDD, RED → GREEN)

`bash plugin/scripts/check-derived-drift.sh` green after regenerating the mirrors; documented manual repro: an
architect subagent runs `node .../waves.mjs` in a fixture project.

## Done when

- The owner's decision is recorded (decision-log); if approved, the agent file, mirrors and skill text agree.

## Out of scope

- Bash for product-manager / copywriter / researcher.
