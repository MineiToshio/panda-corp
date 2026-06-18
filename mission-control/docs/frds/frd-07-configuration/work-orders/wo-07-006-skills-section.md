---
id: WO-07-006
type: work-order
slug: skills-section
title: 'WO-07-006 — Skills section: list + detail + mini-flow'
status: DRAFT
parent: FRD-07
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
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

## Status Note

Built the full Skills section end-to-end (list → detail → mini-flow) as four components:

**Components shipped:**

- `app/configuration/SkillList.tsx` (`CMP-07-skill-list`) — groups skills by `runsIn` into "En la fábrica" / "En el proyecto" / "Otros"; each card is a `<button>` with `data-testid="skill-card-{slug}"`. Empty state via `data-testid="skill-list-empty"`.
- `app/configuration/SkillDetail.tsx` (`CMP-07-skill-detail`) — detail panel with `data-testid="skill-detail"`, shows name (`/pandacorp:{slug}`), description, Spanish `runsIn` label, body text, and embeds `FlowDiagram`. Back button (`data-testid="skill-detail-back"`). Read-only, no edit affordance (AC-07-006.5).
- `app/configuration/FlowDiagram.tsx` (`CMP-07-flow-diagram`) — exports `extractAgents(body): AgentRole[]` (pure, tested). Regex finds `## Agents used` / `## Agentes usados` block, then scans bullets for canonical `AGENT_ROLES` (longest-first to avoid partial matches). Chips: `data-testid="flow-agent-chip-{role}"` + `data-agent-color="--color-agent-{role}"`. Arrows: `data-testid="flow-arrow-{idx}"`. Empty: `data-testid="flow-diagram-empty"` (AC-07-006.4). All chip colors via `var(${AGENT_COLOR[role]}, currentColor)` — zero hardcoded colors (FRD-13).
- `app/configuration/SkillsSection.tsx` — client coordinator; owns `selectedSkill` state; renders `SkillList` or `SkillDetail` (not both). `data-testid="skills-section"`.

**Integration seams:**
- `ConfigurationShell.tsx` accepts `skills?: SkillRef[]` prop and passes to `SkillsSection` in the `"skills"` tab panel (`data-testid="config-section-skills"`, `aria-labelledby="config-tab-id-skills"`).
- `app/configuration/page.tsx` calls `readSkills()` (server side) and passes result as `skills` prop to `ConfigurationShell`.

**Interfaces/contracts:**
- `SkillListProps`: `{ skills: SkillRef[]; onSelect: (skill: SkillRef) => void }`
- `SkillDetailProps`: `{ skill: SkillRef; onBack: () => void }`
- `FlowDiagramProps`: `{ body: string }` — exported `extractAgents(body: string): AgentRole[]`
- `SkillsSectionProps`: `{ skills: SkillRef[] }`

**Test file:** `app/configuration/skills.test.tsx` — 45 tests covering AC-07-006.1..5 (grouping, click→detail, agent chip colors, degrade empty, read-only). `.pandacorp/verify.sh` green: 4560 passed + 2 xfail + 5 skipped; tsc --noEmit clean; biome check clean.
