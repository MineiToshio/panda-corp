---
id: WO-07-006
type: work-order
slug: skills-section
title: 'WO-07-006 — Skills section: list + detail + mini-flow'
status: DRAFT
parent: FRD-07
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-07-006 — Skills section: list + detail + mini-flow

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-07-skill-list`, `CMP-07-skill-detail`, `CMP-07-flow-diagram`](../blueprint.md#3-components--interfaces).

## Goal
Render the Skills section: a list (grouped En la fábrica / En el proyecto by `runsIn`) of skill cards
with name + real description, and a detail view with purpose, where it runs, what it produces, and a
**mini-flow** of agent chips (colored per agent) with arrows.

## Acceptance criteria (EARS, from FRD-07)
- **AC-07-006.1** — The Skills section SHALL list each skill with its name (`/pandacorp:<slug>`) and its real description (from `readSkills()`), grouped by `runsIn`.
- **AC-07-006.2** — WHEN the owner clicks a skill, the system SHALL show its detail: what it is for, where it runs (factory/project), what it produces.
- **AC-07-006.3** — The skill detail SHALL show a high-level **mini-flow** — chips of the agents it uses, **colored per agent** (FRD-13 per-agent tokens), connected with arrows.
- **AC-07-006.4** — WHERE a skill has no machine-readable flow, the diagram SHALL degrade to the ordered agent list (no invented steps).
- **AC-07-006.5** — The content SHALL be read-only; there is no edit affordance.

## Dependencies
- WO-07-001 (`readSkills()`), WO-07-005 (page shell). Intra-feature.
- FRD-13 per-agent accent tokens. Cross-feature.

## TDD plan
1. RED: tests for list grouping, click→detail, mini-flow chips colored per agent, degrade-to-list.
2. GREEN: implement list + detail + flow-diagram components.
3. Refactor.

## Definition of done
- Component tests green; tsc + biome clean; tokens only; no `any`. `.pandacorp/verify.sh` passes.
</content>
