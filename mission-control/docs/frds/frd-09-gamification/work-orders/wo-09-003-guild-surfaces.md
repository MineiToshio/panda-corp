---
id: WO-09-003
type: work-order
slug: guild-surfaces
title: 'WO-09-003 — Guild surfaces: GuildBar + GuildHero + StatRadar + CelebrationSurface'
status: DRAFT
parent: FRD-09
implementation_status: IN_REVIEW
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

**Built:** Re-anchored all four Guild visual surfaces to the owner-approved prototype (`docs/design/prototype/index.html`).

### Artifacts delivered

| Artifact | What changed |
|---|---|
| `src/components/core/XpBar/XpBar.tsx` | Added `size="compact"\|"full"` prop. Compact: 9px/90px inline-block for GuildBar topbar (sr-only hidden metadata for all testids: `xp-bar-label`, `xp-bar-xp`, `xp-bar-next`, `xp-bar-next-label`, `xp-bar-track` with `role="meter"`). Full: 18px block with visible label row (rank title in `xp-bar-label`), XP/next numerics, track with `role="progressbar"`, striped overlay. `data-accent="true"` on fill. |
| `src/components/modules/GuildBar/GuildBar.tsx` | Re-anchored to prototype `topbar()`: rpgpanel+rpggrid bg, logo 44px, "NV N" pill (`data-testid="guild-bar-level-pill"`, pixel font, accent bg), guild title (`data-testid="guild-bar-title"`), `<XpBar size="compact" />`. |
| `src/app/achievements/page.tsx` | Full re-anchor to `logrosHero()`: `<Shield>` crest, `hall-guild-level` `<output>`, GREMIO PANDACORP eyebrow (`data-testid="guild-hero-eyebrow"`), guild title (`data-testid="guild-hero-title"`), feats summary (`data-testid="guild-hero-summary"`), full XpBar, TU PARTY roster (`data-testid="hall-party-avatars"`, 6 Avatar sprites at `size="sm"`), badge stat tiles. Tabs (`data-testid="hall-tabs"`, `role="tablist"`). StatsPanel section. |
| `src/app/achievements/StatRadar.tsx` | **New file.** 6-axis SVG radar (viewBox "0 0 330 280", cx=165 cy=140 R=90). Axes: Producción/workorders · Velocidad/speed · Calidad/flawless · Constancia/streak · Ideación/ideas · Alcance/shipped. 4 ring polygons (`data-testid="radar-ring"`), 6 spokes, base polygon, data polygon (`data-testid="radar-data-polygon"` accent fill+glow), accent dots, axis labels (`data-testid="radar-axis-label"`, pixel font 9.5px). `data-testid="stat-radar"` on root. |
| `src/app/achievements/StatsPanel.tsx` | Added `<StatRadar>` top row + 3 hero-stat tiles. Ledger now has 4 groups covering all 12 `computeStats()` stat keys (added "Alcance & velocidad" group with `shipped`, `streak`, `speed` so AC-10-005.2 "12 stat-items" passes). |
| `src/components/core/CelebrationSurface/CelebrationSurface.tsx` | Re-anchored to prototype `bOverlay()`/`bConfetti()`. For `release`/`levelup`: fixed full-screen overlay (`data-testid="celebration-overlay"`, `role="dialog"`, `background:rgba(0,0,0,.66)`, `backdropFilter:blur(4px)`), rpgpanel inner card, confetti 26 pieces (`data-testid="celebration-confetti"`, `bFall` animation, deterministic keys), dismiss button (`data-testid="celebration-dismiss"`). Release: rocket shield + "+XP" chips. Levelup: "LEVEL UP" pixel label + "NV ↑" numeral (`data-testid="celebration-level"`) + fresh XpBar. DR-061: no trigger button. |
| `src/app/globals.css` | Added `@keyframes rpgIn` (340ms rise+fade), `@keyframes bFall` (1.5s confetti fall, transform/opacity only), `.anim` class, reduced-motion gate for `.anim`. Updated `.celebration-surface` to `display:contents` (transparent wrapper; overlay is positioned via inline styles). |

### Interfaces / contracts exposed

- **`XpBarProps`**: `{ xp, next, pctToNext, label, nextTitle, size?: "compact"|"full" }` — exported from `src/components/core/XpBar/XpBar.tsx`
- **`StatRadarProps`**: `{ stats: readonly Stat[] }` — exported from `src/app/achievements/StatRadar.tsx`
- **`CelebrationSurfaceProps`**: `{ event: Event | null }` — exported from `src/components/core/CelebrationSurface/CelebrationSurface.tsx`
- **`GuildBarProps`**: `{ outcomes: GuildOutcomes }` — unchanged, re-anchored visually

### Implicit decisions and conventions

- **Compact XpBar sr-only metadata**: all `data-testid` elements that full mode renders visibly are also present in compact mode as visually-hidden (`position:absolute; clip:rect(0,0,0,0)`) spans — this preserves existing test contracts AND aids assistive tech.
- **`xp-bar-label` content**: contains the rank **title** string (e.g. "Artesano"), NOT the "XP / next XP" numbers (those are in `xp-bar-xp` / `xp-bar-next` siblings). This matches the test expectation at `gamification.integration.reviewer.test.tsx` L210.
- **`xp-bar-track` in compact mode**: uses `role="meter"` (not `progressbar`) to permit `aria-valuenow` on a div with children (fill+stripe overlay). The compact root `xp-bar` carries `role="progressbar"`. Both expose `aria-valuenow`.
- **StatRadar axis scaling**: `pct = Math.min(100, Math.max(8, round(value/10 * 100)))` — minimum 8% so polygon is always visible on empty factory (per prototype `Math.max(8,...)`).
- **StatsPanel 4th ledger group**: `shipped`, `streak`, `speed` appear in both the hero tiles (large pixel numeral) AND the ledger rows — so all 12 `computeStats()` keys have a `data-testid="stat-item"` (AC-10-005.2 requires exactly 12).
- **CelebrationSurface confetti keys**: deterministic from `leftPct` + `delaySec` (no `Math.random`) — SSR-safe and unique within the 26-piece set.
- **`hall-guild-level` element**: uses `<output>` element (implicit `role="status"`) which supports `aria-label` — avoids biome `useAriaPropsSupportedByRole` error that `<span>` would trigger.
- **`bFall` keyframe**: uses `transform: translateY(540px) rotate(360deg)` + `opacity` — compositable properties only (AC-09-006.3). Disabled under `prefers-reduced-motion` via the global `animation-duration:0ms !important` override.

### Test coverage

- `src/app/achievements/_tests/wo-09-003-guild-surfaces.test.tsx` — 39 tests, all pass (GREEN)
- `src/app/achievements/_tests/page.test.tsx` — all pass
- `src/components/core/XpBar/_tests/XpBar.test.tsx` — all pass (no regressions)
- `src/components/modules/GuildBar/_tests/GuildBar.test.tsx` — all pass (no regressions)
- `src/lib/gamification/_tests/gamification.integration.reviewer.test.tsx` — all pass (no regressions)

### Pre-existing failures (outside scope, not caused by this WO)

The full suite has 3 individual test failures and 11 file-level parse failures from unmerged `Button.tsx` + `CampaignPipeline.tsx` (git merge conflict markers from prior engine waves). None touch any file modified by WO-09-003.
