---
id: WO-13-008
type: work-order
slug: foundation-rpg-primitives
title: 'WO-13-008 — Foundation (FND-3): RPG/gamification primitives — Shield · TierBadge · ItemSlot · KanbanColumn'
status: DRAFT
parent: FRD-13
implementation_status: PLANNED
foundation: true
artifacts:
  - 'src/components/core/Shield/**'
  - 'src/components/core/TierBadge/**'
  - 'src/components/core/ItemSlot/**'
  - 'src/components/core/KanbanColumn/**'
source_requirements: [CMP-13-shield, CMP-13-tierbadge, CMP-13-itemslot, CMP-13-kanbancolumn]
last_updated: '2026-06-19'
---
# WO-13-008 — Foundation (FND-3): the RPG/gamification primitives (DR-057)

> **FOUNDATION WO (DR-057).** Reused by Logros (FRD-09/10), the dashboard progress foot (FRD-18) and
> the work-orders kanban (FRD-05). `XpBar`/`Avatar`/`StateBadge`/`CelebrationSurface`/`ThemeToggle`/
> `CopyButton` already exist (*real*) — REUSE them, do not re-create.
> Source-of-truth: [`docs/design/components.md`](../../../design/components.md) §1.

## Goal
The four still-inline RPG primitives factored into named, reusable components on frozen tokens.

## Scope (one component per folder; tokens only)
- **`Shield`** — the crest medallion (`rpgSkin.shield`, 96×96, accent-bordered glowing) with the pixel
  NIVEL numeral. Props: `level`, `size`, `glow`. (Today inline in `GuildHero`.)
- **`TierBadge`** — Bronze→Legend rarity medal; **tier name text always rides with color** (never color
  alone). Props: `tier` (1–5), `name`. (Today inline in `ChainCard`.)
- **`ItemSlot`** — pixel-art medal/icon slot (`rpgSkin.itemslot`, `image-rendering:pixelated`). Props:
  `icon`, `size`, `tone`, `lock`/`reveal` (locked-trophy). Aliases: `.itemslot`/`.lockslot`/`.lockchip`.
- **`KanbanColumn`** — fixed-width WO column (`.col`, 224px): header label + count, horizontal-scroll
  row. Props: `label`, `count`. (Today inline in `wo-board`.)

## Acceptance criteria
- Each renders in light+dark, WCAG AA, `tabular-nums` on numerals, tokens only, `prefers-reduced-motion`
  respected on any glow/pulse. `TierBadge` conveys tier by text+color (never color alone).
- Appended to `docs/design/components.md` as **real**; the inline copies in GuildHero/ChainCard/wo-board
  are migrated to consume these in their re-paint WOs (FRD-09/10/05) — not duplicated.

## Visual reference
[`docs/design/prototype/index.html`](../../../design/prototype/index.html) — the Logros crest/medals/
ladders and the work-orders kanban columns; [`components.md`](../../../design/components.md) §1.
