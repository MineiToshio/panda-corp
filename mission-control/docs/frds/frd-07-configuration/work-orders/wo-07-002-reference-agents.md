# WO-07-002 — `lib/reference.ts`: read agents catalog

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-07-reference`](../blueprint.md#3-components--interfaces).

## Goal
Implement `readAgents()` in `lib/reference.ts`: derive the agents catalog from `plugin/agents/<id>.md`
frontmatter (`name`, `description`, `model`) plus the body. **No hand-copied list** (DR-046).

## Acceptance criteria (EARS, from FRD-07 + DR-046)
- **AC-07-002.1** — WHEN `readAgents()` runs, it SHALL return one entry per `plugin/agents/<id>.md` with `id` (filename without extension), `name`, `description`, `model` (from frontmatter) and the body markdown.
- **AC-07-002.2** — WHEN an agent file lacks `name`/`description`/`model`, the reader SHALL fill the missing field with a typed null/`"unknown"` and SHALL NOT throw; a totally malformed file is skipped with a warning.
- **AC-07-002.3** — The reader SHALL read from `resolveFactoryRoot()` (FRD-01) so tests use a fixture tree.
- **AC-07-002.4** — The catalog SHALL reflect added/renamed/removed agents automatically on next read (no static array), verified by a fixture.

## Dependencies
- FRD-01 `lib/config.ts`. Cross-feature.
- Shares the `readPluginDir` helper from WO-07-001 (soft dependency: either WO can introduce it).
- Libraries: `gray-matter`, Node `fs`.

## TDD plan
1. Fixture tree `__fixtures__/plugin/agents/` with a well-formed agent, one missing `model`, one malformed.
2. RED: tests for id-from-filename, frontmatter fields, missing-field tolerance, skip-malformed.
3. GREEN: implement `readAgents()`.
4. Refactor: dedupe with WO-07-001's helper.

## Definition of done
- `pnpm vitest run lib/reference.test.ts` green; tsc + biome clean; no `any`/`@ts-ignore`.
- No hardcoded agents list. `.pandacorp/verify.sh` passes.
</content>
