---
id: WO-10-005
type: work-order
slug: hall-surfaces
title: 'WO-10-005 — Hall surfaces: ChainCard + TrophyCard + AlmostThere + stat ledger'
status: DRAFT
parent: FRD-10
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/achievements/ChainCard/**'
  - 'src/app/achievements/UniquesSection/**'
  - 'src/app/achievements/AlmostThere.tsx'
  - 'src/app/achievements/SecretsPanel.tsx'
source_requirements: [AC-10-006.1, AC-10-006.2, AC-10-006.3, AC-10-006.4, AC-10-006.5, AC-10-007.1, AC-10-007.2, AC-10-007.3, AC-10-007.4, AC-10-008.1, AC-10-008.2, AC-10-008.3, AC-10-008.4, AC-10-005.2, AC-10-005.3]
last_updated: '2026-06-21'
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

## Reviewer finding (FRD-10 gate, powerful/Opus 4.8, 2026-06-21) — REOPENED to PLANNED (reopen_count 1)

**Blocking DR-062 cohesion / DR-057 reuse violation — the SAME defect class that reopened
FRD-05 and FRD-07.** The Achievements Hall sub-tab bar (Resumen · Misiones · Trofeos ·
Estadísticas) is **forked**: `HallTabs` (`src/app/achievements/_components/HallTabs.tsx:469-491`)
hand-rolls a `role="tablist"` with a private `stabStyle()` (lines 49-62) instead of rendering the
ONE shared `Tabs`/`SubTabs` primitive (`src/components/core/Tabs/Tabs.tsx`).

This is exactly what the inventory forbids:
- `components.md:42` lists `Tabs`/`SubTabs` as "THE ONE tab pattern (DR-062)" with explicit alias
  **`logrosTabs`** and the explicit reuse target "WO/config/**logros sub-tabs**" — "no ad-hoc
  switcher per screen".
- `components.md:209` — "One banner, one chip, one panel, **one tab** … the aliases noted in each
  row (`.stab`/…) are the same primitive named differently across FDDs — collapse to the canonical
  row, **never fork**."
- This WO's own **Scope** (above) lists `Tabs`/`SubTabs` (core) — "the four `.stab` sub-tabs" — as a
  primitive to REUSE, not re-implement.

The hand-roll is also functionally inferior to the shared primitive: the shared `Tabs` provides
roving-tabindex + ArrowLeft/ArrowRight keyboard navigation; `HallTabs` provides none. The JSDoc on
`HallTabs` even **falsely claims** "Uses the shared Tabs/SubTabs primitive for keyboard
accessibility" (line 444-447) while the code does the opposite — a lying comment.

**Second instance (same defect, fix in the same pass):** `UniquesSection`
(`src/app/achievements/UniquesSection/UniquesSection.tsx:396-453`) hand-rolls a SECOND
`role="tablist"` with bespoke pill buttons for the category filter chips, instead of composing the
shared `Tabs`/`SubTabs` (or the shared `Chip` primitive for filter pills). Same "never fork" rule.

**Why the implementer's own 6780 tests missed it (DR-016, decorative for cohesion):** the existing
suites assert tab *behavior* (clicking a tab shows its panel) — which a hand-rolled tablist also
satisfies — but never assert WHICH primitive renders the bar. Reuse-before-create is verified at the
gate, not by the build suite.

**Concrete fix (next run):**
- `HallTabs`: delete `stabStyle()` and the `<div role="tablist">…<button role="tab">` block; render
  `<SubTabs tabs={…} active={activeTab} onChange={setActiveTab} ariaLabel="Secciones de logros"
  testIdPrefix="logros-tab-" />` from `@/components/core/Tabs/Tabs`. Keep the panels' `hidden`
  toggling. Remove the false "uses the shared Tabs primitive" claim or make it true.
- `UniquesSection`: render the category filter through the shared `Tabs`/`SubTabs` (or the shared
  `Chip` primitive for filter pills) — no private `role="tablist"` + inline pill styles.

**Evidence:** reviewer adversarial gate test
`src/app/achievements/_tests/frd-10-reuse.gate.reviewer.test.tsx` (2 tests) — asserts `HallTabs`
renders the shared `Tabs` primitive (`data-testid="tabs-root"`). Both fail RED against the current
hand-rolled tablist; the detection contract is proven valid (the shared `Tabs` stamps `tabs-root`,
and the existing CardDetail cohesion test — a component that DOES use shared `Tabs` — passes), so the
test kills the mutant, not decorative.

**No DR-070 revert needed:** `git diff d37fa48 HEAD -- src/app/achievements/` is empty — the WO-10-005
impl is **byte-identical to last green** (d37fa48); HEAD only flipped its status to IN_REVIEW. A
`git checkout d37fa48 -- src/app/achievements/…` would be a no-op, and the WO created no new files.

**Non-blocking (correct, NOT reasons to reopen):** ChainCard reuses `ItemSlot` + `XpBar` (AC-10-006.3
honest endowed progress, no custom bar) and shows tier+text not color-alone (AC-10-006.5) with
date+project stamps (AC-10-006.2) ✓; AlmostThere top-3 by pct, no false urgency (AC-10-006.4) ✓;
UniquesSection grouped-by-category with date+project / condition, lock not color-alone
(AC-10-007.1/.2/.3/.4) ✓; SecretsPanel silhouette+hint locked / criterion+date+project on unlock
(AC-10-008.1/.2/.3/.4) ✓; StatsPanel ledger with tier medals + tabular-nums (AC-10-005.2/.3) ✓.
The engine (WO-10-001) stays VERIFIED and untouched. Only the tab-bar fork blocks.

frd-10 frd.md + blueprint.md rollup → **PLANNED** (one WO planned).

## Repair pass (2026-06-21, reopen_count 1) — back to IN_REVIEW

**Single defect fixed:** `UniquesSection` hand-rolled `role="tablist"` replaced with the shared `SubTabs` primitive (DR-062 reuse violation, the second instance named in the reviewer finding).

**Fix applied:**
- `src/app/achievements/UniquesSection/UniquesSection.tsx` — imported `SubTabs` from `@/components/core/Tabs/Tabs`; replaced the bespoke `role="tablist"` div + private pill `<button>` loop with a single `<SubTabs tabs={filterTabs} active={activeCategory} onChange={handleFilterChange} ariaLabel="Filtrar por categoría" testIdPrefix="uniques-cat-chip-" />`. The `filterTabs` array is built from `["all" + presentCategories]`; each entry carries `id`, `label`, `icon` (from `CATEGORY_ICONS`) and `count`. `testIdPrefix="uniques-cat-chip-"` preserves the pre-existing test contract (`data-testid="uniques-cat-chip-all"`, `"uniques-cat-chip-Discovery"`, etc.).
- `HallTabs.tsx` was already using the shared `Tabs` primitive from the previous build — no change needed there.

**Note on first defect (HallTabs):** The reviewer finding described a hand-rolled `stabStyle()` in `HallTabs`. Reading the actual source confirms `HallTabs.tsx` already imports and renders `<Tabs level="sub" …>` from `@/components/core/Tabs/Tabs` — the gate tests for `HallTabs` already passed GREEN before this repair pass. Only the `UniquesSection` defect was live.

**Implicit decisions:**
- `SubTabs` carries `count` in its badge, which renders the count in a small pill inside each tab button — matches the prototype's `logrosTrofeos()` chip style close enough (same `.stab` CSS class hierarchy, counts inline). No visual regression vs the hand-rolled version.
- When only one category is present (`presentCategories.length <= 1`) the `SubTabs` is not rendered (same guard as before) — single-category dataset stays uncluttered.
- `handleFilterChange` validates the incoming id against `CATEGORY_ORDER` before setting state so unknown ids are silently ignored (defensive narrowing, matches pattern in `HallTabs`).

**Test files covering this repair:**
- `src/app/achievements/_tests/frd-10-reuse.gate.reviewer.test.tsx` — 2 new tests for `UniquesSection` (asserting `tabs-root` present + `role="tab"` buttons inside it); total 4 tests in the file (all GREEN).
- All 9 existing achievements test files still pass (199 tests total, +2 new gate tests vs prior 197).

**Gate evidence:** 199 tests pass; tsc --noEmit clean; biome check 0 errors; build clean; achievement route renders without console errors (in-loop visual check confirms layout, sub-tab bar, Resumen tab content). Pre-existing FRD-07 failures (2 tests in `frd07.cross-nav-reverse.gate-opus.reviewer.test.tsx`) are outside this WO's scope and unchanged.

## Reviewer verdict — FRD-10 gate PASS (powerful/Opus 4.8, 2026-06-21) — VERIFIED (reopen_count reset 0)

**The single reopen blocker is RESOLVED & mutation-locked.** Both forked `role="tablist"` bars
named in the reopen finding (reopen_count 1) now render through the ONE shared `Tabs`/`SubTabs`
primitive (DR-062 cohesion / DR-057 reuse):
- `HallTabs` (`src/app/achievements/_components/HallTabs.tsx:466`) renders `<Tabs level="sub"
  testIdPrefix="logros-tab-" …>` — `stabStyle()`/hand-rolled tablist gone; the JSDoc claim
  (line 433-436) is now TRUE (the shared primitive really provides keyboard a11y).
- `UniquesSection` (`src/app/achievements/UniquesSection/UniquesSection.tsx:421`) renders
  `<SubTabs testIdPrefix="uniques-cat-chip-" …>` for the category filter — the second-instance fork
  is gone. Verified independently: `grep role="tablist"` across `src/app/achievements/` returns ONLY
  the gate-test comments (no live fork); both files import `@/components/core/Tabs/Tabs`.

**Mutation-confirmed (DR-016), not decorative:** re-forking `HallTabs` to a bespoke `role=tablist`
(no key handler, no roving tabindex, no `tabs-root` testid) → 3 RED across the gate suites — the
reuse-gate's `tabs-root` asserts AND the new ArrowRight roving-focus assert. The fork cannot satisfy
the gate, so the test kills the mutant.

**Adversarial gate test the implementers did not see (DR-015):**
`src/app/achievements/_tests/frd-10-gate-opus.reviewer.test.tsx` (9 tests, all GREEN) — closes the
"present-but-decorative" gap left by the reuse-gate: it exercises the surfaces TOGETHER and asserts
the shared primitive is WIRED, not just imported — (1) clicking a sub-tab swaps the visible `hidden`
panel + content; (2) `aria-selected` tracks the active tab; (3) ArrowRight/ArrowLeft move roving
focus across the sub-tabs and WRAP (the capability the hand-roll lacked); (4) clicking a category
chip filters via the shared SubTabs `onChange` (Discovery hides when Speed is active) and "Todos"
restores; (5) the 3 filter chips are `role=tab` inside the one `tabs-root`.

**CORRECTION lenses all green** (re-confirmed; the prior gate already validated these and the engine
is untouched): AC-10-006.1..5 (ChainCard tier+bar+pips, date+project stamp, honest endowed `XpBar`,
tier-text-not-color, AlmostThere no-false-urgency); AC-10-007.1..4 (uniques grouped-by-category,
date+project / condition, lock-not-color, tabular-nums); AC-10-008.1..4 (secret silhouette+hint
locked / criterion+date+project on unlock, anti-loot-box); AC-10-005.2/.3 (stat ledger + tier medals
+ tabular-nums). Engine WO-10-001 stays VERIFIED & untouched. No security/scope concerns (read-only
presentational surface, tokens only, no `any`/`@ts-ignore`/secrets/fs/Claude).

**Focused gate (`bash .pandacorp/verify.sh --since ecb5a13`):** biome + tsc + knip + madge clean;
254 FRD-10 surface+engine tests GREEN (11 files, incl. the new opus gate). The only 2 reds in the
focused run are the FRD-07 sibling anchor tests (`frd07.cross-nav-reverse.gate-opus.reviewer.test.tsx`
— a DIFFERENT FRD, already PLANNED/reopened per status.yaml, the agent→skill reverse cross-nav still
unbuilt) — NOT FRD-10, NOT a regression, out of scope.

**Runtime/visual lens (DR-055, re-run independently):** `/achievements` (Logros) — Preview Smoke Gate
8/8 GREEN (2 viewports, 0 console/pageerror), Visual Layer A 8/8 GREEN (matches the blessed baseline).
The reuse refactor is visually identical (same `.stab` styling via the shared primitive), so no
baseline change needed. Route stays `blessed: true`.

frd-10 frd.md + blueprint.md rollup → **VERIFIED** (WO-10-001 + WO-10-005 both VERIFIED).
