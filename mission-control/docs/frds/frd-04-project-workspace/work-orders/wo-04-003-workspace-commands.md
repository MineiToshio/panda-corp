# WO-04-003 — `lib/next-step.ts`: `workspaceCommands(phase)`

**Feature:** FRD-04 · **Implements:** IF-04-next-step (`workspaceCommands`) · **REQ-04-005**
**Deploy unit:** additions to `lib/next-step.ts` (+ `lib/next-step.test.ts`). Pure function, no fs, no UI.

## Acceptance criteria (copied)
- **AC-04-005.1** The Commands tab SHALL render the stage-relevant command rows from `lib/next-step.ts`, each with a copy button and a "when to use" description.

## Scope
- Add a **pure** `workspaceCommands(phase: Phase): CommandRow[]` that maps a project phase to the
  stage-relevant command rows shown in the Commands tab, mirroring the approved prototype
  (`commandsBox`):
  - `implementation`/building → `/pandacorp:implement` ("continue/resume the build"),
    `/pandacorp:release` ("when all work orders are done"), `/pandacorp:iterate` ("add an FRD, tweak or fix").
  - `operation`/shipped → `/pandacorp:iterate`, `/pandacorp:new-version` (optional milestone).
  - earlier phases → the single "next step" command (delegates to the existing FRD-02 base map).
- `CommandRow = { command: string; when: string }`.
- **Out of scope:** the copy button (component, shared `CopyButton`), the build mode selector
  (FRD-11), rendering (WO-04-007).

## Dependencies
- **Intra:** none.
- **Cross:** FRD-02 base `lib/next-step.ts` + `Phase` type (FRD-01 `lib/status.ts`).

## TDD (RED → GREEN → refactor)
`lib/next-step.test.ts`:
1. `workspaceCommands("implementation")` returns the three building commands in order (AC-04-005.1).
2. `workspaceCommands("operation")` returns iterate + new-version.
3. An early phase returns the FRD-02 next-step command (delegation, no duplication).
4. Pure: same input → same output, no fs/IO.

## Definition of done
- [ ] Tests written first and green.
- [ ] No `any`/`@ts-ignore`; function is pure (no fs).
- [ ] `bash .pandacorp/verify.sh` passes.
