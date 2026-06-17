---
id: WO-06-011
type: work-order
slug: empty-reducedmotion-multiproject
title: WO-06-011 — Empty state + reduced-motion + multi-project borders
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-06-011 — Empty state + reduced-motion + multi-project borders

**Components/Interfaces:** `CMP-06-empty`, polish across `CMP-06-scene`/`CMP-06-feed` · **Traces:** REQ-06-010, REQ-06-011, REQ-06-003 (a11y)
**Deploy unit:** Party tab · **Location:** `app/projects/[slug]/_party/PartyEmptyState.tsx` (+ `.test.tsx`) and edits to scene/feed

## Acceptance criteria (verbatim EARS)
- AC-06-010.1: IF there is no active team, it SHALL show an empty state gracefully.
- AC-06-011.1: Each agent SHALL have a fixed color reused across the UI; multi-project → project-color (left border) + agent-color (second border).
- FRD-13: the UI SHALL honor `prefers-reduced-motion` — it disables ALL Party animation.

## Scope
- `CMP-06-empty`: friendly Spanish empty state ("no hay un equipo activo") with guidance; never a blank/crash.
- Wire `prefers-reduced-motion`: when set, the scene does **not** start the RAF loop (sprites static) and the feed/toast skip animation — verify ALL Party animation is disabled (FRD-13).
- Multi-project rendering: when the snapshot contains >1 project, sprites/feed rows show the project-color + agent-color double border.

## Dependencies
- WO-06-006 (scene), WO-06-007 (feed), FRD-13 (reduced-motion, tokens).

## TDD / Definition of done
- Tests: `active=false` renders the empty state, not the scene; with `matchMedia(prefers-reduced-motion: reduce)` the RAF loop is not started and no animation classes apply; a 2-project snapshot renders the double border. Empty/reduced-motion never throw.
- Gate green.

## Status Note

**What was built:**

1. **`PartyEmptyState.tsx`** (CMP-06-empty) — new standalone component: friendly Spanish empty state ("No hay un equipo activo") with guidance copy pointing to `/pandacorp:implement`. Zero hardcoded colors (all CSS custom properties). `role="status"`, Spanish `aria-label`, `data-testid="party-empty-state"` always present. Never crashes on mount.

2. **`PartyScene.tsx`** (CMP-06-scene, reduced-motion) — `useState` initializer reads `window.matchMedia("(prefers-reduced-motion: reduce)").matches` once on mount. When `true`, the `useEffect` that starts the RAF loop returns early without calling `requestAnimationFrame` — all animation is suppressed. Sprites still render at their initial positions with their initial state class (`s-idle`, `s-work`, etc.) so the scene remains readable. A `data-reduced-motion="true"` attribute is set on the `<section>` when motion is reduced (for test introspection and potential CSS targeting). Guard: `typeof window.matchMedia !== "function"` defensive check so jsdom tests without a stub don't throw.

3. **`PartyTab.tsx`** (CMP-06-party-tab) — replaced inline empty state div with `<PartyEmptyState />`. The wrapping `data-testid="party-tab-empty"` div is kept for existing test compatibility.

4. **Multi-project borders** — already implemented in `EventFeed.tsx` (WO-06-007): `data-project-color` + `data-agent-color` attributes on rows, `outline` trick for the double border. New tests in `EventFeed.multiproject.test.tsx` verify the 2-project snapshot behavior and legacy/global events.

**Interfaces/contracts exposed:**
- `export function PartyEmptyState(): React.JSX.Element` — zero props, always renders the graceful empty state.
- `PartyScene` now guards `window.matchMedia` with `typeof` check — safe in SSR/jsdom.
- `data-reduced-motion="true"` attribute on `<section data-testid="party-scene">` when motion is reduced.

**Integration seams:**
- `PartyTab` imports and renders `<PartyEmptyState />` when `active=false`.
- `PartyScene` reads `prefers-reduced-motion` from `window.matchMedia` on mount via `useState` initializer.
- `EventFeed` multi-project borders driven by `EventVM.projectColorKey` (set by `toEventVM` in `event-vm.ts` from `event.project`).

**Test files covering this WO:**
- `app/projects/[slug]/_party/PartyEmptyState.test.tsx` — 11 tests (AC-06-010.1, no hardcoded colors, data-testid)
- `app/projects/[slug]/_party/PartyScene.reducedmotion.test.tsx` — 9 tests (FRD-13 reduced-motion: RAF skipped, data attribute, control)
- `app/projects/[slug]/_party/EventFeed.multiproject.test.tsx` — 9 tests (AC-06-011.1 multi-project double border, legacy events)
- Pre-existing `PartyTab.test.tsx` (WO-06-005) — `party-tab-empty` testid still found via the wrapper div.
- Pre-existing `PartyScene.test.tsx` (WO-06-006) — all 27 tests pass (matchMedia guard prevents jsdom crash).

**Gate:** 150 test files, 4013 tests GREEN + 2 expected-fail + 5 skipped. `tsc --noEmit` clean. `biome check` clean (0 errors).
