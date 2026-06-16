# Work orders — FRD-15 Plugin out-of-sync warning

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Design: [`blueprint.md`](../blueprint.md). Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

Each work order targets ONE deploy unit, is testable in isolation, and follows TDD (RED → GREEN →
refactor). The gate is `.pandacorp/verify.sh` (biome → tsc → vitest).

## List & order

| WO | Title | Layer | Depends on |
|---|---|---|---|
| WO-15-001 | `lib/plugin-sync` readers (SHA, dirty) with fixtures | `lib/` | `lib/config.ts` (FRD-01, shipped) |
| WO-15-002 | `getPluginSyncState` verdict (drift/reason/detail) | `lib/` | WO-15-001 |
| WO-15-003 | `app/api/plugin-sync` route handler | `app/api/` | WO-15-002 |
| WO-15-004 | `PluginSyncBanner` client component (poll + self-clear) | `components/` | WO-15-003 |

## Parallelization

- WO-15-001 has no intra-feature dependency (only `lib/config.ts`, already shipped in FRD-01) → start here.
- WO-15-002 → WO-15-003 → WO-15-004 form a chain (data verdict → route → UI).
- WO-15-001 and the readers' fixtures can be authored independently of any other feature.

## Cross-feature dependencies

- **FRD-01** `lib/config.ts` (`resolveFactoryRoot`, `PANDACORP_FACTORY_ROOT`) — already shipped.
- **FRD-02** `CopyButton` shared component — consumed by WO-15-004. If not yet available, WO-15-004
  renders the command with a minimal inline copy and is upgraded when `CopyButton` lands (note it).
- **FRD-18** composes/places this banner in the dashboard health-banner stack; FRD-15 only owns and
  exports the component + its data — placement is FRD-18's WO.
