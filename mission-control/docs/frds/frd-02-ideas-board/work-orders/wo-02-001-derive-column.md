---
id: WO-02-001
type: work-order
slug: derive-column
title: WO-02-001 — `deriveColumn` two-axis logic
status: ACTIVE
parent: FRD-02
foundation: false
implementation_status: VERIFIED
artifacts:
  - 'src/lib/board/board.ts'
  - 'src/lib/board/_tests/board.test.ts'
  - 'src/lib/board/_tests/board.adversarial.test.ts'
source_requirements: [REQ-02-001]
dependsOn: [WO-01-003, WO-01-005]
last_updated: '2026-10-22'
---
# WO-02-001 — `deriveColumn` two-axis logic

> **Kept live in v2 «Órbita» (wo-map §0.5, 2026-10-22).** VERIFIED library, unchanged in v2 and consumed by the board
> (WO-02-015). It owns no live acceptance criterion; it traces REQ-02-001 (FRD-02#U1). Its v1 criteria are kept below
> as non-owning history.

## Summary

The pure two-axis board-column derivation (`deriveColumn(card, projectStatus)`): card `status` plus the linked
project's phase decide the column, with the `documented` fallback when the project or its status is missing.

**Module:** `lib/board.ts`
**IDs touched:** `CMP-02-board-derive`, `IF-02-deriveColumn`; REQ-02-001
**Dependencies:** WO-01-003 (`readIdeas` types), WO-01-005 (`readStatus` types) — FRD-01

## v1 delivery record

- v1 AC-02-001.1: The board SHALL place each idea into one of `discovered → documented → design →
  architecture → building → shipped` (+ `discarded`) by deriving the column from two axes (card
  `status` + project `phase`), NOT from the card `status` alone.
- v1 AC-02-001.2: `discovered`/`recommended` → **discovered** (recommended shows a badge).
- v1 AC-02-001.3: `in-pipeline` → column from project `phase`: `product`→documented, `design`→design,
  `architecture`→architecture, `implementation`→building, `release`→shipped.
- v1 AC-02-001.4: `shipped` → shipped; `discarded` → discarded.
- v1 AC-02-001.5: The board SHALL NOT expect `design`/`architecture`/`building` as a card `status`.
- v1 AC-02-001.6: IF an in-pipeline card's project or `status.yaml` is missing, THEN it SHALL fall
  back to the **documented** column without breaking.

## Contract

```ts
type BoardColumn = "discovered" | "documented" | "design" | "architecture" | "building" | "shipped" | "discarded";
export function deriveColumn(card: IdeaCard, projectStatus: StatusResult | null): BoardColumn;
```

Pure function (no fs). The mapping is FRD-02's first requirement bullet (REQ-02-001), locked in the tests.

## Definition of done

- `lib/board.test.ts` (RED first) — one case per row of the mapping table, including:
  - `recommended` → `discovered` (flag/badge handled by the card, but column is `discovered`).
  - each `in-pipeline` phase → its column.
  - `in-pipeline` with `projectStatus = null` and with `{ present: false }` and with
    `{ malformed: true }` → all fall back to `documented` (AC-02-001.6).
- Pure; no write; no throw.
- `.pandacorp/verify.sh` green.

## Status

- [x] **DONE** — 2026-06-16
  - `lib/board.ts` implements `deriveColumn` (pure function, no fs, no throw).
  - `lib/board.test.ts` covers all mapping table rows (55 test cases incl. fallback, regression B1', I3, mutation anchors).
  - Committed: `c43d56c feat(mission-control): WO-02-001 — deriveColumn two-axis logic (lib/board.ts)`.
  - `bash .pandacorp/verify.sh` result: ✅ all gates green (biome + tsc + vitest — 855 tests, 29 files, HEAD `28a3eef`).
