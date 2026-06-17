---
id: WO-08-001
type: work-order
slug: manual-index
title: 'WO-08-001 — `lib/manual.ts`: index authored Manual content'
status: DRAFT
parent: FRD-08
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
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

## Status Note

**Built:** `lib/manual.ts` — new module `IF-08-manual-index`. Indexes all authored Manual pages
from `content/manual/<group>/*.md` (Diátaxis: tutorial / guides / concepts), returning grouped,
sorted `ManualPage[]`.

**Interface/contract exposed:**
```ts
// lib/manual.ts
export type ManualPage = {
  group: string;   // Diátaxis quadrant (from frontmatter `group`)
  slug: string;    // filename without extension
  title: string;   // from frontmatter `title`
  order: number;   // from frontmatter `order`
  body: string;    // full markdown, frontmatter stripped
};

export function readManualPages(appRoot?: string): ManualPage[]
// Default appRoot = process.cwd() (mission-control/). Override for fixture tests.
// Returns pages sorted by (group ASC, order ASC). Never throws.
// Missing content/manual/ → []. Malformed page (missing title/group/order) → skipped + console.warn.
```

**Integration seams:**
- Consumers: `app/manual/` Server Components (CMP-08-manual-page, CMP-08-doc-nav, CMP-08-doc-reader)
  — call `readManualPages()` with no args (uses live `content/manual/`).
- Content authors: place `.md` files under `content/manual/<group>/` with frontmatter
  `title`, `group`, `order`. `.mdx` extension also accepted.
- The `content/manual/` directory is created as an empty tree (tutorial / guides / concepts
  subdirectories) by this WO; actual page content is authored in later WOs.

**Test file:** `lib/manual.test.ts` — 19 tests, covers all 4 ACs:
- AC-08-001.1: field shape (group, slug, title, order, body; frontmatter stripped from body)
- AC-08-001.2: deterministic sort (group ASC then order ASC across repeated calls)
- AC-08-001.3: malformed pages (missing title / group / order each tested separately; warns + skips; no throw)
- AC-08-001.4: fixture-testable via `appRoot` param; ignores non-.md files; tolerates empty dirs

**Gate:** 19/19 tests GREEN. tsc clean. biome clean. verify.sh PASS (4579 tests, 168 files).
</content>
