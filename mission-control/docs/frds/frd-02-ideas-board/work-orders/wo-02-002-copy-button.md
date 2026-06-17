---
id: WO-02-002
type: work-order
slug: copy-button
title: WO-02-002 — `CopyButton` shared affordance
status: DRAFT
parent: FRD-02
implementation_status: PLANNED
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
