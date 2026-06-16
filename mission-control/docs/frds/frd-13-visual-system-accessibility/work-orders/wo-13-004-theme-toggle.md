# WO-13-004 — ThemeToggle (light/dark/high-contrast, persisted)

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
