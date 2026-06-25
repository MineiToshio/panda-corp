# Work orders — FRD-16 Orphan project detection

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Design: [`blueprint.md`](../blueprint.md). Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

TDD per WO (RED → GREEN → refactor). Gate: `.pandacorp/verify.sh` (biome → tsc → vitest).

## List & order

| WO | Title | Layer | Depends on |
|---|---|---|---|
| WO-16-001 | `lib/orphans` scan: projects path + bounded folder listing | `lib/` | WO-01-002 |
| WO-16-002 | `lib/orphans` classification + `getOrphans` verdict | `lib/` | WO-16-001 |
| WO-16-003 | `app/api/orphans` route handler | `app/api/` | WO-16-002 |
| WO-16-004 | `OrphansBanner` client component (dismiss + self-clear) | `components/` | WO-16-003, WO-13-007, WO-13-006 |

## Parallelization

- WO-16-001 depends only on shipped FRD-01 readers → start here.
- WO-16-002 → WO-16-003 → WO-16-004 chain (verdict → route → UI).
- This whole feature is independent of FRD-15 (no shared module) and can run in parallel with it.

## Cross-feature dependencies

- **FRD-01** `lib/config.ts`, `lib/profile.ts` (`projects_path`), `lib/portfolio.ts` (registered
  paths) — already shipped.
- **FRD-02** `CopyButton` — consumed by WO-16-004 (fallback inline copy if not yet available).
- **FRD-18** composes/places this banner in the dashboard health-banner stack.
