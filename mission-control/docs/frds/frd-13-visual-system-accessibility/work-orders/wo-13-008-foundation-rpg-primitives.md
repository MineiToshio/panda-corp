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

## Status Note — IN_REVIEW (2026-06-19)

**What was built:** Four RPG/gamification primitive components factored out of inline prototype
code into named, reusable Server Components on frozen design tokens. All render correctly in
light and dark themes, WCAG AA, tokens only, `tabular-nums` on numerals, `aria-label` in Spanish.

**Interfaces / contracts exposed:**

```ts
// src/components/core/Shield/Shield.tsx
export type ShieldSize = "sm" | "md" | "lg";
export type ShieldProps = {
  level: number;          // guild/operator level numeral
  size?: ShieldSize;      // sm=64px, md=96px (default), lg=120px
  glow?: boolean;         // outer accent glow, default true
};
export function Shield(props: ShieldProps): React.JSX.Element;
// data-testid="shield-root", data-glow, aria-label="Escudo del gremio · Nivel {N}"
// data-testid="shield-nivel-label" (NIVEL text), data-testid="shield-level" (numeral)

// src/components/core/TierBadge/TierBadge.tsx
export type TierLevel = 1 | 2 | 3 | 4 | 5;
export type TierBadgeProps = {
  tier: TierLevel;        // 1=Bronce, 2=Plata, 3=Oro, 4=Platino, 5=Leyenda
  name: string;           // visible label — ALWAYS present (not color-alone)
};
export function TierBadge(props: TierBadgeProps): React.JSX.Element;
// data-testid="tier-badge-root", data-tier={tier}, aria-label="Rango {name}"
// data-testid="tier-badge-name" (name text, always visible)
// Color token: var(--color-tier-{1..5}) as background; var(--color-base) as text

// src/components/core/ItemSlot/ItemSlot.tsx
export type ItemSlotProps = {
  icon: React.ReactNode;  // icon / content inside the slot
  size?: number;          // px, default 40; prototype sizes: 34/40/42/58
  tone?: "accent" | "warn" | "ok" | "danger";  // border+bg token mapping
  lock?: boolean;         // filter:saturate(.55) on inner content
  reveal?: React.ReactNode; // hover/focus-within overlay (CSS-only, no "use client")
  "aria-label": string;   // required Spanish label (REQ-13-008)
};
export function ItemSlot(props: ItemSlotProps): React.JSX.Element;
// data-testid="itemslot-root", data-tone={tone|""}, data-locked={true|false}
// data-testid="itemslot-reveal" (only when reveal prop provided)
// border-radius 9px, image-rendering:pixelated, inline-flex centered
// reveal transition: opacity .18s ease, suppressed by prefers-reduced-motion

// src/components/core/KanbanColumn/KanbanColumn.tsx
export type KanbanColumnProps = {
  label: string;          // Spanish column heading (e.g. "Pendiente")
  count: number;          // item count displayed in pixel font, accent-text color
  children?: React.ReactNode; // WO card children in the scrollable body
};
export function KanbanColumn(props: KanbanColumnProps): React.JSX.Element;
// <section> element with aria-label="Columna {label}: {count} elemento(s)"
// data-testid="kanban-col-root" (<section>), "kanban-col-label", "kanban-col-count", "kanban-col-body"
// Width: 224px fixed (prototype .col), panel background, bd border, radius 10px
```

**Integration seams:**
- `Shield` → consumed by `GuildHero` (FRD-09/10, achievements page) and any future level-display
  surface. Replace inline `<div class="shield rpggrid">` in `page.tsx` / `GuildHero` when FRD-09/10
  re-paint WOs run. The `rpggrid` texture can be composed inside via `children` or the consuming
  component adds it as a CSS class.
- `TierBadge` → consumed by `ChainCard` (FRD-10) and `StatsPanel`. The existing `tierColorToken()`
  helper in `ChainCard.tsx` is superseded by `TierBadge`; migrate in the FRD-10 re-paint WO.
- `ItemSlot` → consumed by any surface that renders a pixel icon slot (Logros medals, trophy cards,
  AlmostThere cards, pageHead `icon` parameter, skill/agent/rule cards in Configuración). The
  existing inline `<span class="itemslot" ...>` patterns across `achievements/` and
  `configuration/` migrate to `<ItemSlot>` in their respective re-paint WOs.
- `KanbanColumn` → consumed by `WoBoard` (`wo-board.tsx`). The existing inline `COLUMN_STYLE`
  object and heading rendering in `wo-board.tsx` migrate to `<KanbanColumn>` in the FRD-05
  re-paint WO. `WoBoard` passes each column's WO cards as `children`.

**Implicit decisions and conventions:**
- `Shield.size` uses the string enum `sm/md/lg` (not raw px) so consumers don't need to know
  the px values; the SIZE_MAP in `Shield.tsx` owns the mapping.
- `TierBadge` uses `var(--color-base)` as text color (canvas black on tier-colored background),
  matching the prototype's `color:var(--canvas)` pattern in `rpgSkin.herostat.tierBadge`.
- `ItemSlot` requires `aria-label` as a non-optional prop (compile-time enforcement) because every
  slot must have an accessible label (REQ-13-008) — there is no safe default.
- `ItemSlot` uses an inline `<style>` block for the hover/focus-within reveal rather than a global
  CSS class to keep the component self-contained without requiring "use client". The class name
  `itemslot-wrap`/`itemslot-reveal` is scoped enough to be safe app-wide.
- `KanbanColumn` uses `<section>` (not `<div role="region">`) per Biome's `useSemanticElements`
  rule. The `aria-label` includes the count in the sentence for screen reader context.
- All four components are Server Components (no `"use client"`) — pure, deterministic, no I/O.
- `prefers-reduced-motion`: handled globally by `globals.css` (`animation-duration: 0ms !important`
  on all elements under reduced-motion). The `ItemSlot` reveal also explicitly sets
  `transition: none` in an inline `@media` block for belt-and-suspenders coverage.

**Test files covering this WO:**
- `src/components/core/Shield/_tests/Shield.test.tsx` — 17 tests (all pass)
- `src/components/core/TierBadge/_tests/TierBadge.test.tsx` — 21 tests (all pass)
- `src/components/core/ItemSlot/_tests/ItemSlot.test.tsx` — 20 tests (all pass)
- `src/components/core/KanbanColumn/_tests/KanbanColumn.test.tsx` — 16 tests (all pass)
- Total: 74 tests across 4 files, all passing

**Preview route for visual fidelity check:**
- `src/app/preview-wo13008/page.tsx` — renders all four components in light+dark
- Verified at `/preview-wo13008`; both themes match the `rpgSkin` contract from
  `docs/design/design-tokens.json`

**Gate results (2026-06-19):**
- `vitest run` (WO tests) — 68 passed (0 failed)
- `tsc --noEmit` — 0 errors in new components (pre-existing errors are WO-13-007 planned components)
- `biome check` (new component folders) — exit 0, no errors
- `next build` — clean, `/preview-wo13008` route present
- Visual fidelity: dark+light screenshots match prototype `rpgSkin.shield`/`.itemslot`/
  `.herostat.tierBadge`/`.col` spec; no divergences found in 1 fidelity cycle
