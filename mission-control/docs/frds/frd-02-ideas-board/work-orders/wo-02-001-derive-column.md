# WO-02-001 — `deriveColumn` two-axis logic

**Module:** `lib/board.ts`
**IDs touched:** `CMP-02-board-derive`, `IF-02-deriveColumn`; REQ-02-001
**Dependencies:** WO-01-003 (`readIdeas` types), WO-01-005 (`readStatus` types) — FRD-01

## EARS criteria (from FRD-02)

- AC-02-001.1 — The board SHALL place each idea into one of `discovered → documented → design →
  architecture → building → shipped` (+ `discarded`) by deriving the column from two axes (card
  `status` + project `phase`), NOT from the card `status` alone.
- AC-02-001.2 — `discovered`/`recommended` → **discovered** (recommended shows a badge).
- AC-02-001.3 — `in-pipeline` → column from project `phase`: `product`→documented, `design`→design,
  `architecture`→architecture, `implementation`/`release`→building, `operation`→shipped.
- AC-02-001.4 — `shipped` → shipped; `discarded` → discarded.
- AC-02-001.5 — The board SHALL NOT expect `design`/`architecture`/`building` as a card `status`.
- AC-02-001.6 — IF an in-pipeline card's project or `status.yaml` is missing, THEN it SHALL fall
  back to the **documented** column without breaking.

## Contract

```ts
type BoardColumn = "discovered" | "documented" | "design" | "architecture" | "building" | "shipped" | "discarded";
export function deriveColumn(card: IdeaCard, projectStatus: StatusResult | null): BoardColumn;
```

Pure function (no fs). The mapping table is the blueprint §2.

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
