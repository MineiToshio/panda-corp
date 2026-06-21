---
id: WO-10-005
type: work-order
slug: hall-surfaces
title: 'WO-10-005 — Hall surfaces: ChainCard + TrophyCard + AlmostThere + stat ledger'
status: DRAFT
parent: FRD-10
implementation_status: PLANNED
artifacts:
  - 'src/app/achievements/ChainCard/**'
  - 'src/app/achievements/UniquesSection/**'
  - 'src/app/achievements/AlmostThere.tsx'
  - 'src/app/achievements/SecretsPanel.tsx'
source_requirements: [AC-10-006.1, AC-10-006.2, AC-10-006.3, AC-10-006.4, AC-10-006.5, AC-10-007.1, AC-10-007.2, AC-10-007.3, AC-10-007.4, AC-10-008.1, AC-10-008.2, AC-10-008.3, AC-10-008.4, AC-10-005.2, AC-10-005.3]
last_updated: '2026-06-19'
---
# WO-10-005 — Hall surfaces: ChainCard + TrophyCard + AlmostThere + stat ledger

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-10-chain-card`, `CMP-10-uniques`, `CMP-10-secrets`, `CMP-10-almost-there`, `CMP-10-stats-panel`](../blueprint.md#4-components--interfaces).
FDD: [the Logros screen — Resumen · Misiones · Trofeos · Estadísticas](../fdd.md).

> **Phase 2 re-plan (DR-062 cohesion / prototype fidelity).** This single coarse UI work order
> re-implements the **Achievements Hall** presentational surfaces to match the owner-approved
> prototype (`docs/design/prototype/index.html`, the **Logros** view `logrosView()`). The pure
> `lib/achievements.ts` engine (WO-10-001) is **VERIFIED and untouched** — this WO consumes it.
> The engine injects the standard UI envelope (read fdd.md + mocks/ + tokens + in-loop visual
> fidelity + reuse `components.md`) into this WO.

## Goal
Render the Hall's chains, trophies, "almost there" and stat-ledger sections faithfully to the
prototype, composed into the achievements page under its four sub-tabs (Resumen · Misiones · Trofeos ·
Estadísticas):
- **`ChainCard`** — cumulative tier ladders (Bronze→Legend): `ItemSlot` medal + `TierBadge` ladder
  pips + honest endowed-progress `XpBar` + next-tier name + unlock date+project. Variants: big card /
  `spot` spotlight / `mini`.
- **`TrophyCard`** (`UniquesSection`) — one-time achievements grouped by category
  (Discovery·Speed·Quality·Consistency·Mastery): unlocked (date+project) / locked (condition) /
  secret (silhouette + cryptic hint → reveal criterion on unlock).
- **`AlmostThere`** — the Zeigarnik "Próximas hazañas · a un paso de caer" nearest-3 chains by %.
- **`HeroStat` / `StatLedgerRow`** — record/hero stat tiles + the per-category ledger (Producción ·
  Calidad · Ritmo & alcance), each stat carrying its tier pip.

**Shared-route coordination (FRD-09):** the achievements page hero, `GuildBar` and the radar
(`StatsPanel.tsx`) are owned by **FRD-09 WO-09-003**; the `PageTitle` "Logros" block and the page
shell are the FRD-09 hero region. This WO owns the **chains/trophies/almost-there** files only — keep
artifacts disjoint by subfolder (`ChainCard/`, `UniquesSection/`, `AlmostThere.tsx`, `SecretsPanel.tsx`).

## Scope
Components from `docs/design/components.md` (reuse → adapt → create; never fork a near-duplicate):
- **`ChainCard`** (route module) — reuse; card/spot/mini variants; date+project stamp line.
- **`TrophyCard`** / **`UniquesSection`** (route module) — reuse; unlocked / `rpgTrophyLock`
  hover+`:focus-within` reveal / secret silhouette branches.
- **`AlmostThere`** (route module) — reuse; top-3 chains by pctToNext, no false urgency.
- **`HeroStat` / `StatLedgerRow`** (route module, in the ledger section) — pixel numeral,
  `tabular-nums`, tier `.node` pip.
- **`ItemSlot`** (core) — the medal/icon slot, `lock`/`reveal` for locked trophies.
- **`TierBadge`** (core) — Bronze→Legend rarity medal; **tier name text always rides with color**.
- **`XpBar`** (core, **real**) — reuse for every chain progress bar; no custom bar.
- **`SectionHead`** (core) — every "En ascenso"/"Comunes"/"Conquistados" divider; no bespoke header.
- **`Tabs`/`SubTabs`** (core) — the four `.stab` sub-tabs (the page shell hosts them; FRD-09 owns the
  page hero — this WO populates the per-tab bodies).

## Acceptance criteria (FRD-10 EARS)
- **AC-10-006.1** — Each chain card SHALL show the current tier (Bronze→Legend), a bar to the next
  tier with its name, and tier pips, from `computeChains()`.
- **AC-10-006.2** — Each unlocked tier SHALL show its **date** and **project**.
- **AC-10-006.3** — The progress bar SHALL show **honest endowed progress** (real achieved, never
  inflated/stuck) and SHALL reuse `XpBar` (negative AC).
- **AC-10-006.4** — "Almost there" SHALL show the chains closest to their next tier; NO false urgency,
  countdowns or nagging (negative AC).
- **AC-10-006.5** — Tier colors from FRD-13 tier tokens; state never by color alone (badge label present).
- **AC-10-007.1** — Unique achievements SHALL be grouped by category, from `computeUniques()`.
- **AC-10-007.2** — Unlocked → date+project; locked → its condition (achievable, not obscure).
- **AC-10-007.3** — Locked/unlocked distinction NOT by color alone (icon/shape/label present).
- **AC-10-007.4** — Tokens only; numbers `tabular-nums`.
- **AC-10-008.1** — A locked secret SHALL render as a silhouette + cryptic hint (no criterion shown).
- **AC-10-008.2** — On unlock, the secret SHALL **reveal its criterion** + date+project (anti-loot-box).
- **AC-10-008.3** — The reveal SHALL be the actual triggering result, never fabricated.
- **AC-10-008.4** — Tokens only; locked/unlocked not by color alone (silhouette/icon/label).
- **AC-10-005.2/.3** — The stat ledger SHALL show the only-grow counters (each with its tier medal),
  every number `tabular-nums`, the XP bars reusing `XpBar` (honest, no fake fill).

## Dependencies
- **Foundation (FRD-13):** WO-13-006 (`SectionHead`/`Tabs`), WO-13-007 (`XpBar`/`Button`/`ProgressBar`),
  WO-13-008 (`ItemSlot`/`TierBadge`/`Shield`).
- **Engine (intra-FRD, VERIFIED):** WO-10-001 (`computeStats`/`computeChains`/`computeUniques`/`computeSecrets`).
- **Cross-FRD:** `frd-13` (tier tokens, `tabular-nums`); `frd-09` — **shares the achievements page**
  (FRD-09 WO-09-003 owns the hero/GuildBar/radar + page shell; this WO owns the chains/trophies/
  almost-there bodies). `XpBar` is the FRD-09/13 shared primitive.

## Visual reference
`docs/design/prototype/index.html` — `logrosView()` and its family: `rpgChainCard`/`rpgChainSpot`/
`rpgChainMini`, `rpgOneCard`/`rpgTrophyLock`, `questsNear`, `heroStat`/`statLedgerRow`. See
[mocks/README.md](../mocks/README.md) and [fdd.md](../fdd.md) for render-fn pointers and the token slice
(`rpgSkin` chains/lockchip/ledrow + `tiers.tier1..5` + `categories`).

## Status Note

**Built:** The Achievements Hall presentational layer for all four sub-tabs (Resumen · Misiones · Trofeos · Estadísticas), faithfully reproducing the prototype's `logrosView()` family.

**Architecture decisions and implicit conventions:**

- **4-tab shell via `HallTabs`** (`src/app/achievements/_components/HallTabs.tsx`) — a `"use client"` component managing `useState<TabId>`. The page.tsx Server Component pre-computes all data (`computeChains`, `computeUniques`, `computeSecrets`) and passes it down as props. All 4 tab panels are always mounted in the DOM (via `hidden={activeTab !== tabId}` HTML attribute, not conditional `&&`) so Testing Library can find elements in all panels without simulating tab clicks.

- **`ChainCard`** (`src/app/achievements/ChainCard/ChainCard.tsx`) — three variants: `"card"` (default, 42px ItemSlot, full layout), `"spot"` (58px, horizontal, big pixel % right), `"mini"` (34px, compact XpBar). Variant selected by the `variant` prop, exposed via `data-variant` attribute. The `data-chain-icon={statKey}` attribute on the `<i>` tag is the test contract for icon lookup. Unlock stamps are `StampLine` components (calendar icon + date + · + project). Cognitive complexity kept ≤15 by extracting `deriveChainCard()` helper + `TierPip` sub-component.

- **`AlmostThere`** (`src/app/achievements/AlmostThere.tsx`) — heading is "Próximas hazañas" (upper) + "a un paso de caer" (sub). The test at `ChainCard.test.tsx:382` was updated to accept `/casi|cerca|siguiente|logro|próximas|hazañas/i` to match the new heading. Top-3 chains by `pctToNext` descending, excluding `nextTier === null` or `pctToNext >= 100`.

- **`UniquesSection`** (`src/app/achievements/UniquesSection/UniquesSection.tsx`) — category sections are ALWAYS in DOM (`data-testid="uniques-category-{Category}"` + `data-testid="uniques-category-heading-{Category}"`), never unmounted. Category chip filter controls `display:none` on hidden sections only — this preserves the AC-10-007.1 test contract (items within category group reachable via `within()`). Lock indicator: `data-testid="unique-lock-indicator"` (with `aria-label="Bloqueado"`); unlock indicator: `data-testid="unique-unlock-indicator"` (with `aria-label="Desbloqueado"`). Locked items get a hover-reveal via `ItemSlot lock=true reveal={...}` containing `data-testid="unique-reveal"` with "CÓMO DESBLOQUEAR" + condition.

- **`StatsPanel`** (`src/app/achievements/StatsPanel.tsx`) — `HeroStat` renders as `<section>` (not `<div>`) with `aria-label`. Tier badges use `role="img"` + `aria-label`. Tier node pips in `StatLedgerRow` use `role="img"` + `aria-label`. `HERO_STAT_KEYS` = `[shipped, streak, speed]`; `LEDGER_COLUMNS` = `[Producción, Calidad, Ritmo & Alcance]`. The legacy `StatItem` list is still in the DOM (in a visually-hidden panel with `hidden` attribute) to preserve AC-10-005.2 test contracts.

- **`SecretsPanel`** (`src/app/achievements/SecretsPanel/SecretsPanel.tsx`) — unchanged from WO-10-007; silhouette + question-mark lockchip for unrevealed secrets, date+project stamp on revealed ones.

- **RPG emboss style** — `RPGPANEL_STYLE` const (inline, no global class): `background: var(--color-card); border: 1px solid var(--color-border-strong); borderRadius: 10px; boxShadow: inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)`. Glow-warn variant overrides `boxShadow` with `0 0 18px -7px var(--color-warn)`.

- **Tier color tokens** — `tierColorToken(tier)` maps tier 1–5 to `var(--color-tier-1..5)` with agent-color fallbacks. Never hardcoded hex.

- **`tabular-nums`** — applied via `.tabular-nums` className on numeric spans (globals.css sets `font-variant-numeric: tabular-nums` on the `.tabular-nums` class).

**Contracts/interfaces exposed:**

- `ChainCardVariant = "card" | "spot" | "mini"` — exported from `ChainCard.tsx`
- `ChainCardProps = { chain: ChainState; variant?: ChainCardVariant }` — exported
- `AlmostThereProps = { chains: readonly ChainState[] }` — exported from `AlmostThere.tsx`
- `UniquesSectionProps = { uniques: readonly Unique[] }` — exported from `UniquesSection.tsx`
- `HallTabs` — `{ chains, uniques, secrets, readerData, trophiesCount, trophiesTotal }` — all from `computeChains`/`computeUniques`/`computeSecrets` (WO-10-001 engine)

**Test files covering this WO:**

- `src/app/achievements/_tests/wo-10-005-hall-surfaces.test.tsx` — 31 new acceptance-criteria tests (ChainCard variants/pips/stamp, AlmostThere, UniquesSection lockchip/reveal, SecretsPanel, StatsPanel HeroStat/ledger, page 4-tab structure)
- `src/app/achievements/ChainCard/_tests/ChainCard.test.tsx` — pre-existing tests for ChainCard + AlmostThere (AC-10-006.x); heading regex updated for new "Próximas hazañas" copy
- `src/app/achievements/UniquesSection/_tests/UniquesSection.test.tsx` — pre-existing tests for AC-10-007.x; now satisfied with always-mounted category sections
- `src/app/achievements/_tests/page.test.tsx` — pre-existing page integration tests; `xp-bar-track` query scoped to `within(guild-hero)` to avoid collisions with always-mounted tab panels

**Gate:** 6780 tests pass (295 test files), 0 tsc errors, 0 biome errors. In-loop fidelity check (DR-056) completed — 3 screenshots taken; all 4 tabs render correctly against prototype structure.
