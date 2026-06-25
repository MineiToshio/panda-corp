# Work orders — FRD-19 Global app shell

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Design: [`blueprint.md`](../blueprint.md). Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

TDD per WO (RED → GREEN → refactor). Gate: `.pandacorp/verify.sh` (structure → biome → tsc → vitest →
knip → smoke/visual/**shell**) + the Shell-Presence Gate (`e2e/shell.spec.ts`, DR-075).

## List & order

One coarse **foundation** work order — the global shell is infrastructure every top-level surface
renders inside, so it is foundation-first.

| WO | Title | Layer | foundation | Depends on |
|---|---|---|---|---|
| WO-19-001 | Global app shell — persistent topbar nav + active state + responsive drawer + gate seed | UI (foundation) | **yes** | WO-13-006, WO-13-008, WO-09-001, WO-17-004, WO-01-008, WO-01-007, WO-01-005, WO-01-004, WO-01-002 |

## Parallelization
- WO-19-001 is a single cohesive unit (the shell is one assembly); no intra-FRD parallelism. It reuses
  already-VERIFIED primitives and wires the root layout — built and gate-verified as one.

## Cross-feature dependencies
- **FRD-09** `GuildBar` (extended with an `embedded` variant) + `XpBar` — the brand/level/XP block.
- **FRD-17** `ProposalsBadge` — the Propuestas destination + open-count badge.
- **FRD-13** the `.tab` pill visual (`Tabs.topTabStyle`), the `Panel`/`rpgpanel` surface signature,
  design tokens, WCAG — reuse-before-create; the new `Nav` replicates the `.tab` look as real links.
- The six destinations (`/`, `/board`, `/portfolio`, `/proposals`, `/achievements`, `/manual`) are
  already-built surfaces; this WO only adds the persistent shell that links them.
