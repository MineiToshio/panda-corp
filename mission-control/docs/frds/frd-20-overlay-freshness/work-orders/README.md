# Work orders — FRD-20 Project overlay freshness

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Design: [`blueprint.md`](../blueprint.md). Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

Each work order targets ONE deploy unit, is testable in isolation, and follows TDD (RED → GREEN →
refactor). The gate is `.pandacorp/verify.sh` (biome → tsc → vitest).

## List & order

| WO | Title | Layer | Depends on |
|---|---|---|---|
| WO-20-001 | `lib/overlay-freshness` reader + verdict (semver, defensive) with fixtures | `lib/` | — |
| WO-20-002 | `VersionFreshness` badge (Banner consumer) + wire into Resumen | `components/`, `app/` | WO-20-001, WO-13-007 |

## Parallelization

- WO-20-001 has no intra-feature dependency (only `lib/config.ts`, FRD-01) → start here.
- WO-20-002 consumes the verdict type from WO-20-001 and the shared `Banner` (FRD-13).

## Cross-feature dependencies

- **FRD-01** `lib/config.ts` (`resolveFactoryRoot`) and `lib/status.ts` (`ProjectStatus.overlayVersion`) — shipped.
- **FRD-13** shared `Banner` + `CmdRow` + `CopyButton` (DR-057) — consumed by WO-20-002, shipped.
- **FRD-04** `TabSummary` / `ProjectWorkspace` — the surface the badge is placed into.
