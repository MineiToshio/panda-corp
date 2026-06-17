---
id: WO-04-007
type: work-order
slug: tab-commands
title: 'WO-04-007 — Commands tab: stage commands + FRD-11 selector slot'
status: DRAFT
parent: FRD-04
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
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
- [x] Component tests written first and green.
- [x] Reuses the shared `CopyButton` (no new clipboard logic); Server Component (selector is its own client component).
- [x] Spanish copy via i18n; tokens only; `data-testid` on command rows.
- [x] `bash .pandacorp/verify.sh` passes.

## Status Note

**What was built:** `CMP-04-tab-commands` — the Commands tab Server Component for the FRD-04 project workspace.

**Files delivered:**
- `app/projects/[slug]/_components/tab-commands.tsx` — Server Component; zero `"use client"`; CSS custom properties only (zero hardcoded colors).
- `app/projects/[slug]/_components/tab-commands.test.tsx` — 30 tests, TDD RED→GREEN.

**Interfaces/contracts exposed:**
```tsx
// tab-commands.tsx
export interface TabCommandsProps {
  phase: Phase;   // from lib/status.ts — drives workspaceCommands(phase)
  slug: string;   // passed through to CMP-11-mode-selector seam
}
export function TabCommands(props: TabCommandsProps): React.JSX.Element
```

**Integration seams:**
- Consumes `workspaceCommands(phase)` from `lib/next-step.ts` (WO-04-003) — pure, no I/O.
- Reuses `CopyButton` from `components/CopyButton.tsx` (WO-02-002) — no new clipboard logic.
- `data-testid="mode-selector-slot"` is the FRD-11 seam: replace `ModeSelectorSlot` body with `<ModeSelector slug={slug} />` when WO-11-002 ships; no other change to this file required.

**data-testid map:**
- `tab-commands` — root `<main>`
- `mode-selector-slot` — FRD-11 placeholder `<section>` (AC-04-005.2)
- `commands-list` — `<ul>` containing all rows (AC-04-005.1)
- `command-row` — each `<li>` (one per CommandRow)
- `command-row-command` — `<code>` with the command string
- `command-row-description` — `<p>` with the "when to use" text
- `tab-commands-heading` — section `<h2>` ("Comandos")
- `copy-button` — inside each row, from shared CopyButton

**Test coverage (30 tests):**
- `tab-commands.test.tsx` — AC-04-005.1 (rows/copy/description), AC-04-005.2 (slot at top, DOM order, visible label), building phases (impl/release → 3 rows), operation phase (2 rows), early phases (1 row each), design tokens (no hex/rgb), a11y (list role, Spanish heading).

**verify.sh:** biome clean, tsc clean, 3440 tests pass (2 expected-fail, 5 skipped).
