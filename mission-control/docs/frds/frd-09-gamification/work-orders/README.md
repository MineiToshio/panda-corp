# FRD-09 — Gamification (RPG theme) · work orders

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
See the [feature blueprint](../blueprint.md) and the [platform architecture](../../../product/architecture.md).

TDD: RED → GREEN → refactor. The XP engine (pure derivation) comes first; the cross-cutting UI
(top bar, celebration) consumes it. **Honesty is encoded as negative acceptance criteria** — tests
that forbidden patterns are absent.

## Cross-feature dependencies
- **FRD-01** — `lib/status.ts` (`work_orders_done`, `phase`, …) + `lib/config.ts` foundation.
- **FRD-06/12** — `lib/events.ts` (event stream: `test_ok`, `achievement`, `work_order`, `agent`).
- **FRD-13** — design tokens, `tabular-nums`, motion rules, `prefers-reduced-motion`.

## Consumers (downstream)
- **FRD-07** consumes `IF-09-agent-xp` + `CMP-09-avatar` (agents section). FRD-07 WO-07-007 depends
  on WO-09-002 + WO-09-003 here.
- **FRD-10** consumes `IF-09-guild-xp` + `CMP-09-xp-bar` (the Hall hero). FRD-10 depends on
  WO-09-001 + WO-09-004.

## Order & parallelization

The pure XP/celebration engine (001/002/005) is **VERIFIED**. Phase 2 collapsed the three UI WOs
(avatar + xp-bar/guild-bar + celebration-surface) into **one coarse UI work order** (WO-09-003) that
re-anchors all the Guild presentational surfaces to the prototype — see the [blueprint Build Plan
(Phase 2)](../blueprint.md#build-plan-phase-2).

```
WO-09-001 (lib/gamification: guild XP engine)   ─┐  VERIFIED
WO-09-002 (lib/gamification: agent XP engine)   ─┤  pure functions
WO-09-005 (lib/gamification: celebration tiers) ─┘
        │
        └─ WO-09-003 (Guild surfaces: GuildBar + GuildHero + StatRadar + CelebrationSurface)
                       ← WO-09-001 + WO-09-005 (engine) + FRD-13 foundation
```

## Work orders
| ID | Title | Deploy unit | Status | Depends on |
|---|---|---|---|---|
| WO-09-001 | `lib/gamification.ts` — guild XP/level engine (honest) | `lib/gamification.ts` | VERIFIED | WO-01-005, WO-06-012 |
| WO-09-002 | `lib/gamification.ts` — agent XP/level engine | `lib/gamification.ts` | VERIFIED | WO-06-012 |
| WO-09-003 | Guild surfaces: GuildBar + GuildHero + StatRadar + CelebrationSurface | `app/achievements/page.tsx`, `components/modules/GuildBar/**`, `app/achievements/StatsPanel.tsx`, core RPG primitives | VERIFIED | WO-09-001, WO-09-005, WO-09-002, WO-01-007, WO-01-005, WO-03-001, WO-01-009, WO-13-006, WO-13-007, WO-13-008 |
| WO-09-005 | `lib/gamification.ts` — celebration tier classifier | `lib/gamification.ts` | VERIFIED | WO-06-012 |
| WO-09-006 | Gamification ledger: persistent XP accumulator | `lib/gamification/ledger.ts`, `app/_actions/snapshotLedger.ts`, `components/dashboard/GamificationLedgerSync/` | PLANNED | WO-09-001 |
| WO-09-007 | Rank ladder: 40 ranks, granular level + band model, custom emblems (reconciled-from-code) | `lib/gamification/gamification.ts`, `components/core/RankEmblem/**`, `components/modules/{GuildBar,GuildHero}/**`, `public/ranks/*.png` | VERIFIED | WO-09-001, WO-09-003 |
</content>
