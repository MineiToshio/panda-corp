# WO-08-001 — `lib/manual.ts`: index authored Manual content

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`IF-08-manual-index`](../blueprint.md#5-components--interfaces) + [§7 new module](../blueprint.md#7-new-lib-module-flagged).

## Goal
Implement `readManualPages()` in `lib/manual.ts` (**new module**): index the app-local authored
Manual content (Tutorial/Guides/Concepts MDX/markdown under `content/manual/`), returning grouped,
ordered pages with title and body. Distinct from `lib/docs.ts` (per-project docs).

## Acceptance criteria (EARS, from FRD-08)
- **AC-08-001.1** — `readManualPages()` SHALL return one entry per authored page with `group` (Diátaxis quadrant), `slug`, `title`, `order`, `body`.
- **AC-08-001.2** — Pages SHALL be returned grouped and ordered per their declared `group`/`order` so the side menu is deterministic.
- **AC-08-001.3** — WHEN a page file is malformed or missing required metadata, the reader SHALL skip it with a typed warning and SHALL NOT throw.
- **AC-08-001.4** — The reader SHALL read the app's own `content/manual/` tree (not the factory repo), and SHALL be fixture-testable.

## Dependencies
- FRD-01 `lib/config.ts` pattern (fixture testing). Cross-feature.
- Libraries: `gray-matter` (page frontmatter), Node `fs`.

## TDD plan
1. Fixture `content/manual/` with two groups, ordered pages, one malformed.
2. RED: tests for grouping, ordering, skip-malformed, fields.
3. GREEN: implement `readManualPages()`.
4. Refactor.

## Definition of done
- `pnpm vitest run lib/manual.test.ts` green; tsc + biome clean; no `any`/`@ts-ignore`.
- New module recorded in blueprint §7. `.pandacorp/verify.sh` passes.
</content>
