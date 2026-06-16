# WO-02-003 — `nextStep` command map

**Module:** `lib/next-step.ts`
**IDs touched:** `CMP-02-next-step`, `IF-02-nextStep`; REQ-02-004 (also serves FRD-03/04)
**Dependencies:** WO-01-003 / WO-01-005 (FRD-01 `IdeaStatus` / `Phase` types)

## EARS criteria (from FRD-02)

- AC-02-004.1 — WHEN the owner clicks a card, the detail SHALL show the **next-step command** (with
  a copy button). This WO supplies the pure status/phase → command map.

## Contract

```ts
type NextStep = { command: string; openPath?: string; label: string };
export function nextStep(input: {
  cardStatus?: IdeaStatus; phase?: Phase; advancePending?: boolean;
}): NextStep;
```

- Pure map from lifecycle position to the `/pandacorp:*` command to copy + the folder to open.
- Command strings follow the pipeline (CLAUDE.md operation table), e.g.:
  - `discovered`/`recommended` (not handed off) → `/pandacorp:spec <idea>`.
  - `in-pipeline` + `phase: product` → `/pandacorp:design`.
  - `in-pipeline` + `phase: design` → `/pandacorp:blueprint`.
  - `in-pipeline` + `phase: architecture` → `/pandacorp:implement`.
  - `in-pipeline` + `phase: implementation`/`release` → `/pandacorp:release`.
  - `in-pipeline` + `phase: operation` → `/pandacorp:iterate` (or `:review-launch`).
  - `advancePending: true` → an "ok, advance" hint (DR-032).
  - The exact mapping table is enumerated and locked in the test.

## Definition of done

- `lib/next-step.test.ts` (RED first): one assertion per lifecycle position above, asserting the
  command string and the `openPath` where applicable.
- Pure; no fs; no write.
- `.pandacorp/verify.sh` green.

## Note for the report

The exact command per phase needs a confirmation pass against the canonical pipeline table
(CLAUDE.md / registry). Enumerated here from the operation table; if a transition command differs,
the test is the single place to adjust.
