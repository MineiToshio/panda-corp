---
id: WO-11-002
type: work-order
slug: mode-selector
title: 'WO-11-002 — `CMP-11-mode-selector`: selector + command + memory'
status: DRAFT
parent: FRD-11
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-11-002 — `CMP-11-mode-selector`: selector + command + memory

**Feature:** FRD-11 · **Implements:** CMP-11-mode-selector · **REQ-11-001, REQ-11-002, REQ-11-003**
**Deploy unit:** `app/projects/[slug]/_components/mode-selector.tsx` (`"use client"`) + colocated tests.

## Acceptance criteria (copied)
- **AC-11-001.1** The selector SHALL render four mode options in order: Pro/economical, Balanced, Powerful, Deep.
- **AC-11-001.2** EACH option SHALL show its description (agents, models, recommended plan).
- **AC-11-001.3** The default selected mode SHALL be Balanced when no mode has been chosen.
- **AC-11-002.1** WHEN a mode is selected, the exact copy command SHALL be shown with a copy button.
- **AC-11-002.2** The selected mode's description SHALL be shown alongside the command.
- **AC-11-003.2** Re-opening the project's Commands tab SHALL restore its remembered mode.

## Scope
- `CMP-11-mode-selector` (Client): segmented `role=radiogroup` of the four `BUILD_MODES` (WO-11-001);
  on select, persist via `rememberMode(slug, mode)` and show the active mode's description + copy
  command (shared `CopyButton`). Initialize from `getRememberedMode(slug)` (default Balanced).
- Mirrors the approved prototype `buildModePanel`.
- **Out of scope:** the catalog/persistence (WO-11-001); the Commands tab shell (FRD-04 WO-04-007).

## Dependencies
- **Intra:** WO-11-001 (`BUILD_MODES`, `getRememberedMode`, `rememberMode`).
- **Cross:** FRD-04 `CMP-04-tab-commands` (mounts this); shared `CopyButton`.

## TDD (RED → GREEN → refactor)
Component tests (jsdom + `localStorage`):
1. Renders four modes in order, each with its description (AC-11-001.1/.2).
2. Defaults to Balanced and shows `/pandacorp:implement` (AC-11-001.3, AC-11-002.1).
3. Selecting Powerful shows `/pandacorp:implement powerful` + its description (AC-11-002.1/.2).
4. After selecting a mode and re-mounting with the same slug, the remembered mode is restored
   (AC-11-003.2).
5. Active mode indicated by more than color (checkmark/`aria-checked`) — a11y.

## Definition of done
- [ ] Component tests written first and green.
- [ ] `"use client"`; `role=radiogroup` + keyboard support; reuses shared `CopyButton`.
- [ ] Tokens only; `data-testid` on each mode + the command row; Spanish copy via i18n.
- [ ] `bash .pandacorp/verify.sh` passes.

## Status Note

**What it built:** `CMP-11-mode-selector` — the per-project build mode selector for the Commands tab. Implements all AC-11-001.x / AC-11-002.x / AC-11-003.x criteria end-to-end: four-mode radiogroup (Pro/Balanced/Powerful/Deep), per-project localStorage memory, exact copy command, active description alongside command.

**Interfaces / contracts exposed:**

```tsx
// app/projects/[slug]/_components/mode-selector.tsx
export interface ModeSelectorProps { slug: string; }
export function ModeSelector({ slug }: ModeSelectorProps): React.JSX.Element
```

**Integration seam:** `TabCommands` (`tab-commands.tsx`) now mounts `<ModeSelector slug={slug} />` replacing the `ModeSelectorSlot` placeholder. The root element carries `data-testid="mode-selector-slot"` — the seam AC-04-005.2 tests check.

**A11y choices documented:**
- `<input type="radio">` (visually hidden) inside `<label>` for native semantics — biome `useSemanticElements` compliant.
- `<div role="radiogroup">` wraps the fieldset (biome forbids `role="radiogroup"` on `<fieldset>` via `noNoninteractiveElementToInteractiveRole`).
- `aria-checked` mirrored explicitly on the `<input>` for test-library `getAttribute` queries.
- `data-testid="mode-option-{id}"` on the `<label>` (container) so `within(option)` finds child elements; `getInputForOption()` helper in tests reaches the nested input for `aria-checked` checks.

**data-testid coverage:**
- `mode-selector-slot` — root section (integration seam)
- `mode-option-{id}` — each mode label container (pro/balanced/powerful/deep)
- `mode-description-{id}` — description span inside each option
- `mode-check-{id}` — checkmark span (visible when active, visibility:hidden when inactive)
- `mode-command-row` — command display section
- `mode-command-text` — the command `<code>` element
- `mode-command-copy` — wrapper around `CopyButton`
- `mode-active-description` — active mode description in command row

**Test files:** `app/projects/[slug]/_components/mode-selector.test.tsx` — 34 tests covering all 5 TDD cases + design token invariants + integration seam.

**Gate:** 124 test files / 3526 tests GREEN, tsc clean, biome clean.
