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

```
WO-09-001 (lib/gamification: guild XP engine)   ─┐  ← FRD-01 + FRD-06/12 readers
WO-09-002 (lib/gamification: agent XP engine)   ─┤  parallel pure functions
WO-09-005 (lib/gamification: celebration tiers) ─┘
        │
        ├─ WO-09-003 (CMP-09-avatar pixel-art component)   ← FRD-13  (independent, can start early)
        ├─ WO-09-004 (CMP-09-xp-bar + CMP-09-guild-bar top bar)  ← WO-09-001, FRD-13
        └─ WO-09-006 (CMP-09-celebration scaling surface)  ← WO-09-005, FRD-13
```

001/002/005 are parallel pure-function WOs. 003 (avatar) is independent (needs only FRD-13). 004 and
006 consume the engine + tokens.

## Work orders
| ID | Title | Deploy unit | Depends on |
|---|---|---|---|
| WO-09-001 | `lib/gamification.ts` — guild XP/level engine (honest) | `lib/gamification.ts` (new) | FRD-01, FRD-06/12 |
| WO-09-002 | `lib/gamification.ts` — agent XP/level engine | `lib/gamification.ts` (new) | FRD-06/12 |
| WO-09-003 | `CMP-09-avatar` pixel-art agent avatar | `components/rpg/Avatar*` | FRD-13 |
| WO-09-004 | `CMP-09-xp-bar` + guild top-bar | `components/rpg/*`, `app/layout.tsx` | WO-09-001, FRD-13 |
| WO-09-005 | `lib/gamification.ts` — celebration tier classifier | `lib/gamification.ts` (new) | FRD-06/12 |
| WO-09-006 | `CMP-09-celebration` scaling surface | `components/rpg/Celebration*` | WO-09-005, FRD-13 |
</content>
