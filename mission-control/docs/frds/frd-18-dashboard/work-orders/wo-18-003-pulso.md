---
id: WO-18-003
type: work-order
slug: pulso
title: WO-18-003 — `IF-18-pulse` funnel + conversion + `Pulso` component
status: DRAFT
parent: FRD-18
implementation_status: VERIFIED
source_requirements: [REQ-18-013, REQ-18-014]
last_updated: '2026-06-18'
---
# WO-18-003 — `IF-18-pulse` funnel + conversion + `Pulso` component

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-18-pulse`, `CMP-18-pulse`) · [architecture §11](../../../product/architecture.md).
> Visual reference: `prototype/index.html` pulse stats (667–674).

## Goal
"Pulso de la fábrica": the funnel (ideas alive → in construction → shipped), the owner-waiting count,
and the idea→shipped conversion — the one metric. ≤5 signals.

## Scope
- `IF-18-pulse(...)` — pure: counts for ideas alive, in construction (split live vs stale), shipped,
  owner-waiting; the idea→shipped conversion percentage.
- `components/dashboard/pulso.tsx` — render the ≤5 signals + the conversion line.

## Acceptance criteria
- **AC-18-003.1** (REQ-18-013) The pulse shows the funnel, the owner-waiting count, and the idea→shipped
  conversion; total signals ≤ 5.
- **AC-18-003.2** (REQ-18-014) "In construction" distinguishes live builds from stale ones via the FRD-12
  live/no-signal indicator.
- **AC-18-003.3** Conversion = shipped / total ideas alive (rounded), with `tabular-nums` (FRD-13).
- **AC-18-003.4** Fresh factory (no ideas) → conversion 0% / calm state, no divide-by-zero, no fake metric.
- **AC-18-003.5** Spanish + a11y.

## TDD
`IF-18-pulse` pure tests with fixture idea/portfolio/event sets (incl. empty + a live build + a stale
build). `pulso.test.tsx` for render + ≤5 signals.

## Definition of done
- ACs RED → GREEN; ≤5 signals; live/stale split; safe on empty. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-01 `lib/ideas`, `lib/portfolio`; FRD-02 `lib/board`; FRD-06/12 `lib/events`.

## Status Note

**What was built:**
- `IF-18-pulse` pure derivation helper (`src/app/_lib/pulse.ts`) — computes all ≤5 pulse signals from pre-counted `PulseInput`; no I/O, no side-effects, never throws.
- `CMP-18-pulse` component (`src/components/modules/Pulso/Pulso.tsx`) — Server Component (no `"use client"`) that renders the "Pulso de la fábrica" section from a `PulseResult` prop.

**Interfaces / contracts exposed:**

```ts
// src/app/_lib/pulse.ts
export type PulseInput = {
  ideasAlive: number;
  ideasShipped: number;
  inConstructionLive: number;   // FRD-12 "En vivo" builds
  inConstructionStale: number;  // FRD-12 "Sin señal" builds
  ownerWaiting: number;
};

export type PulseResult = {
  ideasAlive: number;
  ideasShipped: number;
  inConstructionLive: number;
  inConstructionStale: number;
  ownerWaiting: number;
  conversionPct: number;  // round(shipped/alive*100), 0 when alive=0
  calm: boolean;          // true = al-día state (nothing needs attention)
  hasStale: boolean;      // true = any stale builds exist
};

export function pulse(input: PulseInput): PulseResult;  // pure, never throws

// src/components/modules/Pulso/Pulso.tsx
export interface PulsoProps { pulse: PulseResult; }
export function Pulso({ pulse }: PulsoProps): React.JSX.Element;
```

**Integration seam:** The page assembly WO (WO-18-006) must:
1. Read `lib/ideas`, `lib/portfolio`, `lib/events` and count the signals into a `PulseInput`.
2. Call `pulse(input)` to derive `PulseResult`.
3. Pass the result as `<Pulso pulse={result} />` in the dashboard page.

The `inConstructionLive` / `inConstructionStale` split must use `freshness()` from `src/app/_observability/selectors/freshness/freshness.ts` (FRD-12 `IF-12-freshness`) against each building-phase project's `byProject` last event timestamp.

**data-testid surface:**
- `pulso-section` — root `<section>` (landmark region "Pulso de la fábrica")
- `pulso-signal-pulso-ideas-alive` — ideas-alive signal wrapper
- `pulso-ideas-alive` — ideas-alive value
- `pulso-ideas-alive-label` — Spanish label
- `pulso-signal-pulso-in-construction-live` — in-construction wrapper
- `pulso-in-construction-live` — live-builds value
- `pulso-in-construction-label` — Spanish label
- `pulso-signal-pulso-ideas-shipped` — shipped signal wrapper
- `pulso-ideas-shipped` — shipped value
- `pulso-signal-pulso-owner-waiting` — owner-waiting wrapper
- `pulso-owner-waiting` — owner-waiting value
- `pulso-conversion-label` — conversion label
- `pulso-conversion` — conversion value (`{pct}%`)
- `pulso-calm-badge` — al-día badge (only when `calm=true`)
- `pulso-stale-badge` — stale builds badge (only when `hasStale=true`)

**Test files:**
- `src/app/_lib/_tests/pulse.test.ts` — 30 pure-function tests (AC-18-003.1..4, purity, edge cases)
- `src/components/modules/Pulso/_tests/pulso.test.tsx` — 26 render tests (AC-18-003.1..5, a11y, calm/stale states)
- Total: 56 tests, all GREEN.

**Verify evidence:** `pnpm vitest run src/app/_lib/_tests/pulse.test.ts src/components/modules/Pulso/_tests/pulso.test.tsx` → 56/56 pass. Full suite: 230 files / 5857 tests pass. `tsc --noEmit` clean. `pnpm biome check src/app/_lib/ src/components/modules/Pulso/` → no errors.
