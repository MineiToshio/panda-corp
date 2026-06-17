---
id: WO-12-002
type: work-order
slug: kpi-selector
title: 'WO-12-002 — KPI selector (≤5, incl. failed work orders)'
status: ACTIVE
parent: FRD-12
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-12-002 — KPI selector (≤5, incl. failed work orders)

**Components/Interfaces:** `IF-12-kpis` · **Traces:** REQ-12-001, REQ-12-007
**Deploy unit:** observability selectors (pure) · **Location:** `app/_observability/selectors/kpis.ts` (+ `.test.ts`)

## Acceptance criteria (verbatim EARS)
- AC-12-001.1: The header SHALL show **≤5 critical KPIs** (e.g. active projects, agents working, XP of the day, builds queued, **failed work orders**), top-left; the detail goes in collapsible sections.
- AC-12-007.1: The honest metrics (tasks done vs failed, time per work order, events per minute) SHALL be derived from the same event file, with no extra instrumentation.

## Scope
- `deriveKpis(events, projects): Kpi[]` returning **≤5** KPIs: active projects, agents working, XP of the day, builds queued, failed work orders — derived from the event tail + `status.yaml`/portfolio inputs (no extra instrumentation).
- Each `Kpi`: `{ key, label (Spanish), value, detail? }`. Failed-work-orders is a first-class KPI (FRD-06/13 failure visibility).

## Dependencies
- FRD-01 `lib/events`, `lib/status`, `lib/portfolio` types (cross-feature).

## TDD / Definition of done
- Tests with fixtures: returns at most 5 KPIs; failed-work-orders counts `fail` events/closed-failed WOs; agents-working counts distinct agents with a recent `work`/`start`; empty inputs → zeroed KPIs (never throws).
- Pure. Gate green.

## Status

- [x] **Done** — `bash .pandacorp/verify.sh` passed: biome (exit 0, 9 warnings / 0 errors) + tsc --noEmit (clean) + vitest (1449 passed, 2 expected fail, 5 skipped).
- Implementation: `app/_observability/selectors/kpis.ts`
- Tests: `app/_observability/selectors/kpis.test.ts`, `app/_observability/selectors/kpis.adversarial.test.ts`
- UI component: `app/_observability/KpiHeader.tsx` + `KpiHeader.test.tsx`
- Commits: `88a55b2` (selector), `4d1a75f` (KpiHeader UI)
- Safe-point SHA (post-commit): see `last_green_sha` in `.pandacorp/status.yaml`
