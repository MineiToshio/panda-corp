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

## Work orders
| ID | Title | Deploy unit | Status | Depends on |
|---|---|---|---|---|
| WO-10-001 | `lib/achievements.ts` — engine (stats/chains/uniques/secrets) | `lib/achievements.ts` | VERIFIED | WO-01-003, WO-01-005, WO-01-007, WO-03-001 |
| WO-10-005 | Hall surfaces: ChainCard + TrophyCard + AlmostThere + stat ledger | `app/achievements/{ChainCard,UniquesSection}/**`, `AlmostThere.tsx`, `SecretsPanel.tsx` | PLANNED | WO-10-001, WO-09-003, WO-13-006, WO-13-007, WO-13-008 |
</content>
