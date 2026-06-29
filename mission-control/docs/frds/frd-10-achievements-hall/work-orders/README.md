# FRD-10 — Achievements Hall · work orders

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
See the [feature blueprint](../blueprint.md), the [platform architecture](../../../product/architecture.md)
and the design detail in [`docs/achievements.md`](../../../achievements.md).

TDD: RED → GREEN → refactor. The `lib/achievements.ts` derivation (stats/chains/uniques/secrets)
comes first; the Hall page/components consume it. **Honesty encoded as negative ACs.**

## Cross-feature dependencies
- **FRD-01** — `lib/ideas.ts`, `lib/status.ts` (+ `lib/config.ts`).
- **FRD-03** — `lib/portfolio.ts`.
- **FRD-04/06** — `lib/docs.ts`, `lib/events.ts`.
- **FRD-09** — `IF-09-guild-xp`, `CMP-09-xp-bar`, `CMP-09-avatar` (the hero + chain bars). The Hall
  page (WO-10-005) depends on FRD-09 WO-09-001/003/004.
- **FRD-13** — design tokens (incl. the 5 tier colors), `tabular-nums`.

## Order & parallelization

The `lib/achievements.ts` engine (WO-10-001) is **VERIFIED**. Phase 2 collapsed the four UI WOs (hall
page shell + chains + uniques + secrets) into **one coarse UI work order** (WO-10-005) re-anchoring the
Hall surfaces to the prototype — see the [blueprint Build Plan (Phase 2)](../blueprint.md#build-plan-phase-2).
The achievements page hero / `GuildBar` / radar are owned by **FRD-09 WO-09-003** (shared route).

```
WO-10-001 (lib/achievements: stats/chains/uniques/secrets)  VERIFIED
        │
        ▼
WO-10-005 (Hall surfaces: ChainCard + TrophyCard + AlmostThere + stat ledger)
              ← WO-10-001 (engine) + FRD-13 foundation + FRD-09 (shared page + XpBar)
```

## v2 — "La página épica" (2026-06-29)

Expansion to ~80 trophies (8 axes, per-trophy rarity), ~21 chains in sagas, ~18 secrets, **re-anchored
to the REAL event vocabulary** (`docs/achievements.md` §1). 4 coarse WOs, pipelined:

```
WO-10-009 (events reader extension: surface real enriched fields, fail-loud, uncapped achievements read)
        │
        ▼
WO-10-010 (signals layer: derive real-signal counters/flags → new stat keys)   ← WO-10-009
        │
        ▼
WO-10-011 (catalogue: 8 axes ~80 uniques + rarity, ~21 chains/sagas, ~18 secrets, Seals — re-anchored)
        │
        ▼
WO-10-012 (render: rarity gem + estimated rarity + NUEVO badge + new category icons + Seals shelf + sagas)
        │
        ▼
WO-10-013 (missions abundance: 19 chains/5 sagas + standardized mission/Trofeos/secrets cards — owner feedback)
```

All v2 work orders (WO-10-009 … WO-10-013) are **VERIFIED** (the Hall shipped 2026-06-29; visual
baseline re-blessed). WO-10-013 captures the post-review follow-up — see the decision log (2026-06-29).

## Work orders
| ID | Title | Deploy unit | Status | Depends on |
|---|---|---|---|---|
| WO-10-001 | `lib/achievements.ts` — engine (stats/chains/uniques/secrets) | `lib/achievements.ts` | VERIFIED | WO-01-003, WO-01-005, WO-01-007, WO-03-001 |
| WO-10-005 | Hall surfaces: ChainCard + TrophyCard + AlmostThere + stat ledger | `app/achievements/{ChainCard,UniquesSection}/**`, `AlmostThere.tsx`, `SecretsPanel.tsx` | VERIFIED | WO-10-001, WO-09-003, WO-13-006, WO-13-007, WO-13-008 |
| WO-10-006 | Rangos tab (enriched rank ladder) + unbounded Nv N metric levels (reconciled-from-code) | `app/achievements/RankLadder/**`, `_components/HallTabs.tsx`, `StatsPanel.tsx`, `lib/achievements/{achievements,tiers}.ts` | VERIFIED | WO-10-001, WO-10-005, WO-09-007 |
| WO-10-009 | Events reader extension: real enriched fields (verdict/result/reopenCount/blocking/important/agentType/effort/maxAgents/wos/reason), fail-loud, uncapped achievements read | `lib/events/events.ts` | VERIFIED | — |
| WO-10-010 | Signals layer: derive real-signal counters/flags + new chain stat keys | `lib/achievements/signals.ts`, `lib/achievements/stats.ts` | VERIFIED | WO-10-009 |
| WO-10-011 | Catalogue v2: 8 axes ~80 uniques + per-trophy rarity, ~21 chains/sagas, ~18 secrets, Seals — re-anchored to signals | `lib/achievements/{definitions,predicates,tiers,achievements}.ts` (split by axis as needed) | VERIFIED | WO-10-010 |
| WO-10-012 | Render v2: rarity gem + estimated rarity + NUEVO badge + 3 new category icons + Seals shelf + sagas grouping | `app/achievements/{UniquesSection,SecretsPanel,ChainCard,_components/HallTabs}.tsx` | VERIFIED | WO-10-011 |
| WO-10-013 | Missions abundance: 19 chains/5 sagas + standardized mission/Trofeos/secrets cards (node-ladder fix, uniform `ChainProgress`/`CardFooter`, calm Trofeos accent, uniform-height secrets) | `lib/achievements/{definitions,stats,achievements}.ts`, `app/achievements/{ChainCard,UniquesSection,SecretsPanel,_components/HallTabs,StatsPanel}.tsx` | VERIFIED | WO-10-012 |
</content>
