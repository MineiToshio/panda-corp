---
id: WO-08-003
type: work-order
slug: reference-commands-agents
title: 'WO-08-003 — Reference: commands + agents (DERIVED, DR-046)'
status: DRAFT
parent: FRD-08
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-08-003 — Reference: commands + agents (DERIVED, DR-046)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-08-reference-commands`, `CMP-08-reference-agents`](../blueprint.md#5-components--interfaces) + [§2 derivation](../blueprint.md#2-how-the-reference-is-derived-the-dr-046-core).

## Goal
Render the Reference's **commands** and **agents** catalogs, **derived** from the FRD-07 readers
(`readSkills()`, `readAgents()`) — NOT a hand-maintained array. This is the DR-046 core.

## Acceptance criteria (EARS, from FRD-08 + DR-046)
- **AC-08-003.1** — The Reference SHALL list the commands (skills) derived at read time from `plugin/skills/<slug>/SKILL.md` via `readSkills()`, showing name (`/pandacorp:<slug>`) + description.
- **AC-08-003.2** — The Reference SHALL list the agents (party) derived from `plugin/agents/<id>.md` via `readAgents()`, showing name + description + model.
- **AC-08-003.3** — WHEN a skill/agent is **added, renamed or removed** in the factory, it SHALL appear/rename/disappear in the Reference **with no edit to any Manual file** (the DR-046 acceptance test) — verified by swapping the fixture tree.
- **AC-08-003.4** — There SHALL be **no hand-maintained catalog array** for commands/agents in the app (anti-pattern check).
- **AC-08-003.5** — The view SHALL use FRD-13 tokens; inline command names SHALL offer a `CopyButton` (copy only, no exec).

## Dependencies
- FRD-07 WO-07-001 (`readSkills`), WO-07-002 (`readAgents`). Cross-feature — REUSE, do not duplicate.
- WO-08-002 (shell). Intra-feature.
- FRD-02 `CopyButton`, FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests rendering from the readers; a "rename a skill dir in the fixture → label changes" test (DR-046); an anti-pattern test asserting the component imports the reader, not a literal array.
2. GREEN: implement the two catalog views over the readers.
3. Refactor.

## Definition of done
- Component tests green incl. the DR-046 swap test; tsc + biome clean; no hand-copied catalog. `.pandacorp/verify.sh` passes.
</content>
