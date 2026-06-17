---
id: WO-02-002
type: work-order
slug: copy-button
title: WO-02-002 — `CopyButton` shared affordance
status: DRAFT
parent: FRD-02
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-02-002 — `CopyButton` shared affordance

**Module:** `components/CopyButton.tsx`
**IDs touched:** `CMP-02-copy-button`; supports REQ-02-003, REQ-02-004 (and FRD-01/03 copy)
**Dependencies:** none

## EARS criteria (supporting)

- AC-02-003.x / AC-02-004.x — Commands are shown with a **copy button** (intake modal, card detail).
  This WO provides the reusable copy affordance.

## Contract

```tsx
"use client";
export function CopyButton(props: { value: string; label?: string }): JSX.Element;
```

- Copies `value` to the clipboard (`navigator.clipboard.writeText`), shows a transient "copiado"
  confirmation, reverts after a short timeout. Spanish copy via i18n.
- `data-testid="copy-button"`; accessible label (`aria-label`) in Spanish.
- Styling via design tokens only.
- Reused by FRD-01 (onboarding gate), FRD-03 (recovery/next-step commands).

## Definition of done

- [x] `components/CopyButton.test.tsx` (RED first, jsdom): clicking calls the clipboard with `value`
  and surfaces the confirmation; the testid + aria-label exist. Mock `navigator.clipboard`.
- [x] No write to disk; no Claude call.
- [x] `.pandacorp/verify.sh` green.

## Evidence

`bash .pandacorp/verify.sh` — 2026-06-16:
- biome: 20 files checked, 0 errors (2 infos — schema version mismatch, info only)
- tsc --noEmit: 0 errors
- vitest: 6 test files, 149 tests, all passed
- Full output: `✅ verify.sh: all gates green (biome + tsc + vitest).`

## Status Note

**Built:** `CopyButton` shared clipboard affordance (`CMP-02-copy-button`). A `"use client"` React
component that copies `value` to `navigator.clipboard.writeText`, shows a transient "copiado"
confirmation for 2 000 ms, then reverts. Guards: in-flight dedup (`pendingRef`), silent error path
(no false confirmation on `NotAllowedError` or missing/partial clipboard API), unmount safety
(`clearTimeout` in `useEffect` cleanup), `flushSync` wrapper so fake-timer tests flush synchronously.

**Interfaces/contracts exposed:**

```tsx
"use client";
export interface CopyButtonProps { value: string; label?: string }
export function CopyButton(props: CopyButtonProps): React.JSX.Element;
```

- `data-testid="copy-button"` on the `<button>`.
- `aria-label` in Spanish: `"Copiar al portapapeles"` (idle) / `"Copiado al portapapeles"` (after copy).
- Styling via CSS `currentColor` / `transparent` only — zero hardcoded colors.
- Full contract in `docs/api.md` § WO-02-002.

**Integration seams:**
- Already consumed by `components/OnboardingGate.tsx` (FRD-01), `components/CardDetail.tsx` (WO-02-007),
  `components/IntakeModal.tsx` (WO-02-006), `components/ProjectRail.tsx` (WO-03-001).
- Future consumers: FRD-04 Commands tab (`CMP-04-tab-commands`), FRD-11 mode selector.

**Test files:**
- `components/CopyButton.test.tsx` — 20 tests (rendering, clipboard happy-path, transient feedback,
  sequential copies, error path, edge cases, reuse contract).
- `components/CopyButton.adversarial.test.tsx` — 5 tests (aria-label flip, real in-flight guard,
  absent clipboard, guard reset after failure, no stale timer on error).
- `components/CopyButton.contract.test.tsx` — 20 tests (exact 2 000 ms boundary, aria-label
  round-trip, `pendingRef` reset on revert, partial clipboard, stale-closure guard, DOM order,
  unmount safety, re-click during window, instance isolation, absent clipboard + timer).
- `components/CopyButton.tokens.test.tsx` — 5 tests (no hardcoded hex/rgb/hsl, testid on `<button>`,
  verbatim copy of whitespace/unicode).

**Reviewer verdict:** APPROVED (Opus 4.8, DR-015) — see `docs/reviews/wo-02-002-review.md`. 50/50
tests green; mutation test killed. One cross-cutting non-blocking finding: Spanish strings hardcoded
(no i18n layer exists project-wide — deferred to a dedicated i18n WO).
