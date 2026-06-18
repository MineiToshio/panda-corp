---
id: WO-06-008
type: work-order
slug: achievement-toast
title: WO-06-008 — Achievement toast (work-order-close celebration)
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-18'
---
# WO-06-008 — Achievement toast (work-order-close celebration)

**Components/Interfaces:** `CMP-06-achievement` · **Traces:** REQ-06-012
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/AchievementToast.tsx` (+ `.test.tsx`)

> **KEPT IN_REVIEW (2026-06-18, La Fragua redesign).** The shipped toast already fires on a WO-close /
> `achievement` event with the WO id, <300ms motion + reduced-motion variant — exactly AC-06-012.1. The
> only change is the **REQ remap** (old REQ-06-007 → REQ-06-012). It still detects the close via the
> `EventVM` (`icon === "achievement"`) and is fed `latestEvent` by `PartyTab` (WO-06-005). No code change
> required by the redesign; left IN_REVIEW.

## Acceptance criteria (verbatim EARS)
- AC-06-012.1: WHEN a work order closes (reaches `VERIFIED`), THE system SHALL fire an **achievement** toast ("¡Logro desbloqueado!") with the work-order id, using transform/opacity motion under 300 ms, with a reduced-motion variant that renders without animation.

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

## Status Note

**Built:** `AchievementToast` (CMP-06-achievement) — Client Component that listens for `EventVM` inputs whose `icon === "trophy"` (the `achievement` event type from `IF-06-event-vm`) and fires "¡Logro desbloqueado!" with the work-order id.

**Interfaces/contracts exposed:**

```ts
// app/projects/[slug]/_party/AchievementToast.tsx
export interface AchievementToastProps {
  latestEvent: EventVM | undefined | null;
}
export function AchievementToast({ latestEvent }: AchievementToastProps): React.JSX.Element
```

- `latestEvent` is the most-recent `EventVM` from the feed (caller pushes new events; component debounces by `workOrder ?? at` key so the same event never fires twice on re-render).
- Detection: `vm.icon === "achievement"` OR `vm.label === "¡Logro desbloqueado!"` (robust to the `toEventVM` mapper).
- Auto-dismisses after 3 500 ms (fake-timer tested).
- `data-animated="true|false"`: `false` when `matchMedia("(prefers-reduced-motion: reduce)")` matches; transition set to `"none"` in that case.
- Motion: `opacity 200ms` + `transform 200ms` only — both <300ms (FRD-13).
- `role="status" aria-live="polite" aria-atomic="true"` — screen-reader friendly, never steals focus.

**data-testid surface:**
- `achievement-toast` — root container (present iff an achievement event is active)
- `achievement-toast-label` — "¡Logro desbloqueado!" text
- `achievement-toast-wo-id` — WO id span (absent when `workOrder` is undefined)

**Integration seams:**
- Caller (e.g. `PartyTab` or a future `PartyScene`) feeds `latestEvent` from the `EventVM[]` stream — pass the last element, or the last element whose `icon === "trophy"`.
- No internal polling; purely prop-driven. Fits naturally alongside `EventFeed` in the same RSC wrapper.

**Test file:** `app/projects/[slug]/_party/AchievementToast.test.tsx` — 18 tests across 7 suites (AC-06-007.1: render with WO id; non-achievement suppressed; undefined/null suppressed; reduced-motion variant; auto-dismiss with fake timers; aria-live; zero hardcoded colors; motion <300ms).

**Gate:** 3 867 tests GREEN (142 files) · tsc --noEmit clean · biome check clean. Commit `3e0c19b`.
