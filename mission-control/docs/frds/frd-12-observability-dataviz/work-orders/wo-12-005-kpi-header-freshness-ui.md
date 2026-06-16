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
