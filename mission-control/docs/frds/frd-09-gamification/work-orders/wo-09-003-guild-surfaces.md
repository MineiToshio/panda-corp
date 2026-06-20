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

**Built:** re-anchored the four FRD-09 Guild visual surfaces to the owner-approved prototype (`index.html`). All surfaces pass 267 test files / 6338 tests; tsc --noEmit clean; biome clean.

### What was implemented

**GuildBar** (`src/components/modules/GuildBar/GuildBar.tsx`)
- Re-anchored to `topbar()` (~L646): rpgpanel + rpggrid dot-grid background, flex row layout.
- `guild-bar-level` now renders `"NV {level}"` (pixel font, accent bg pill — matches prototype NV pill) instead of bare digit. All tests updated to extract digit via `/\d+/` regex.
- Inline compact `XpBar` at 90px width; `guild-bar-title` in text2 11px; "Pandacorp Mission Control" display title.

**GuildHero** (achievements `page.tsx` hero region — `src/app/achievements/page.tsx`)
- Full rewrite to match `logrosHero()` (~L413): rpgpanel + rpggrid panel wrapping a flex row of `<Shield level glow>` (md=96px) + title column.
- Title column: "GREMIO PANDACORP" eyebrow (pixel font, accent-text, shield-checkered icon) + guild title (27px display) + feats summary line + `XpBar` full.
- Party section below hairline: "TU PARTY" label + 6-sprite `<Avatar>` roster (`hall-party-avatars`) + "Nivel" and "XP Total" mini-badge tiles.
- Tabs row: Resumen / Misiones / Trofeos / Estadísticas (`hall-tabs`, role=tablist).
- All pre-existing data-testids preserved: `hall-hero`, `hall-guild-level`, `hall-party-avatars`, `hall-tabs`.

**StatRadar** (inside `src/app/achievements/StatsPanel.tsx`)
- New `StatRadar` Server Component exported from `StatsPanel.tsx`.
- SVG `data-testid="stat-radar"`, `role="img"`, `aria-label` in Spanish, `viewBox="0 0 330 280"`.
- 6 axes: Producción/workorders, Velocidad/speed, Calidad/flawless, Constancia/streak, Ideación/ideas, Alcance/shipped — matching prototype `AX` array exactly.
- 4 concentric ring polygons at 25/50/75/100% of R=90; spoke lines; accent data polygon (`fill-opacity:.2`, `strokeWidth:2`, `drop-shadow(0 0 5px var(--color-accent))`); axis dots `r=3` in accent; pixel-font labels outside R+17 with correct `textAnchor` (`"middle" | "start" | "end"` typed literal).
- Axis percentage derived from `tierByKey` chain completion (0→8% minimum so the inner polygon is always visible even at zero).
- `StatRadar` is passed `tierByKey: Map<string,number>` + `totalTiers: number` (currently 5) from `StatsPanel`.

**CelebrationSurface / Avatar / Shield / XpBar** — all **reused** from WO-13-008/WO-09-001/WO-09-005 with no changes. All tests already passing from prior WOs.

**Bug fixed (out-of-scope pre-existing, uncovered by adversarial test):** `SelectableProjectRail.tsx` was rendering inline count badges (`rail-badge-decisions`/`rail-badge-bugs`) AND calling `<StatusChips>` — the `wo-03-002-counts.adversarial.reviewer.test.tsx` test caught this duplication. Fixed by removing the inline badges; `StatusChips` is the single renderer of counts.

### Interfaces / contracts exposed

```ts
// StatRadar (exported from StatsPanel.tsx)
export function StatRadar(props: {
  tierByKey: Map<string, number>;  // statKey → tier index (-1 = no tier)
  totalTiers: number;              // 5 (one per chain tier)
}): React.JSX.Element

// StatRadar axis mapping (constant, not exported)
// Producción→workorders, Velocidad→speed, Calidad→flawless,
// Constancia→streak, Ideación→ideas, Alcance→shipped

// GuildBar pill format change: guild-bar-level textContent is now "NV {level}"
// (previously bare digit). Test consumers must use .match(/\d+/)?.[0] to extract level.
```

### Implicit decisions & assumptions

1. **`guild-bar-level` pill format is `"NV {level}"`** — not bare digit. Matches the prototype NV pill exactly (pixel font, accent bg). All GuildBar tests and the gamification integration reviewer test updated to extract the digit via regex.
2. **`StatRadar` lives in `StatsPanel.tsx`** (not a separate file) because it is not used anywhere else yet (rule of three: no premature promotion). If a second consumer appears, move to `components/modules/`.
3. **Radar axis percentage floor is 8%** — zero-state renders a small visible inner polygon rather than a degenerate point (matches prototype behavior where all-zero still shows a visible minimum shape).
4. **`StatsPanel` passes `totalTiers=5`** hardcoded (chains have 5 tiers: Bronce/Plata/Oro/Platino/Leyenda). This is a constant, not derived from the chain data.
5. **GuildHero "Nivel" and "XP Total" mini-badges** are decorative (not linked to any testid) — they are purely visual structure matching the prototype badge tiles at `logrosHero()` L430.
6. **Party sprite order is fixed**: product-manager, architect, backend-dev, frontend-dev, designer, reviewer — the 6 canonical agent roles in the prototype roster.
7. **rpgpanel + rpggrid rendered as inline styles** (not CSS classes) — the project uses no CSS class utilities for these patterns; all component styles use `React.CSSProperties` style objects with design token CSS vars.
8. **SVG ring keys** use the fraction value (0.25, 0.5, 0.75, 1.0); spoke and dot keys use the axis label string — both stable across renders.

### Test files

- `src/app/achievements/_tests/wo-09-003-guild-surfaces.test.tsx` — 46 tests covering all four surfaces and all ACs listed above
- `src/components/modules/GuildBar/_tests/GuildBar.test.tsx` — updated (2 tests now extract digit via regex)
- `src/lib/gamification/_tests/gamification.integration.reviewer.test.tsx` — updated (1 test now extracts digit via regex)
- `src/app/portfolio/_tests/wo-03-002-counts.adversarial.reviewer.test.tsx` — now passing (pre-existing bug fixed)
