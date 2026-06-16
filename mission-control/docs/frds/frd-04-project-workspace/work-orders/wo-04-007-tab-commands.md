# WO-04-007 — Commands tab: stage commands + FRD-11 selector slot

**Feature:** FRD-04 · **Implements:** CMP-04-tab-commands · **REQ-04-005**
**Deploy unit:** `app/projects/[slug]/_components/tab-commands.tsx` + colocated tests.

## Acceptance criteria (copied)
- **AC-04-005.1** The Commands tab SHALL render the stage-relevant command rows from `lib/next-step.ts`, each with a copy button and a "when to use" description.
- **AC-04-005.2** The Commands tab SHALL mount the FRD-11 build mode selector (`CMP-11-mode-selector`).

## Scope
- `CMP-04-tab-commands` (Server): render the rows from `workspaceCommands(phase)` (WO-04-003), each
  using the shared `CopyButton` and showing its "when to use" text (mirrors prototype `projComandos`
  = `buildModePanel` + `commandsBox`).
- Mount `CMP-11-mode-selector` at the top of the tab (the build mode selector). Until FRD-11 lands,
  render a labelled placeholder slot so the tab is shippable in isolation.
- **Out of scope:** the mode selector internals + per-project memory (FRD-11); the command map
  (WO-04-003).

## Dependencies
- **Intra:** WO-04-003 (`workspaceCommands`), WO-04-004 (shell mounts this tab).
- **Cross:** FRD-11 `CMP-11-mode-selector` (slotted; placeholder until available).

## TDD (RED → GREEN → refactor)
Component tests:
1. Renders the command rows for the project's phase, each with a copy button + description (AC-04-005.1).
2. Renders the FRD-11 selector slot (placeholder or real component) at the top (AC-04-005.2).
3. Building phase shows implement/release/iterate; operation phase shows iterate/new-version.

## Definition of done
- [ ] Component tests written first and green.
- [ ] Reuses the shared `CopyButton` (no new clipboard logic); Server Component (selector is its own client component).
- [ ] Spanish copy via i18n; tokens only; `data-testid` on command rows.
- [ ] `bash .pandacorp/verify.sh` passes.
