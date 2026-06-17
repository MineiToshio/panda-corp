---
id: WO-07-001
type: work-order
slug: reference-skills
title: 'WO-07-001 — `lib/reference.ts`: read skills catalog'
status: DRAFT
parent: FRD-07
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-07-001 — `lib/reference.ts`: read skills catalog

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-07-reference`](../blueprint.md#3-components--interfaces).

## Goal
Implement `readSkills()` in `lib/reference.ts`: derive the skills catalog from
`plugin/skills/<slug>/SKILL.md` — the **directory name** is the slug, the `description` frontmatter
is the description, the body is kept for the detail view. **No hand-copied list** (DR-046).

## Acceptance criteria (EARS, from FRD-07 + DR-046)
- **AC-07-001.1** — WHEN `readSkills()` runs, it SHALL return one entry per `plugin/skills/<slug>/SKILL.md`, with `slug` = the directory name (NOT a `name:` field) and `description` = the frontmatter `description`.
- **AC-07-001.2** — WHEN a skill has no `description` frontmatter or malformed frontmatter, the system SHALL skip it with a typed warning and SHALL NOT throw (the catalog still renders the rest).
- **AC-07-001.3** — The entry SHALL include the raw body markdown (for the detail view) and a `runsIn` field inferred from the description/body (`"factory" | "project" | "unknown"`) — inferred, never invented; ambiguous → `"unknown"`.
- **AC-07-001.4** — The reader SHALL read from `resolveFactoryRoot()` (FRD-01 `lib/config.ts`), honoring `PANDACORP_FACTORY_ROOT`, so tests point at a fixture tree.
- **AC-07-001.5** — The catalog SHALL reflect added/renamed/removed skills automatically on next read (no static array), verified by a fixture with a renamed dir.

## Dependencies
- FRD-01 `lib/config.ts` (`resolveFactoryRoot`, env override). Cross-feature.
- Libraries: `gray-matter` (frontmatter), Node `fs` — both in the approved stack (architecture §2).

## TDD plan (RED → GREEN → refactor)
1. Fixture tree under `__fixtures__/plugin/skills/` with: a well-formed skill, a frontmatter-less skill, a renamed-dir skill.
2. RED: `lib/reference.test.ts` asserting slug-from-dir, description, skip-malformed, `runsIn` inference.
3. GREEN: implement `readSkills()`.
4. Refactor: extract a shared `readPluginDir` helper (reused by WO-07-002).

## Definition of done
- `pnpm vitest run lib/reference.test.ts` green; `pnpm tsc --noEmit` clean; `pnpm biome check .` clean.
- No `any`/`@ts-ignore`. No hardcoded skill list. `.pandacorp/verify.sh` passes.
</content>
