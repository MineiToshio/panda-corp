# Work orders — FRD-23 Materialized stats read-model

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Design: [`blueprint.md`](../blueprint.md). Platform: [`docs/product/architecture.md`](../../../product/architecture.md).
> Architecture decision: [`ADR-0004`](../../../adr/ADR-0004-materialized-stats-read-model.md).

Each work order targets ONE deploy unit, is testable in isolation, and follows TDD (RED → GREEN →
refactor). The gate is `.pandacorp/verify.sh` (biome → tsc → vitest). The DR-078 fail-loud fixtures
(real portada + malformed + stale + missing) and the DR-115 equivalence test are mandatory.

## List & order

| WO | Title | Layer | Depends on |
|---|---|---|---|
| WO-23-001 | Portada reader + seal + fail-loud fixtures (real / malformed / stale / missing) | `lib/` | — |
| WO-23-002 | Portada writer (single writer, atomic tmp+rename) + portada-vs-live equivalence test | `lib/` | WO-23-001 |
| WO-23-003 | Wire the Informe to read the portada/aggregate first, fall back to live git | `lib/`, `app/` | WO-23-001 |
| WO-23-004 | `sync-portfolio` aggregate index + Stop/`post-commit` regeneration + one-shot backfill | tooling | WO-23-002 |
| WO-23-005 | **SSOT split** — factory-scoped store + seal (writer/reader) + prune the per-project portada to per-project facts (DR-115) | `lib/` | WO-23-001, WO-23-002 |
| WO-23-006 | Recompose the Informe reader (per-project + factory-wide) with independent fail-loud fallback + cross-project staleness regression | `lib/`, `app/` | WO-23-003, WO-23-005 |

## Parallelization

- WO-23-001 has no intra-feature dependency → start here.
- WO-23-002 consumes the `StatsPortada` schema + seal from WO-23-001.
- WO-23-003 consumes the reader; WO-23-004 consumes the writer.
- **WO-23-005/006 (SSOT split, change `stats-ssot-split-factory-facts`)** are the DR-115 correction the
  FRD-23 gate surfaced: WO-23-005 builds the factory-scoped store and prunes the per-project portada;
  WO-23-006 recomposes the Informe reader and adds the cross-project staleness regression. WO-23-004's
  regeneration point (`sync-portfolio`) also writes the factory store (natural whole-factory walk).

## Cross-feature dependencies

- **FRD-10** WO-10-014 `src/lib/achievements/report/*` — the pure `derive*` cores the writer reuses
  (DR-092) and the live-git fallback path. Shipped.
- **FRD-21** `getPendingMerge` — stays live, explicitly NOT materialized (AC-23-005.1).
