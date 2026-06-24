---
id: WO-01-008
type: work-order
slug: onboarding-gate
title: WO-01-008 — Onboarding gate (UI)
status: ACTIVE
parent: FRD-01
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-01-002]
last_updated: '2026-06-16'
---
# WO-01-008 — Onboarding gate (UI)

**Module:** `components/OnboardingGate.tsx` + guard in `app/layout.tsx`
**IDs touched:** `CMP-01-onboarding-gate`; REQ-01-001
**Dependencies:** WO-01-002 (`readProfile`)

## EARS criteria (from FRD-01)

- AC-01-001.1 — WHEN Pandacorp loads and does NOT find `factory/profile.md`, the system SHALL show —
  BEFORE any other view — an onboarding gate that explains the factory still needs configuring and
  presents the `/pandacorp:onboarding` command with a copy button; the rest of the app stays in the
  background until the profile exists.

## Design

- In `app/layout.tsx` (Server Component), call `readProfile()`. IF `{ present: false }`, render
  `<OnboardingGate />` **instead of** `children` (the gate is the whole view; the app does not
  render behind it).
- `OnboardingGate.tsx`: Spanish copy (DR-009) explaining the factory isn't personalized yet + a
  copyable `/pandacorp:onboarding` command. Use the shared `components/CopyButton.tsx` if available
  (FRD-02 WO-02-002 / FRD-03); otherwise a minimal inline copy button with `data-testid`.
- UI strings via i18n (Spanish default), never hardcoded ad hoc (architecture §7).
- Styling via design tokens only (no hardcoded colors); minimal until the design phase lands tokens.

## Definition of done

- `components/OnboardingGate.test.tsx` (RED first, `@testing-library/react` + jsdom):
  - Renders the explanatory copy and the `/pandacorp:onboarding` command text.
  - The copy control is present and has `data-testid`.
- A guard test (or layout integration test) confirming: profile absent → gate rendered, children
  not rendered; profile present → children rendered, gate absent. (May be unit-level on a small
  guard helper to keep it isolatable.)
- No write; no Claude call.
- `.pandacorp/verify.sh` green.

## Status

- [x] **DONE** — 2026-06-16 (fixes applied 2026-06-16, commit 94e7867)

**Evidence:**
- `bash .pandacorp/verify.sh` → `✅ all gates green (biome + tsc + vitest)` — 891 tests passed (32 test files), 0 type errors, 0 lint errors.
- `components/OnboardingGate.test.tsx` — 15 tests, all GREEN (TDD RED→GREEN).
- `components/OnboardingGate.gaps.test.tsx` — supplemental gap coverage (GAP-1 through GAP-6), biome lint fixed (B-1: `\-` → `-`).
- `app/layout.guard.test.tsx` — 8 mutation-killing tests invoking the real `RootLayout` against a temp `PANDACORP_FACTORY_ROOT` (B-2: kills inverted-guard, always-gate, always-children mutants; asserts read-only invariant).
- Implementation: `components/OnboardingGate.tsx` (Server Component, zero hardcoded colors, CSS custom properties, Spanish copy, data-testid on all significant elements, CopyButton reused).
- `app/layout.tsx` updated: calls `readProfile()` at load time; if `{ present: false }` → `<OnboardingGate />`; else → children.
- Commits: 461d04c (impl), 1320fd0 (tests + api.md), 94e7867 (reviewer fixes B-1 + B-2).
