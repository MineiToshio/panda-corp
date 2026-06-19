---
id: WO-06-011
type: work-order
slug: empty-reducedmotion-multiproject
title: WO-06-011 — Empty state + reduced-motion + multi-project borders
status: DRAFT
parent: FRD-06
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-18'
---
# WO-06-011 — Empty state + reduced-motion + multi-project borders

**Components/Interfaces:** `CMP-06-empty`, polish across `CMP-06-scene`/`CMP-06-feed` · **Traces:** REQ-06-010
**Deploy unit:** Party tab · **Location:** `app/projects/[slug]/_party/PartyEmptyState.tsx` (+ `.test.tsx`) and edits to `FraguaScene`/feed

> **REOPENED → PLANNED (2026-06-18, La Fragua redesign).** Still valid in spirit, but the empty state now
> means **"no FRD currently in build"** and the reduced-motion wiring targets the new `FraguaScene`
> (renamed from `PartyScene`). Re-point both. See the Status Note.

## Acceptance criteria (verbatim EARS)
- AC-06-010.1: IF there is no FRD currently in build (no active team / no events), THEN THE system SHALL show a graceful empty state, never a blank or crash.
- AC-06-010.2: WHEN `prefers-reduced-motion` is set, THE system SHALL disable ALL Party animation (sprites static, no RAF loop) while keeping the scene readable.
- AC-06-010.3: WHILE events from more than one project are present, THE system SHALL distinguish them with a **project-color (left border) + role-color (second border)**; events with no `project` field render with the role color only.

## Scope
- `CMP-06-empty`: friendly Spanish empty state ("No hay un FRD en construcción") with guidance pointing to `/pandacorp:implement`; never a blank/crash.
- Wire `prefers-reduced-motion`: when set, `FraguaScene` does **not** start the RAF loop (sprites static) and the feed/toast skip animation — verify ALL Party animation is disabled (FRD-13).
- Multi-project rendering: when the snapshot contains >1 project, feed rows show the project-color + role-color double border.

## Dependencies
- WO-06-006 (`FraguaScene`), WO-06-007 (feed), FRD-13 (reduced-motion, tokens).

## TDD / Definition of done
- Tests: `active=false` renders the empty state, not the scene; with `matchMedia(prefers-reduced-motion: reduce)` the RAF loop is not started and no animation classes apply; a 2-project snapshot renders the double border. Empty/reduced-motion never throw.
- Gate green.

## Status Note (La Fragua retry — IN_REVIEW, 2026-06-18)

**What this build delivered (the retry):**

1. **`PartyEmptyState.tsx`** (CMP-06-empty) — updated copy from the old "no active team" framing to the
   La Fragua per-FRD framing (AC-06-010.1):
   - Heading: "No hay un FRD en construcción"
   - Body: "La Fragua se activará cuando se inicie una construcción con /pandacorp:implement"
   - Hint: "Los agentes aparecerán aquí FRD a FRD, conforme avance la construcción"
   - `aria-label`: "Sin FRD en construcción — no hay agentes activos"
   - All existing constraints preserved: `role="status"`, `data-testid="party-empty-state"`, zero
     hardcoded colors, never crashes, guidance references `/pandacorp:implement`.

2. **`FraguaScene.tsx`** (CMP-06-scene, reduced-motion wired) — added `prefers-reduced-motion` support
   to the La Fragua scene (AC-06-010.2). Uses the same pattern as `PartyScene`:
   - `useState` initializer reads `window.matchMedia("(prefers-reduced-motion: reduce)").matches`
     once on mount (synchronous, no flash of animated content).
   - Defensive guard: `typeof window.matchMedia !== "function"` → returns `false`, so jsdom tests
     without a stub don't throw.
   - When `reducedMotion=true`: the RAF loop is entirely skipped (early return before
     `requestAnimationFrame(tick)`) — all FraguaScene animation is suppressed.
   - The scene stays fully readable: all three rooms (Forja/Tribunal/Bóveda), running WO sprites,
     trophies, the reviewer gate and the FRD tracker still render at their initial positions.
   - `data-reduced-motion="true"` attribute on `<section data-testid="fragua-scene">` for CSS
     targeting and test introspection.
   - `reducedMotion` added to the `useEffect` dependency array (lint-safe, stable boolean).

3. **Multi-project borders** — already implemented in prior build (`EventFeed.tsx`, WO-06-007).
   No code change needed; all 9 multiproject tests remain green (AC-06-010.3 satisfied).

**Interfaces/contracts exposed (delta from previous build):**

```tsx
// PartyEmptyState — zero props, always renders the graceful empty state.
export function PartyEmptyState(): React.JSX.Element
// data-testid="party-empty-state", role="status"
// aria-label="Sin FRD en construcción — no hay agentes activos"

// FraguaScene — now respects prefers-reduced-motion (AC-06-010.2)
// data-reduced-motion="true" on <section data-testid="fragua-scene"> when reduced
// RAF loop skipped when window.matchMedia("(prefers-reduced-motion: reduce)").matches
```

**Integration seams (unchanged):**
- `PartyTab` renders `<PartyEmptyState />` inside `data-testid="party-tab-empty"` when `active=false`.
- `FraguaScene` reads `prefers-reduced-motion` via `useState` initializer — no props change needed.
- `EventFeed` multi-project borders driven by `EventVM.projectColorKey` (unchanged).

**Test files covering this WO:**
- `src/app/projects/[slug]/_party/PartyEmptyState/_tests/PartyEmptyState.test.tsx` — 10 tests
  (AC-06-010.1 original suite; all still pass with updated copy)
- `src/app/projects/[slug]/_party/PartyEmptyState/_tests/PartyEmptyState.fragua.test.tsx` — 4 tests
  (NEW: La Fragua copy assertions — "No hay un FRD en construcción", aria-label, implement hint)
- `src/app/projects/[slug]/_party/FraguaScene/_tests/FraguaScene.reducedmotion.test.tsx` — 10 tests
  (NEW: AC-06-010.2 — RAF skipped, data-reduced-motion attr, scene readable, no-crash, control)
- `src/app/projects/[slug]/_party/EventFeed/_tests/EventFeed.multiproject.test.tsx` — 9 tests
  (existing — AC-06-010.3 multi-project double border; all green, no change)
- `src/app/projects/[slug]/_party/PartyScene/_tests/PartyScene.reducedmotion.test.tsx` — 9 tests
  (existing — PartyScene (old 4-zone) reduced-motion; kept and green, no change)
- `src/app/projects/[slug]/_party/PartyTab/_tests/PartyTab.integration.reviewer.test.tsx` — 8 tests
  (existing reviewer integration; all green, no regression)

**Gate:** 236 test files, 5945 tests GREEN + 2 expected-fail + 5 skipped. `tsc --noEmit` clean.
`biome check` clean (0 new errors). Full `verify.sh` PASS.

---

### Previous build (obsoleted by the redesign — kept for history)

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
