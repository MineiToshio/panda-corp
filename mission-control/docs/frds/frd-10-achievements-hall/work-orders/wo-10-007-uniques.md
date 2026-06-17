---
id: WO-10-007
type: work-order
slug: uniques
title: WO-10-007 — Unique achievements by category
status: DRAFT
parent: FRD-10
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-10-007 — Unique achievements by category

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-10-uniques`](../blueprint.md#4-components--interfaces).

## Goal
Render the unique (one-time) achievements grouped by category (Discovery, Speed, Quality,
Consistency, Mastery), with date+project when unlocked and the condition when locked.

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-007.1** — The section SHALL group unique achievements by category, from `computeUniques()`.
- **AC-10-007.2** — An unlocked achievement SHALL show its **date** and **project**; a locked one SHALL show its **condition** (achievable, not obscure).
- **AC-10-007.3** — The visual difference between locked/unlocked SHALL not rely on color alone (icon/shape/label present, FRD-13).
- **AC-10-007.4** — Styling SHALL use FRD-13 tokens only; numbers `tabular-nums`.

## Dependencies
- WO-10-001 (`computeUniques`), WO-10-005 (page shell). Intra-feature.
- FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests for category grouping, unlocked (date+project) vs locked (condition), not-color-alone, tokens.
2. GREEN: implement.
3. Refactor.

## Definition of done
- Component tests green; tsc + biome clean; tokens only. `.pandacorp/verify.sh` passes.

## Status Note

**Built:** `CMP-10-uniques` — `UniquesSection` component rendering all unique achievements grouped by
category (Discovery, Speed, Quality, Consistency, Mastery), wired into `app/achievements/page.tsx`.

**Files delivered:**
- `app/achievements/UniquesSection.tsx` — `UniquesSection` + `UniqueItem` + `CategoryGroup` sub-components.
- `app/achievements/UniquesSection.test.tsx` — 27 tests RED→GREEN covering AC-10-007.1..4.
- `app/achievements/page.tsx` — imports `computeUniques` + `UniquesSection`; renders the "Trofeos únicos" section below the stats panel.

**Interface/contract exposed:**
```tsx
// UniquesSection
export type UniquesSectionProps = { uniques: readonly Unique[] }
export function UniquesSection({ uniques }: UniquesSectionProps): React.JSX.Element

// data-testid contract:
// data-testid="uniques-section"                        — root container
// data-testid="uniques-category-{Category}"            — section per category
// data-testid="uniques-category-heading-{Category}"    — h3 heading per category
// data-testid="unique-item"                            — li per achievement
//   data-unlocked="true"|"false"                       — state attribute
// data-testid="unique-name"                            — achievement name
// data-testid="unique-condition"                       — condition (always visible)
// data-testid="unique-unlock-indicator"                — ✓ icon (unlocked only)
// data-testid="unique-lock-indicator"                  — 🔒 icon (locked only)
// data-testid="unique-date"                            — date (unlocked only, tabular-nums)
// data-testid="unique-project"                         — project slug (unlocked only)
```

**AC coverage:**
- AC-10-007.1: categories in canonical order (Discovery→Speed→Quality→Consistency→Mastery); items placed in correct group; empty group suppressed; empty input renders gracefully.
- AC-10-007.2: unlocked shows `unique-date` + `unique-project`; locked shows `unique-condition` only (no date/project); condition always visible for both.
- AC-10-007.3: `data-unlocked` attribute distinguishes states; lock icon `🔒` (aria-label="Bloqueado") vs check icon `✓` (aria-label="Desbloqueado") — not color alone; icons carry distinct accessible labels.
- AC-10-007.4: zero hardcoded hex/rgb/hsl in style attributes — all `var(--*)` tokens; `unique-date` carries `tabular-nums` class.

**Test files:** `app/achievements/UniquesSection.test.tsx` (27 tests), `app/achievements/page.test.tsx` (27 tests, pre-existing — unmodified, all still green).

**Gate:** 177 test files, 4904 tests green + 2 expected-fail + 5 skipped. biome clean. tsc clean. verify.sh PASS.
</content>
