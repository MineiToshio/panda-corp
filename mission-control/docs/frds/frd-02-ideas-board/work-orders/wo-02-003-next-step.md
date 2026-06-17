---
id: WO-02-003
type: work-order
slug: next-step
title: WO-02-003 — `nextStep` command map
status: DRAFT
parent: FRD-02
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
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

- [x] `lib/next-step.test.ts` (RED first): one assertion per lifecycle position above, asserting the
  command string and the `openPath` where applicable.
- [x] Pure; no fs; no write.
- [x] `.pandacorp/verify.sh` green.

## Note for the report

The exact command per phase needs a confirmation pass against the canonical pipeline table
(CLAUDE.md / registry). Enumerated here from the operation table; if a transition command differs,
the test is the single place to adjust.

## Evidence

- Implementation: `lib/next-step.ts` — pure `nextStep()` function, IF-02-nextStep contract.
- Tests: `lib/next-step.test.ts` (49 tests, all lifecycle positions + DR-032 + edge cases) and
  `lib/next-step.adversarial.test.ts` (reviewer-written adversarial tests).
- verify.sh run: `bash mission-control/.pandacorp/verify.sh` — 37 test files, 1057 tests passed,
  biome (info only, no errors), tsc clean. Command: `pnpm vitest run --reporter=dot`.

## Status Note

**Built:** `lib/next-step.ts` — `CMP-02-next-step` — pure `nextStep()` function implementing IF-02-nextStep.

**What it does:** Maps a card's lifecycle position (cardStatus + phase + advancePending) to the next `/pandacorp:*` command to copy and run, plus a human-readable Spanish label. No fs, no writes, no side effects. Never throws.

**Interface / contract exposed:**

```ts
// lib/next-step.ts
export type NextStep = { command: string; openPath?: string; label: string };
export type NextStepInput = { cardStatus?: IdeaStatus; phase?: Phase; advancePending?: boolean };
export function nextStep(input: NextStepInput): NextStep;

// Also exports (WO-04-003 extension, same file):
export interface CommandRow { command: string; when: string }
export function workspaceCommands(phase: Phase): CommandRow[];
```

**Mapping table (locked in tests):**

| cardStatus | phase | command |
|---|---|---|
| `discovered` / `recommended` | — | `/pandacorp:spec <idea>` |
| `in-pipeline` | `product` | `/pandacorp:design` |
| `in-pipeline` | `design` | `/pandacorp:blueprint` |
| `in-pipeline` | `architecture` | `/pandacorp:implement` |
| `in-pipeline` | `implementation` / `release` | `/pandacorp:release` |
| `in-pipeline` | `operation` | `/pandacorp:iterate` |
| `in-pipeline` | undefined (upstream rejection) | `/pandacorp:spec <idea>` (safe fallback) |
| `shipped` | — | `/pandacorp:review-launch` |
| `discarded` | — | `/pandacorp:recommend` |

DR-032: `advancePending: true` appends `" — escribe «ok, advance» para continuar"` to the label (command unchanged) so the owner sees a distinguishable hint.

**Integration seams:**
- Consumed by `components/CardDetail.tsx` (WO-02-007) — passes `card.status` + `projectStatus.phase` + `projectStatus.advancePending` to `nextStep()` and renders the result with `CopyButton`.
- Also consumed by `app/projects/[slug]/_components/tab-commands.tsx` (WO-04-007) via `workspaceCommands(phase)`.
- Imports `IdeaStatus` from `./ideas` and `Phase` from `./status` (both FRD-01 types, WO-01-003/005).

**Test files covering this WO:**
- `lib/next-step.test.ts` — 57 tests: all lifecycle positions, DR-032 advancePending, terminal states, edge cases, mutation-killing mapping table, pure-function invariants, B1'/I3 regressions.
- `lib/next-step.adversarial.test.ts` — 30 adversarial tests.
- `lib/next-step.wo04003.test.ts` + `lib/next-step.wo04003.adversarial.test.ts` — 88 tests for `workspaceCommands()` (WO-04-003 extension co-located here).

**Final verify.sh run (2026-06-17):** 105 test files, 3080 passed, 2 expected fail, 5 skipped. biome clean, tsc clean.
