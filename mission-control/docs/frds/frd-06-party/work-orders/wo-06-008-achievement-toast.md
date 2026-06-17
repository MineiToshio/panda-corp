---
id: WO-06-008
type: work-order
slug: achievement-toast
title: WO-06-008 — Achievement toast (work-order-close celebration)
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-008 — Achievement toast (work-order-close celebration)

**Components/Interfaces:** `CMP-06-achievement` · **Traces:** REQ-06-007
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/AchievementToast.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-06-007.1: WHEN a work order closes, an **achievement** SHALL fire ("Achievement unlocked!").

## Scope
- On an `achievement` / work-order-close event (from `IF-06-state-map`), show a celebratory toast ("¡Logro desbloqueado!") with the work-order id.
- Honest scaling (design brief §3): a small toast for a work order (not a flat celebration on every action). Motion uses **only transform/opacity, <300ms** (FRD-13 motion tokens).
- **Reduced-motion variant:** with `prefers-reduced-motion`, show the toast without the animation (FRD-13).
- Self-dismiss after a short timeout; `aria-live` announcement.

## Dependencies
- WO-06-001 (event types), FRD-13 motion tokens + reduced-motion.

## TDD / Definition of done
- Component tests: a work-order-close event renders the toast with the WO id; a non-close event does not; with reduced-motion the animation class is absent but the toast renders; the toast auto-dismisses (fake timers).
- Gate green.
