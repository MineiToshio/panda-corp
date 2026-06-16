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

```
WO-10-001 (lib/achievements: stats)   ─┐
WO-10-002 (lib/achievements: chains)  ─┤  parallel pure functions (over FRD-01/03/04/06 readers)
WO-10-003 (lib/achievements: uniques) ─┤
WO-10-004 (lib/achievements: secrets) ─┘
        │
        ▼
WO-10-005 (Hall page shell + hero + tabs + stats panel)  ← WO-10-001, FRD-09, FRD-13
        │
        ├─ WO-10-006 (chains + "Almost there")   ← WO-10-002, WO-10-005
        ├─ WO-10-007 (unique achievements)        ← WO-10-003, WO-10-005
        └─ WO-10-008 (secret achievements)        ← WO-10-004, WO-10-005
```

001–004 are parallel pure-function WOs. 006/007/008 are parallel once the page shell (005) and their
reader exist.

## Work orders
| ID | Title | Deploy unit | Depends on |
|---|---|---|---|
| WO-10-001 | `lib/achievements.ts` — stats (only-grow counters) | `lib/achievements.ts` (new) | FRD-01/03/04/06 |
| WO-10-002 | `lib/achievements.ts` — chains + endowed progress | `lib/achievements.ts` (new) | WO-10-001 |
| WO-10-003 | `lib/achievements.ts` — unique achievements | `lib/achievements.ts` (new) | FRD-01/04/06 |
| WO-10-004 | `lib/achievements.ts` — secret achievements | `lib/achievements.ts` (new) | FRD-01/04/06 |
| WO-10-005 | Hall page shell + hero + tabs + stats panel | `app/achievements/page.tsx` | WO-10-001, FRD-09, FRD-13 |
| WO-10-006 | Chains cards + "Almost there" | `components/hall/chains*` | WO-10-002, WO-10-005 |
| WO-10-007 | Unique achievements by category | `components/hall/uniques*` | WO-10-003, WO-10-005 |
| WO-10-008 | Secret achievements | `components/hall/secrets*` | WO-10-004, WO-10-005 |
</content>
