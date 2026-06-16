# WO-04-002 — `lib/docs.ts`: activity log + decisions readers

**Feature:** FRD-04 · **Implements:** IF-04-docs (`readActivityLog`, `readDecisions`) · **REQ-04-003, REQ-04-004**
**Deploy unit:** additions to `lib/docs.ts` (+ tests in `lib/docs.test.ts`). Library only, no UI.

## Acceptance criteria (copied)
- **AC-04-003.2** The Summary tab SHALL render the activity log read from `.pandacorp/comms/progress.md`; WHEN the file is absent it SHALL show a graceful "no activity yet" empty state.
- **AC-04-003.3** The Summary tab SHALL render the decision points read from `.pandacorp/inbox/decisions.md`, each highlighted, with a total count badge.

> This WO covers the **reader half**. The Summary tab UI is WO-04-005.

## Scope
- `readActivityLog(projectPath): ActivityLog` — parse `.pandacorp/comms/progress.md` into a list of
  high-level entries (bullet lines / log items). Absent file → `{ entries: [] }` (no throw).
- `readDecisions(projectPath): DecisionPoint[]` — parse `.pandacorp/inbox/decisions.md` into
  `{ title, recommendation?, resolved }`. Absent file → `[]`. A pending count is derived by the
  caller as `filter(!resolved).length` (and cross-checked against `status.pending_decisions`).
- These files are **Spanish, gitignored** owner-facing comms (architecture §4.5) — read as-is.
- **Out of scope:** highlighting/UI (WO-04-005), the `pending_decisions` status field (FRD-01).

## Dependencies
- **Intra:** WO-04-001 (same module `lib/docs.ts` — sequence after to avoid file conflicts).
- **Cross:** FRD-01 `lib/config.ts`.

## TDD (RED → GREEN → refactor)
`lib/docs.test.ts` additions, fixture `.pandacorp/` tree:
1. `readActivityLog` parses entries from a sample `progress.md` (AC-04-003.2).
2. Absent `progress.md` → `{ entries: [] }`, no throw (AC-04-003.2 empty state feeds the UI).
3. `readDecisions` parses pending vs resolved points, with optional recommendation (AC-04-003.3).
4. Absent `decisions.md` → `[]`, no throw.

## Definition of done
- [x] Tests written first and green for all cases.
  - Evidence: `npx vitest run lib/docs.wo04002.test.ts` → 74 passed, 0 failed (2026-06-16).
- [x] No `any`/`@ts-ignore`; read-only.
- [ ] `bash .pandacorp/verify.sh` passes.
  - **BLOCKED** (2026-06-16): verify.sh fails globally due to pre-existing biome format errors in
    `lib/next-step.wo04003.test.ts`, `lib/work-orders.test.ts`, `lib/work-orders.ts` (WO-04-003,
    WO-05-001 RED-phase stubs); and 2/5 FAIL in `lib/memory.adversarial.test.ts` (WO-17-001).
    WO-04-002 own files (`lib/docs.ts`, `lib/docs.wo04002.test.ts`) are biome-clean and tsc-clean.
    Unblocking condition: resolve WO-04-003 / WO-05-001 / WO-17-001 format/test failures.
