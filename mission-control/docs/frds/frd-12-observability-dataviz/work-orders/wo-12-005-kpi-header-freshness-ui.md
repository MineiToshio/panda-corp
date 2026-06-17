---
id: WO-12-005
type: work-order
slug: kpi-header-freshness-ui
title: WO-12-005 — KPI header + freshness badge (UI)
status: DRAFT
parent: FRD-12
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-12-005 — KPI header + freshness badge (UI)

**Components/Interfaces:** `CMP-12-kpi-header`, `CMP-12-freshness` · **Traces:** REQ-12-001, REQ-12-002, REQ-12-004
**Deploy unit:** global header / dashboard · **Location:** `app/_observability/KpiHeader.tsx`, `FreshnessBadge.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-12-001.1: The header SHALL show ≤5 critical KPIs ...; the detail goes in collapsible sections.
- AC-12-002.1: Live / No signal indicator with the timestamp of the last event.
- AC-12-004.1: ANY grouping or ranking SHALL be limited to top-5.

## Scope
- `KpiHeader` (RSC): renders ≤5 KPIs from `IF-12-kpis` with `tabular-nums`; detail in a collapsible section; a single rationed accent (FRD-13) only on the most important KPI.
- `FreshnessBadge`: Live / "Sin señal" from `IF-12-freshness`, with the last-event timestamp (`tabular-nums`); state shown by **icon + label**, never color alone (FRD-13). Exported for FRD-06 to embed.

## Dependencies
- WO-12-001 (freshness), WO-12-002 (KPIs), FRD-13 tokens (accent, tabular-nums, icon+label, a11y).

## TDD / Definition of done
- Component tests: renders exactly the KPIs returned (≤5); collapsible detail toggles; the badge shows "En vivo"/"Sin señal" with its icon and a timestamp; stale state is distinguishable without relying on color (icon/label present).
- Gate green.

## Status Note

**Built:** `FreshnessBadge` (CMP-12-freshness) — the primary new deliverable of this WO. `KpiHeader` (CMP-12-kpi-header) was already implemented in WO-12-002 and verified green; this WO audited it against the AC criteria and confirmed no changes were needed.

**Interfaces / contracts exposed:**

```tsx
// app/_observability/FreshnessBadge.tsx
export interface FreshnessBadgeProps {
  live: boolean;        // true = "En vivo", false = "Sin señal"
  lastAt: string | null; // ISO 8601 timestamp of last event, or null
}
export function FreshnessBadge(props: FreshnessBadgeProps): React.JSX.Element
```

Props are the direct output of `freshness(events, now)` from IF-12-freshness (WO-12-001). The caller resolves the freshness selector and passes the result.

**Integration seams:**
- FRD-06 Party panel: import `FreshnessBadge` from `"@/app/_observability/FreshnessBadge"` and pass `freshness(events, new Date())` result as props. Marked `"use client"` so it embeds in both RSC and client trees.
- Global dashboard header: same import pattern; call `freshness()` server-side and pass result.

**Design constraints met (FRD-13):**
- State communicated by icon (`●`/`○`) + label (`En vivo`/`Sin señal`) — never color alone.
- `role="status"` on the badge span so `aria-label` is a11y-valid.
- `fontVariantNumeric: "tabular-nums"` on the timestamp element.
- Zero hardcoded colors — all via CSS custom properties (`var(--color-*)`).

**Test files:**
- `app/_observability/FreshnessBadge.test.tsx` — 27 tests covering: container (3), live state (5), no-signal state (5), icon+label always-present invariant (3), timestamp display (5), state transition (2), design token compliance (2), edge cases (2).
- `app/_observability/KpiHeader.test.tsx` — 23 pre-existing tests (WO-12-002, unchanged).

**Verify:** `pnpm vitest run app/_observability/FreshnessBadge.test.tsx app/_observability/KpiHeader.test.tsx` → 50/50 pass. `pnpm tsc --noEmit` clean. `pnpm biome check` clean on scope files. Full suite: 3218 pass + 2 expected-fail + 5 skipped (111 test files).
