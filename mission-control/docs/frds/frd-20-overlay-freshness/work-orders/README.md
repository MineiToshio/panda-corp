# Work orders — FRD-20 Project overlay freshness

> The authoritative order is the **Build Plan** in [`../blueprint.md`](../blueprint.md). Source-of-truth
> hierarchy: `FRD > FDD > design-tokens > blueprint > work order`. Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| [WO-20-001](./wo-20-001-freshness-verdict.md) | freshness-verdict | VERIFIED | — | History, kept live: `src/lib/overlay-freshness` reader and semver verdict (defensive, never throws). |

> **Depends on** mirrors each work order's `dependsOn` frontmatter. The v2 upgrade notice is built by FRD-04's
> WO-04-011 (folded, DR-100), which owns every FRD-20 acceptance criterion.

## AC coverage

| AC | Work order |
|---|---|
| AC-20-001.1 | WO-04-011 |
| AC-20-001.2 | WO-04-011 |
| AC-20-001.3 | WO-04-011 |
| AC-20-002.1 | WO-04-011 |
| AC-20-002.2 | WO-04-011 |
| AC-20-004.1 | WO-04-011 |

## Build order

1. W0: WO-20-001 (VERIFIED history).
2. W6: FRD-04's WO-04-011 renders the notice at the top of the Resumen.

## Superseded (v1 history)

- WO-20-002 — `VersionFreshness` badge (Banner consumer) + wire into Resumen. Superseded by WO-04-011.
