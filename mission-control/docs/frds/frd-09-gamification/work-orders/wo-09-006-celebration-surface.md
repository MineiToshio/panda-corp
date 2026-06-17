---
id: WO-09-006
type: work-order
slug: celebration-surface
title: WO-09-006 — `CMP-09-celebration` scaling surface
status: DRAFT
parent: FRD-09
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-09-006 — `CMP-09-celebration` scaling surface

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-09-celebration`](../blueprint.md#3-components--interfaces).

## Goal
Build the client-side celebration surface (`"use client"`) that renders the scaling celebration —
toast → animation → celebration → level-up moment — driven by `classifyCelebration()` over new
events. Restrained, honoring `prefers-reduced-motion` and the FRD-13 motion budget.

## Acceptance criteria (EARS, from FRD-09 + FRD-13)
- **AC-09-006.1** — The celebration SHALL **scale** with the outcome tier: small toast (work order) → medium animation (phase) → celebration (release) → level-up moment; it SHALL NOT show a flat celebration on every action.
- **AC-09-006.2** — A non-result event SHALL produce **no** celebration (negative AC; from `classifyCelebration → "none"`).
- **AC-09-006.3** — Animation SHALL use only `transform`/`opacity`, duration <300ms (the expressive reserved for rare events), and SHALL be **disabled** under `prefers-reduced-motion` (FRD-13) — the data still updates without motion.
- **AC-09-006.4** — There SHALL be NO false-urgency timer, countdown, or nagging in the celebration (negative AC, FRD-09 forbidden patterns).
- **AC-09-006.5** — Announcements SHALL use `aria-live="polite"` (Spanish) without stealing focus (FRD-13).

## Dependencies
- WO-09-005 (`classifyCelebration`). Intra-feature.
- FRD-13 motion tokens + `prefers-reduced-motion`. Cross-feature.

## TDD plan
1. RED: tests for tier-scaled rendering; "activity → no celebration"; "reduced-motion → no animation, data still present"; "no timer/countdown"; `aria-live` polite.
2. GREEN: implement the surface.
3. Refactor.

## Definition of done
- Component tests green incl. negative ACs + reduced-motion; tsc + biome clean; tokens only. `.pandacorp/verify.sh` passes.

## Status Note

**What it built:** `CMP-09-celebration` — the client-side celebration surface component that renders tier-scaled celebrations driven by `classifyCelebration()`. Implemented in `components/rpg/CelebrationSurface.tsx` (`"use client"`). CSS layout/chrome added to `app/globals.css` (`.celebration-surface`, `.celebration-inner` classes using only design tokens).

**Interfaces/contracts exposed:**

```ts
// components/rpg/CelebrationSurface.tsx
export interface CelebrationSurfaceProps {
  event: Event | null;  // null → no celebration rendered
}
export function CelebrationSurface({ event }: CelebrationSurfaceProps): React.JSX.Element | null
```

**Integration seams:**
- Consumes `classifyCelebration(event)` from `@/lib/gamification` (WO-09-005, `IF-09-celebration`).
- Consumes `LiveRegion` from `@/components/a11y/LiveRegion` (WO-13-003) for `aria-live="polite"`.
- Consumes `Event` type from `@/lib/events`.
- CSS classes `.celebration-surface` / `.celebration-inner` defined in `app/globals.css` — zero hardcoded colors, all FRD-13 design tokens.
- To mount: pass the latest `Event | null` from the dashboard event stream; typically placed in the top-level layout or any page that consumes `readEvents()`.

**data-testid contract:**
- `celebration-surface` — outer wrapper; carries `data-tier` (`toast|phase|release|levelup`) and `data-animated` (`true|false`).
- `celebration-message` — the Spanish tier message text node.
- `live-region` — the `aria-live="polite"` region (via `LiveRegion`).

**Test files:** `components/rpg/CelebrationSurface.test.tsx` — 32 tests covering AC-09-006.1..5 including all negative ACs (no celebration for activity events / failure; no timer/countdown; no focus steal; no hardcoded colors). tsc clean, biome clean.
</content>
