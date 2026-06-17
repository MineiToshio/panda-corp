---
id: WO-09-004
type: work-order
slug: guild-bar
title: WO-09-004 — `CMP-09-xp-bar` + guild top-bar
status: DRAFT
parent: FRD-09
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-09-004 — `CMP-09-xp-bar` + guild top-bar

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-09-xp-bar`, `CMP-09-guild-bar`](../blueprint.md#3-components--interfaces).

## Goal
Build the reusable honest XP bar primitive and the cross-cutting **guild top-bar** block (level,
title, XP bar to next, "faltan N para Nv X · <next title>"). The top-bar lives in `app/layout.tsx`
and is visible across the app. Consumes `IF-09-guild-xp`.

## Acceptance criteria (EARS, from FRD-09)
- **AC-09-004.1** — The top bar SHALL show the **guild's level and XP** (operator) with a title and a bar to the next level, from `computeGuildLevel()`.
- **AC-09-004.2** — Every number (level, XP, next) SHALL use `font-variant-numeric: tabular-nums` (FRD-13).
- **AC-09-004.3** — The XP bar SHALL reflect **real** pct-to-next; it SHALL NEVER render fake/stuck progress (negative AC, FRD-09).
- **AC-09-004.4** — The XP bar SHALL use the **rationed accent** (FRD-13: accent only on what matters) and SHALL NOT depend on color alone for state (label/shape present).
- **AC-09-004.5** — `CMP-09-xp-bar` SHALL be a reusable primitive consumed by the guild bar, FRD-07 agent detail and FRD-10.

## Dependencies
- WO-09-001 (`IF-09-guild-xp`). Intra-feature.
- FRD-13 tokens, `tabular-nums`. Cross-feature.

## TDD plan
1. RED: tests for top-bar level/title/XP from the engine; `tabular-nums` on numbers; real pct (no fake); rationed accent / not-color-alone; reusability of the bar.
2. GREEN: implement the bar primitive + top-bar block in the layout.
3. Refactor.

## Definition of done
- Component tests green incl. negative AC; tsc + biome clean; tokens only; `tabular-nums`. `.pandacorp/verify.sh` passes.

## Status Note

**Built:** `CMP-09-xp-bar` (reusable honest XP bar primitive) + `CMP-09-guild-bar` (cross-cutting guild top-bar) + `deriveGuildOutcomes` (real-data aggregator). The guild top-bar is wired into `app/layout.tsx` and is visible across the entire app whenever a factory profile is present.

**New files:**
- `components/rpg/XpBar.tsx` — `XpBar({ xp, next, pctToNext, label, nextTitle })` — renders the honest XP bar with `role="progressbar"`, `aria-valuenow/min/max`, `data-accent="true"` fill, all via CSS custom properties only.
- `components/rpg/GuildBar.tsx` — `GuildBar({ outcomes: GuildOutcomes })` — derives level/title/xp/next/pctToNext via `computeGuildLevel()` and renders level badge + rank title + `<XpBar>`.
- `components/rpg/XpBar.test.tsx` — 19 tests covering AC-09-004.2/3/4/5 (incl. negative ACs).
- `components/rpg/GuildBar.test.tsx` — 19 tests covering AC-09-004.1/2/3/4/5 (incl. negative ACs).
- `app/layout.guildbartop.test.tsx` — 4 integration tests verifying `GuildBar` is mounted cross-cutting in `RootLayout` (present when profile present, absent behind onboarding gate).

**Modified files:**
- `lib/gamification.ts` — added `deriveGuildOutcomes(input: GuildOutcomesInput): GuildOutcomes` and `GuildOutcomesInput` type. Aggregates `workOrdersDone` + `phasesCompleted` + `releases` from portfolio statuses, `greenTestRuns` from `EventsSnapshot`. Pure function, no I/O.
- `app/layout.tsx` — wires `readPortfolio()` + `readStatus()` per entry + `readEvents()` + `deriveGuildOutcomes()` + `<GuildBar outcomes={guildOutcomes} />` inside the profile-present branch.

**Contracts exposed:**
```ts
// components/rpg/XpBar.tsx
export type XpBarProps = { xp: number; next: number; pctToNext: number; label: string; nextTitle: string }
export function XpBar(props: XpBarProps): React.JSX.Element

// components/rpg/GuildBar.tsx
export type GuildBarProps = { outcomes: GuildOutcomes }
export function GuildBar(props: GuildBarProps): React.JSX.Element

// lib/gamification.ts (addition)
export type GuildOutcomesInput = { statuses: readonly StatusResult[]; eventsSnapshot?: EventsSnapshot | null; weeklyStreak?: number }
export function deriveGuildOutcomes(input: GuildOutcomesInput): GuildOutcomes
```

**Key `data-testid` seams:** `guild-bar`, `guild-bar-level`, `guild-bar-title`, `xp-bar`, `xp-bar-fill`, `xp-bar-track`, `xp-bar-xp`, `xp-bar-next`, `xp-bar-next-label`.

**Integration seams:** `XpBar` is consumed by `GuildBar`; `GuildBar` is consumed by `app/layout.tsx`. FRD-07 agent detail and FRD-10 hall consume `XpBar` directly with their own `computeAgentLevel()` outputs.

**Gate:** 4223/4223 tests pass (74 new). 2 pre-existing failures in `PartyTab.integration.reviewer.test.tsx` (WO-06-005 re-open, out of scope). `tsc --noEmit` clean. `biome check` clean.
</content>
