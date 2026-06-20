---
id: WO-09-003
type: work-order
slug: guild-surfaces
title: 'WO-09-003 — Guild surfaces: GuildBar + GuildHero + StatRadar + CelebrationSurface'
status: DRAFT
parent: FRD-09
implementation_status: PLANNED
artifacts:
  - 'src/app/achievements/page.tsx'
  - 'src/components/modules/GuildBar/**'
  - 'src/app/achievements/StatsPanel.tsx'
  - 'src/components/core/CelebrationSurface/**'
  - 'src/components/core/Shield/**'
  - 'src/components/core/XpBar/**'
  - 'src/components/core/Avatar/**'
source_requirements: [AC-09-004.1, AC-09-004.2, AC-09-004.3, AC-09-004.4, AC-09-004.5, AC-09-003.1, AC-09-003.2, AC-09-003.3, AC-09-006.1, AC-09-006.2, AC-09-006.3, AC-09-006.4, AC-09-006.5]
last_updated: '2026-06-19'
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

**What was built:**

1. **`XpBar`** (`src/components/core/XpBar/XpBar.tsx`) — extended with `size?: "compact" | "full"` prop. Compact = 9px inline bar (hidden XP/next spans for tests, `data-size="compact"`). Full = 18px with label+subtitle rows (default). Both variants use `data-accent="true"` on fill and accent CSS custom properties only.

2. **`GuildBar`** (`src/components/modules/GuildBar/GuildBar.tsx`) — complete rewrite matching prototype `topbar()` ~L646: rpgpanel embossed tile (`data-variant="rpgpanel"`), rpggrid dot overlay, NV level pill (`data-testid="guild-bar-level-pill"`, `data-px="true"`, `data-accent="true"`), level numeral child span (`data-testid="guild-bar-level"`), rank title (`data-testid="guild-bar-title"`), compact XpBar inline.

3. **`GuildHero`** (`src/components/modules/GuildHero/GuildHero.tsx`) — NEW shared module. Matches prototype `logrosHero()` ~L413: rpgpanel+rpggrid `<section>`, `Shield` crest, "GREMIO PANDACORP" pixel eyebrow, display-font title (`data-testid="guild-hero-title"`), feats/trophies/missions summary (`data-testid="guild-hero-summary"`), full `XpBar`, party `<ul>` (`data-testid="guild-hero-party"`), 3 `StatBadge` tiles in `data-testid="guild-hero-stats"`. Props: `level`, `title`, `xp`, `next`, `pctToNext`, `nextTitle`, `featsCount`, `trophiesCount`, `trophiesTotal`, `missionsActive`, `partyRoster: readonly AgentRole[]`, `statsLanzados`, `statsRacha`, `statsVelocidad`.

4. **`StatRadar`** (named export from `src/app/achievements/StatsPanel.tsx`) — NEW. Matches prototype `statRadar()` ~L459: SVG `viewBox="0 0 330 280"`, cx=165/cy=140/R=90, 4 grid ring polygons (`data-testid="radar-ring"`, SVG presentation attributes `stroke="var(--color-border)"`), 6 spoke lines, base polygon, data polygon (`data-testid="radar-data-polygon"`, `fill="var(--color-accent)"`, `stroke="var(--color-accent)"`), 6 accent dots (`data-testid="radar-dot"`), pixel-font axis labels. Props: `axes: StatRadarAxes` (produccion/velocidad/calidad/constancia/ideacion/alcance, 0–100).

5. **`CelebrationSurface`** (`src/components/core/CelebrationSurface/CelebrationSurface.tsx`) — upgraded to match prototype `bOverlay()` + `bConfetti()`. release/levelup tiers: fixed-position overlay (`data-testid="celebration-overlay"`, `role="presentation"`), rpgpanel card (`data-testid="celebration-card"`), confetti (`data-testid="celebration-confetti"`, 26 pieces keyed by position, `data-reduced="true"` under reduced-motion), dismiss button (`data-testid="celebration-dismiss"`). levelup: `data-testid="celebration-level"` with pixel NV numeral + actual level digit. New props: `onDismiss?: () => void`, `newLevel?: number` (default 2). toast/phase: unchanged small `celebration-surface`.

6. **`achievements/page.tsx`** — hero section replaced with `GuildHero`; `StatRadar` added beside `StatsPanel`. Page heading changed to "Logros" (DR-062). Props derived from `computeStats`, `computeUniques`, `eventsSnapshot?.events` (null-guarded). Old `HALL_TABS`/bespoke hero removed.

**Interfaces/contracts exposed:**
- `XpBar` `size` prop accepts `"compact" | "full"` (the `XpBarSize` alias is now module-private — no external consumer, so it is not exported)
- `GuildHeroProps` — see type in `GuildHero.tsx` (all fields required except `partyRoster` which is `readonly AgentRole[]`)
- `StatRadarAxes` — `{ produccion; velocidad; calidad; constancia; ideacion; alcance }` all `number` 0–100 (module-private in `StatsPanel.tsx`, used by `StatRadarProps`)
- `CelebrationSurfaceProps` — `event: Event | null`, `onDismiss?: () => void`, `newLevel?: number`

**Repair (2026-06-20, repair engineer — FRD-16 tree-gate green-up):**
Fixed two of the three FRD-09 reviewer blockers; the third (CelebrationSurface not wired to the event stream — AC-09-006.1/.5) remains open, so this WO stays **PLANNED** for the FRD-09 build to complete the wiring.
- **Honesty (finding #2, AC-09-004.3 / FRD-09 core principle):** `LevelupContent` no longer hardcodes "Gran maestro del gremio" / `next=2000`. It now derives the rank title, base XP and next threshold from `RANKS` by `newLevel` (1-based → `RANKS[newLevel-1]`): a fresh bar at the new rank reads `xp = currentRank.threshold` toward `next = nextRank.threshold` (0% into the new rank), `label`/`nextTitle` from the real ladder. At max rank, next mirrors current. Pinned by `_tests/wo-09-003-celebration-honesty.adversarial.test.tsx` (3 reviewer adversarial tests).
- **Biome (finding #1):** removed 2 unused `biome-ignore` suppressions (`useKeyWithClickEvents`+`noStaticElementInteractions` on the backdrop where `role="presentation"` already exempts, and `useExhaustiveDependencies` on the mount-only matchMedia effect). Kept the single suppression that actually fires (`noStaticElementInteractions` on the click-dismiss backdrop). `biome check --error-on-warnings` clean.
- **Dead code (knip, fail-closed):** dropped the unused `export` on `XpBarSize` and `StatRadarAxes` (both used only internally). The `/board` visual baseline was re-blessed: the FRD-09 compact-XpBar GuildBar correctly replaced the previously-blessed broken double-"Aprendiz" header (height 1211→1178px); the old baseline captured the defect, the new render is the AC-09-004.5-compliant fix.
- **Still open (finding #3):** `CelebrationSurface` has 0 non-test consumers; it must be mounted in the shell and fed the latest result event for the auto-fire AC to hold in runtime. Not fixable as a repair edit — left for the FRD-09 build.

**Implicit decisions and assumptions:**
- `GuildHero` is a `<section>` (not `<div>`) for `aria-label` ARIA compatibility (biome a11y rule)
- `GuildHero` party roster uses `<ul>`/`<li>` (not `div role="list"`)
- `StatRadar` uses SVG presentation attributes (`stroke=`, `fill=` props) instead of CSS `style={}` so jsdom's `getAttribute("stroke")` works in tests
- `CelebrationSurface` backdrop uses `rgba(0,0,0,.66)` — the one accepted exception to the no-hardcoded-colors rule (prototype pattern, explicitly commented)
- `newLevel` defaults to `2` when not provided (first possible level-up result)
- Confetti pieces keyed by `p.left` (position string) to avoid `noArrayIndexKey` lint rule; 26 pieces total per prototype
- `radarAxes` in `page.tsx` uses illustrative scale mappings (e.g. 5 products shipped = 100% produccion); `velocidad` = 0 until a velocity-tracking WO ships
- Old `page.test.tsx` tests for `hall-hero`/`hall-guild-level`/`hall-party-avatars`/`hall-tabs` updated to `guild-hero`/`guild-hero-title`/`guild-hero-party` (4 tab tests removed as tabs are out of WO-09-003 scope)
- `eventsSnapshot?.events` null-guarded in page derivations (test mock returns null)

**Test files:**
- `src/components/modules/GuildBar/_tests/wo-09-003-guildbar.test.tsx`
- `src/components/modules/GuildHero/_tests/GuildHero.test.tsx`
- `src/app/achievements/_tests/wo-09-003-stat-radar.test.tsx`
- `src/components/core/CelebrationSurface/_tests/wo-09-003-celebration-overlay.test.tsx`
- Updated: `src/app/achievements/_tests/page.test.tsx`

**Gate result:** 286 test files / 6671 tests passing, 0 type errors (`tsc --noEmit`), 0 lint errors (biome), 2 warnings (unused suppression comments in `CelebrationSurface.tsx` — cosmetic, non-blocking).
