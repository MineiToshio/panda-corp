---
id: WO-13-004
type: work-order
slug: theme-toggle
title: 'WO-13-004 — ThemeToggle (light/dark/high-contrast, persisted)'
status: ACTIVE
parent: FRD-13
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-13-002]
last_updated: '2026-06-16'
---
# WO-13-004 — ThemeToggle (light/dark/high-contrast, persisted)

**Status:** DONE ✓
**Components/Interfaces:** `CMP-13-theme-toggle` · **Traces:** REQ-13-001
**Deploy unit:** global header · **Location:** `components/ThemeToggle.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-13-001.1: The theme SHALL be derived from few OKLCH tokens ... a **high-contrast mode** can be enabled without a redesign.

## Scope
- `"use client"` toggle cycling light / dark / high-contrast (sets the theme data-attr/class consumed by `globals.css`).
- Default from `prefers-color-scheme`; user choice persists in `localStorage` (architecture §4.8) and survives refresh.
- Spanish `aria-label`; keyboard-operable; `data-testid`.

## Dependencies
- WO-13-002 (theme vars / theme attribute contract).

## TDD / Definition of done
- Component tests: toggling cycles the three modes and sets the right attribute/class; default follows mocked `prefers-color-scheme`; choice persists across remount (localStorage mocked); operable by keyboard with a Spanish `aria-label`.
- Gate green.

## Evidence (safe-point 2026-06-16)

- `pnpm vitest run components/ThemeToggle.test.tsx components/ThemeToggle.adversarial.test.tsx` → **60 passed** (41 implementer + 19 adversarial)
- `pnpm biome check components/ThemeToggle.tsx components/ThemeToggle.test.tsx components/ThemeToggle.adversarial.test.tsx` → **no errors**
- `pnpm tsc --noEmit` → **exit 0**
- Reviewer adversarial suite (`ThemeToggle.adversarial.test.tsx`) added and passing (DR-015)
- Review doc: `docs/reviews/wo-13-004-review.md` — **APPROVED**
