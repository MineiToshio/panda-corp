---
id: WO-07-001
type: work-order
slug: reference
title: 'WO-07-001 — `lib/reference.ts`: read skills + agents catalogs'
status: DRAFT
parent: FRD-07
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-07-001 — `lib/reference.ts`: read skills + agents catalogs

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-07-reference`](../blueprint.md#3-components--interfaces).

## Goal
Implement the **complete `lib/reference.ts`** reader — both catalogs in one module, since they share
the file and the `readPluginDir` helper:

- `readSkills()` — derive the skills catalog from `plugin/skills/<slug>/SKILL.md`: the **directory
  name** is the slug, the `description` frontmatter is the description, the body is kept for the detail
  view.
- `readAgents()` — derive the agents catalog from `plugin/agents/<id>.md` frontmatter (`name`,
  `description`, `model`) plus the body.

**No hand-copied list** (DR-046) — both catalogs are derived, never static arrays.

## In Scope
- `lib/reference.ts` (+ `lib/reference.test.ts`) exporting `readSkills()` and `readAgents()`.
- A shared `readPluginDir` helper used by both readers (defined once here).
- Reads from `resolveFactoryRoot()` (FRD-01 `lib/config.ts`), honoring `PANDACORP_FACTORY_ROOT`.

## Out of Scope
- The Configuration page shell (WO-07-005) and the Skills/Agents UI sections (WO-07-006/007).
- The other readers: `lib/registry.ts` (WO-07-003), `lib/standards.ts` (WO-07-004).

## Acceptance criteria (EARS, from FRD-07 + DR-046)

### Skills catalog
- **AC-07-001.1** — WHEN `readSkills()` runs, it SHALL return one entry per `plugin/skills/<slug>/SKILL.md`, with `slug` = the directory name (NOT a `name:` field) and `description` = the frontmatter `description`.
- **AC-07-001.2** — WHEN a skill has no `description` frontmatter or malformed frontmatter, the system SHALL skip it with a typed warning and SHALL NOT throw (the catalog still renders the rest).
- **AC-07-001.3** — The entry SHALL include the raw body markdown (for the detail view) and a `runsIn` field inferred from the description/body (`"factory" | "project" | "unknown"`) — inferred, never invented; ambiguous → `"unknown"`.
- **AC-07-001.4** — The reader SHALL read from `resolveFactoryRoot()` (FRD-01 `lib/config.ts`), honoring `PANDACORP_FACTORY_ROOT`, so tests point at a fixture tree.
- **AC-07-001.5** — The catalog SHALL reflect added/renamed/removed skills automatically on next read (no static array), verified by a fixture with a renamed dir.

### Agents catalog
- **AC-07-002.1** — WHEN `readAgents()` runs, it SHALL return one entry per `plugin/agents/<id>.md` with `id` (filename without extension), `name`, `description`, `model` (from frontmatter) and the body markdown.
- **AC-07-002.2** — WHEN an agent file lacks `name`/`description`/`model`, the reader SHALL fill the missing field with a typed null/`"unknown"` and SHALL NOT throw; a totally malformed file is skipped with a warning.
- **AC-07-002.3** — The reader SHALL read from `resolveFactoryRoot()` (FRD-01) so tests use a fixture tree.
- **AC-07-002.4** — The catalog SHALL reflect added/renamed/removed agents automatically on next read (no static array), verified by a fixture.

## Dependencies
- FRD-01 `lib/config.ts` (`resolveFactoryRoot`, env override). Cross-feature.
- Libraries: `gray-matter` (frontmatter), Node `fs` — both in the approved stack (architecture §2).

## TDD plan (RED → GREEN → refactor)
1. Fixture trees under `__fixtures__/plugin/skills/` (a well-formed skill, a frontmatter-less skill, a renamed-dir skill) and `__fixtures__/plugin/agents/` (a well-formed agent, one missing `model`, one malformed).
2. RED: `lib/reference.test.ts` asserting — skills: slug-from-dir, description, skip-malformed, `runsIn` inference, renamed-dir reflected; agents: id-from-filename, frontmatter fields, missing-field tolerance, skip-malformed.
3. GREEN: implement `readSkills()` and `readAgents()`.
4. Refactor: extract the shared `readPluginDir` helper used by both readers.

## Definition of done
- `pnpm vitest run lib/reference.test.ts` green; `pnpm tsc --noEmit` clean; `pnpm biome check .` clean.
- No `any`/`@ts-ignore`. No hardcoded skills/agents list. `.pandacorp/verify.sh` passes.
</content>
