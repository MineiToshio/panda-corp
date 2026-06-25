---
id: WO-09-003
type: work-order
slug: guild-surfaces
title: 'WO-09-003 — Guild surfaces: GuildBar + GuildHero + StatRadar + CelebrationSurface'
status: DRAFT
parent: FRD-09
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/achievements/page.tsx'
  - 'src/components/modules/GuildBar/**'
  - 'src/components/modules/GuildHero/**'
  - 'src/components/modules/CelebrationWatcher/**'
  - 'src/app/achievements/StatsPanel.tsx'
  - 'src/components/core/CelebrationSurface/**'
  - 'src/components/core/Shield/**'
  - 'src/components/core/XpBar/**'
  - 'src/components/core/Avatar/**'
  - 'src/app/layout.tsx'
source_requirements: [AC-09-004.1, AC-09-004.2, AC-09-004.3, AC-09-004.4, AC-09-004.5, AC-09-003.1, AC-09-003.2, AC-09-003.3, AC-09-006.1, AC-09-006.2, AC-09-006.3, AC-09-006.4, AC-09-006.5]
dependsOn: [WO-09-001, WO-09-005, WO-09-002, WO-01-007, WO-01-005, WO-03-001, WO-01-009, WO-13-006, WO-13-007, WO-13-008]
last_updated: '2026-06-21'
---
# WO-09-003 — Guild surfaces: GuildBar + GuildHero + StatRadar + CelebrationSurface

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-09-guild-bar`, `CMP-09-xp-bar`, `CMP-09-celebration`, `CMP-09-avatar`](../blueprint.md#3-components--interfaces).
FDD: [the shared gamified elements + the celebration scale](../fdd.md).

> **Phase 2 re-plan (DR-062 cohesion / prototype fidelity).** This single coarse UI work order
> re-implements the FRD-09 **Guild** presentational surfaces to match the owner-approved prototype
> (`docs/design/prototype/index.html`). The pure XP/celebration engine (`lib/gamification.ts`,
> WO-09-001/002/005) is **VERIFIED and untouched** — this WO consumes it. The engine injects the
> standard UI envelope (read fdd.md + mocks/ + tokens + in-loop visual fidelity + reuse `components.md`)
> into this WO.

## Goal
Build/re-anchor the cross-cutting **Guild** visual layer faithfully to the prototype:
- **`GuildBar`** — the persistent top status bar (one per app): NV level pill + guild title + inline
  compact `XpBar`. Lives in the app shell (`app/layout.tsx`).
- **`GuildHero`** — the character-sheet hero panel on the Achievements page: `Shield` crest + guild
  title + feats/trophies/missions summary line + full-width `XpBar` + the **TU PARTY** sprite roster.
- **`StatRadar`** — the 6-axis "Atributos del gremio" SVG attribute radar (hosted on the Hall's
  Estadísticas tab; FRD-09 owns the visual, FRD-10 owns the tab).
- **`CelebrationSurface`** — the **auto-firing** full-screen celebration (release) / level-up overlay,
  driven by `classifyCelebration()`; fired by the milestone (release / XP threshold), **never a button**.

The page H1 "Logros" is the one `PageTitle` block. **FRD-09 owns the hero + GuildBar + radar; FRD-10
owns the chains/trophies/almost-there sections** — keep artifacts disjoint by subfolder
(FRD-09 → `page.tsx` hero block, `GuildBar/**`, `StatsPanel.tsx`; FRD-10 → `ChainCard/`,
`UniquesSection/`, `AlmostThere.tsx`, `SecretsPanel.tsx`).

## Scope
Components from `docs/design/components.md` (reuse → adapt → create; never fork a near-duplicate):
- **`GuildBar`** (module) — reuse; level pill + guild title + inline compact `XpBar`.
- **`GuildHero`** (module, in the achievements `page.tsx` hero block) — reuse; composes `Shield` +
  `XpBar` (full) + `Avatar` roster.
- **`Shield`** (core) — the crest medallion with the pixel NIVEL numeral.
- **`XpBar`** (core, **real**) — reuse the existing honest striped bar; compact (top bar) + full (hero)
  sizes. No second bar.
- **`Avatar`** (core, **real**) — reuse the pixel-art roster sprites.
- **`StatRadar`** (module, in `StatsPanel.tsx`) — the 6-axis SVG radar.
- **`CelebrationSurface`** (core, **real**) — reuse; `kind` release/levelup, `Confetti` child,
  reduced-motion variant. Auto-fired; **wrap any prototype preview button in the DR-061 `SOLO DEMO`
  block** — the real overlay never has a trigger button.
- **`PageTitle`** (core) — the one light "Logros" title block (no heavy hero replacing it; the
  GuildHero sits **under** it per DR-062).

## Acceptance criteria (FRD-09 EARS)
- **AC-09-004.1** — The top bar SHALL show the guild level/XP (operator) with title and a bar to the
  next level, from `computeGuildLevel()`.
- **AC-09-004.2** — Every number (level, XP, next) SHALL use `tabular-nums` (FRD-13).
- **AC-09-004.3** — The XP bar SHALL reflect **real** pct-to-next; never fake/stuck progress (negative AC).
- **AC-09-004.4** — The XP bar SHALL use the rationed accent (FRD-13) and SHALL NOT depend on color
  alone (label/shape present).
- **AC-09-004.5** — `XpBar` is the reusable primitive consumed by the guild bar, the hero and FRD-10.
- **AC-09-003.1/.2/.3** — `Avatar` renders pixel-art per agent id, degrades gracefully when a sprite is
  missing (no layout break), carries a Spanish `alt`/`aria-label`.
- **AC-09-006.1** — The celebration SHALL **scale** (toast → phase → release → level-up), never flat.
- **AC-09-006.2** — A non-result event SHALL produce **no** celebration (negative AC).
- **AC-09-006.3** — Animation SHALL use only `transform`/`opacity`, <300ms, **disabled** under
  `prefers-reduced-motion`; the data still updates without motion.
- **AC-09-006.4** — NO false-urgency timer/countdown/nagging in the celebration (negative AC).
- **AC-09-006.5** — Announcements SHALL use `aria-live="polite"` (Spanish) without stealing focus.

## Dependencies
- **Foundation (FRD-13):** WO-13-006 (`PageTitle`), WO-13-007 (`XpBar`/`Button`/`ProgressBar` set),
  WO-13-008 (`Shield`/`Avatar`/`ItemSlot`).
- **Engine (intra-FRD, VERIFIED):** WO-09-001 (`computeGuildLevel`/`deriveGuildOutcomes`),
  WO-09-005 (`classifyCelebration`).
- **Cross-FRD:** `frd-13` (tokens, motion, `prefers-reduced-motion`, `tabular-nums`). The achievements
  `page.tsx` hero block is **shared with FRD-10** — coordinate to keep artifacts disjoint (this WO owns
  the hero + GuildBar + radar; FRD-10 owns the chains/trophies sections).

## Visual reference
`docs/design/prototype/index.html` — `topbar()` (guild bar) · `logrosHero()` (hero) · `statRadar()`
(radar) · `bOverlay(kind)` + `bConfetti()` (celebration/level-up). See [mocks/README.md](../mocks/README.md)
and [fdd.md](../fdd.md) for the render-fn pointers and the token slice (`rpgSkin`, `tiers`, `accent`,
`typography.families.pixel`).

## Status Note

**What was built (this run — 2026-06-21, completing finding #3 from prior repair):**

7. **`CelebrationWatcher`** (`src/components/modules/CelebrationWatcher/CelebrationWatcher.tsx`) — NEW "use client" module. The global auto-fire wiring layer that connects the SSE transport to `CelebrationSurface`:
   - Subscribes to `useLiveSnapshot()` (WO-01-009, the shared EventSource hook) — no project filter; celebrations are app-wide.
   - Extracts the **most-recent event** from the live snapshot via `latestResultEvent()`: checks `events[events.length-1]` only — if it classifies as "none", no celebration fires (AC-09-006.2 negative AC: non-result events → silence, even if earlier events in the snapshot were results).
   - Passes the result event (or `null`) directly to `CelebrationSurface`, which calls `classifyCelebration()` internally to determine the tier and render.
   - No timer, no countdown, no auto-dismiss, no preview button (AC-09-006.4 negative AC; DR-061).
   - The ONLY button in the wired experience is the dismiss button inside `CelebrationSurface`'s overlay.
   - Mounted in `src/app/layout.tsx` inside the `profileResult.present` branch, alongside `GuildBar` and `ProposalsBadge`.

8. **`src/app/layout.tsx`** — added `CelebrationWatcher` import and mount point (after `ProposalsBadge`, before `{children}`).

9. **`docs/design/components.md`** — appended `CelebrationWatcher` row to the modules inventory (DR-057).

**All prior built artifacts (carried from prior implementation runs) — unchanged:**

1. **`XpBar`** (`src/components/core/XpBar/XpBar.tsx`) — `size?: "compact" | "full"`. Compact = 9px inline; full = 18px with label+subtitle.

2. **`GuildBar`** (`src/components/modules/GuildBar/GuildBar.tsx`) — rpgpanel+rpggrid, NV level pill, rank title, compact `XpBar`. Mounted in `app/layout.tsx`.

3. **`GuildHero`** (`src/components/modules/GuildHero/GuildHero.tsx`) — rpgpanel+rpggrid `<section>`, `Shield` crest, "GREMIO PANDACORP" eyebrow, display-font title, feats/trophies/missions summary, full `XpBar`, party `<ul>`, 3 `StatBadge` tiles.

4. **`StatRadar`** (named export from `src/app/achievements/StatsPanel.tsx`) — SVG `viewBox="0 0 330 280"`, cx=165/cy=140/R=90, 4 grid rings, 6 spokes, base polygon, accent data polygon + glow, 6 accent dots, pixel-font axis labels.

5. **`CelebrationSurface`** (`src/components/core/CelebrationSurface/CelebrationSurface.tsx`) — release/levelup full-screen overlay + confetti (26 pieces, keyed by position); toast/phase small surface. `LevelupContent` derives honest rank/XP from `RANKS[newLevel-1]` (AC-09-004.3).

6. **`achievements/page.tsx`** — `GuildHero` hero block + `HallTabs` 4-tab body. `StatRadar` in `StatsPanel`.

**Interfaces/contracts exposed:**
- `CelebrationWatcher` — no props; `"use client"`; mounted once in layout (global)
- `XpBar` `size` prop: `"compact" | "full"` (default `"full"`)
- `GuildHeroProps` — `level`, `title`, `xp`, `next`, `pctToNext`, `nextTitle`, `featsCount`, `trophiesCount`, `trophiesTotal`, `missionsActive`, `partyRoster: readonly AgentRole[]`, `statsLanzados`, `statsRacha`, `statsVelocidad` (all required)
- `StatRadarAxes` — `{ produccion; velocidad; calidad; constancia; ideacion; alcance }` all `number` 0–100 (module-private in `StatsPanel.tsx`)
- `CelebrationSurfaceProps` — `event: Event | null`, `onDismiss?: () => void`, `newLevel?: number` (default 2)
- `GuildBarProps` — `outcomes: GuildOutcomes`

**Implicit decisions and assumptions:**
- `latestResultEvent()` checks only the LAST event in the snapshot array (most-recent). Rationale: when a non-result event (read/navigate) arrives after a result event, the celebration should already have been seen and possibly dismissed — honoring the non-nagging contract (FRD-09 §White-Hat).
- `CelebrationWatcher` uses no project filter on `useLiveSnapshot()` — celebrations fire for any project in the factory (guild-level, cross-project scope).
- `GuildHero` is a `<section>` (not `<div>`) for `aria-label` ARIA compatibility (Biome a11y rule).
- `CelebrationSurface` backdrop uses `rgba(0,0,0,.66)` — the one accepted exception to the no-hardcoded-colors rule (prototype pattern, explicitly commented in source).
- `newLevel` defaults to `2` (the first possible level-up result) when not provided.
- Confetti pieces keyed by `p.left` (position string) to avoid `noArrayIndexKey` lint rule; 26 pieces per prototype.
- `radarAxes` in `page.tsx` uses illustrative scale mappings (e.g., 5 products shipped = 100% produccion); `velocidad` = 0 until a velocity-tracking WO ships.
- Test event fixtures for `CelebrationWatcher` tests use `event: "achievement"` with `task: "release"` (→ "release" tier) and `workOrder: "WO-09-003"` (→ "toast" tier), matching the actual `classifyCelebration()` decision table.

**Test files:**
- `src/components/modules/CelebrationWatcher/_tests/wo-09-003-celebration-watcher.test.tsx` — 11 tests (NEW, this run)
- `src/components/modules/GuildBar/_tests/wo-09-003-guildbar.test.tsx`
- `src/components/modules/GuildHero/_tests/GuildHero.test.tsx`
- `src/app/achievements/_tests/wo-09-003-stat-radar.test.tsx`
- `src/components/core/CelebrationSurface/_tests/wo-09-003-celebration-overlay.test.tsx`
- `src/components/core/CelebrationSurface/_tests/wo-09-003-celebration-honesty.adversarial.test.tsx`
- `src/app/achievements/_tests/page.test.tsx`

**Gate result (2026-06-21):** 308 test files / 6947 tests passing (+ 2 expected-fail from pre-existing WO-04-005 RED anchor, not regressed by this WO), 0 type errors (`tsc --noEmit`), 0 lint/format errors (biome), knip clean. Visual fidelity: `/achievements` screenshot shows GuildBar topbar + "Logros" h1 + GuildHero panel (Shield, GREMIO PANDACORP eyebrow, title, XP bar, TU PARTY sprites, 3 stat badges) + 4 tabs — recognizable match to prototype `logrosHero()` / `topbar()`. Route returns HTTP 200.
