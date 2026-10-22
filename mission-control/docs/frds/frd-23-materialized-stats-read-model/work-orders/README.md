# Work orders — FRD-23 Materialized stats read-model

> The authoritative order and parallelism is the **Build Plan** in `../blueprint.md` (the build engine reads that, not this). This file is the readable summary. Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`. Platform: [`docs/product/architecture.md`](../../../product/architecture.md). Architecture decision: [`ADR-0004`](../../../adr/ADR-0004-materialized-stats-read-model.md).

All six work orders are VERIFIED history kept live (a pure `lib` package, no UI). Each follows TDD (RED, GREEN, refactor); the DR-078 fail-loud fixtures (real portada, malformed, stale, missing) and the DR-115 equivalence test are mandatory. v2 changes none of their behaviour; it only narrows their declared artifacts so each wave is verifiably disjoint.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-23-001 | portada-reader-seal | VERIFIED | — | Portada reader, freshness seal and fail-loud fixtures (real, malformed, stale, missing). |
| WO-23-002 | portada-writer | VERIFIED | WO-23-001 | Portada writer: single writer, atomic tmp + rename, portada-versus-live equivalence. |
| WO-23-003 | informe-wiring-fallback | VERIFIED | WO-23-001 | Wire the Informe to read the portada first and fall back to live git; `getPendingMerge` stays live. |
| WO-23-004 | aggregate-regen-backfill | VERIFIED | WO-23-002 | O(1) aggregate index, commit-driven regeneration, one-shot backfill. |
| WO-23-005 | factory-store-split | VERIFIED | WO-23-001, WO-23-002 | Factory-scoped store and seal (writer and reader); prune the per-project portada (SSOT split, DR-115). |
| WO-23-006 | informe-composed-reader | VERIFIED | WO-23-003, WO-23-005 | Recompose the Informe reader with independent fail-loud fallback per scope; seal-coverage rule (AC-23-001.5) proven here. |

> **Depends on** mirrors each work order's `dependsOn` frontmatter.

## AC coverage

| AC | Work order |
|---|---|
| AC-23-001.1 | WO-23-001 |
| AC-23-001.2 | WO-23-001 |
| AC-23-001.3 | WO-23-001 |
| AC-23-001.4 | WO-23-001 |
| AC-23-001.5 | WO-23-006 |
| AC-23-002.1 | WO-23-002 |
| AC-23-002.2 | WO-23-002 |
| AC-23-002.3 | WO-23-002 |
| AC-23-003.1 | WO-23-004 |
| AC-23-003.2 | WO-23-004 |
| AC-23-004.1 | WO-23-004 |
| AC-23-005.1 | WO-23-003 |
| AC-23-006.1 | WO-23-005 |
| AC-23-006.2 | WO-23-005 |
| AC-23-006.3 | WO-23-005 |
| AC-23-006.4 | WO-23-005 |
| AC-23-007.1 | WO-23-006 |
| AC-23-007.2 | WO-23-006 |
| AC-23-007.3 | WO-23-006 |

## Build order

1. W0: WO-23-001. W1: WO-23-002 and WO-23-003 (siblings, disjoint files). W2: WO-23-004 and WO-23-005 (siblings, disjoint files). W3: WO-23-006.
2. Consumers after this FRD: FRD-10 WO-10-016 (W4, it writes the same `src/app/achievements/page.tsx` last), WO-10-017 (W6, through the statistics loader), FRD-01 WO-01-011 (W5, adopts the clock and git seams in these readers).

## Cross-feature dependencies

- **FRD-10** WO-10-014 `src/lib/achievements/report/*`: the pure `derive*` cores the writers reuse (DR-092) and the live-git fallback. Shipped, imported not edited.
- **FRD-21** `getPendingMerge`: stays live, explicitly not materialized (AC-23-005.1).

## Superseded (v1 history)

None.
