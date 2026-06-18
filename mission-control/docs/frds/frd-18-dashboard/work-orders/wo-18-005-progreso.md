---
id: WO-18-005
type: work-order
slug: progreso
title: WO-18-005 — `Progreso` gamification strip
status: DRAFT
parent: FRD-18
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-18-005 — `Progreso` gamification strip

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-18-progress`) · FRD-09 (honest gamification).
> Visual reference: `prototype/index.html` `foot` strip (656–662).

## Goal
"Tu progreso": the honest gamification strip — guild level/XP, most recent achievement, next milestone,
all from real outcomes. No streaks, no false urgency (White-Hat, FRD-09).

## Scope
- `components/dashboard/progreso.tsx` — render level/XP (from FRD-09 derivation), the most recent
  achievement, and the next milestone with progress.

## Acceptance criteria (REQ-18-021)
- **AC-18-005.1** The strip shows guild level/XP, the most recent achievement, and the next milestone.
- **AC-18-005.2** All values derive from REAL outcomes (shipped, phases completed, lessons graduated) per
  FRD-09 — no synthetic/streak metric.
- **AC-18-005.3** No streaks and no false urgency (REQ-18-003 / FRD-09 White-Hat).
- **AC-18-005.4** Fresh factory (no achievements) → an honest "your first achievement awaits" state.
- **AC-18-005.5** `tabular-nums` on XP; Spanish + a11y.

## TDD
`progreso.test.tsx` with fixture FRD-09 data: with achievements + the fresh-factory empty case.

## Definition of done
- ACs RED → GREEN; real-outcome derived; no streaks; first-achievement state. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-09 gamification derivation (`lib/events` / `lib/status` → XP/achievements).

## Status Note

**What it built:** `CMP-18-progress` — the `Tu progreso` honest gamification strip for the FRD-18
dashboard page. Pure Server Component: accepts pre-computed FRD-09 data as props, renders guild
level/XP (via `XpBar`), most recent achievement, and next milestone. No I/O, no streaks, no false
urgency, no hardcoded colors.

**Files delivered:**
- `src/components/dashboard/Progreso/Progreso.tsx` — the strip component (Server Component)
- `src/components/dashboard/Progreso/_tests/Progreso.test.tsx` — 30 RED→GREEN tests

**Interfaces/contracts exposed:**
```tsx
import { Progreso } from "@/components/dashboard/Progreso/Progreso";
// ProgresoProps:
//   guildLevel: GuildLevel          — from computeGuildLevel(outcomes) (lib/gamification)
//   recentAchievement: Unique | null — most-recently-unlocked unique (null for fresh factory)
//   nextMilestone: ChainState | null — best-progress chain (null when all maxed or no chains)
```

**Integration seam for page assembly (WO-18-006):**
The parent page (dashboard route `/`) should:
1. Call `deriveGuildOutcomes({ statuses, eventsSnapshot })` → `computeGuildLevel(outcomes)` for `guildLevel`.
2. Call `computeUniques(readerData)` and sort by `date` descending to find `recentAchievement` (first with `unlocked: true`).
3. Call `computeStats(readerData)` → `computeChains(stats)` then pick the chain with `nextTier !== null` and highest `pctToNext` for `nextMilestone`.
4. Pass all three as props to `<Progreso />`.

**data-testid surface:**
- `progreso-strip` — root `<section>` (aria-label: "Tu progreso en el gremio")
- `progreso-recent-achievement` — achievement name span (shows "Tu primer logro te espera" for empty)
- `progreso-next-milestone` — next milestone span (shows "Cadenas al máximo" when all maxed)
- `progreso-guild-level` — level number span
- `progreso-guild-title` — rank title span
- `progreso-xp` — current XP number span (tabular-nums via globals.css)
- `xp-bar` / `xp-bar-track` (role=progressbar) — delegated to `XpBar` primitive

**Test files:** `src/components/dashboard/Progreso/_tests/Progreso.test.tsx`
(30 tests, 5 describe blocks covering AC-18-005.1 through AC-18-005.5 + integration seam)

**Gate:** 30/30 tests GREEN. `pnpm biome check` clean. `pnpm tsc --noEmit` no new errors.
Full suite: 230 files, 5857 tests passing. No regressions.
