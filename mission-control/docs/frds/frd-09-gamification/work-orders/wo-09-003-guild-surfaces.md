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
