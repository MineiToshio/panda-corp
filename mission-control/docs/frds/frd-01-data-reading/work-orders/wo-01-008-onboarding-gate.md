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
