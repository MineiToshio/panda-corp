# Work orders — FRD-26 Services and account directory

> The authoritative order and parallelism is the **Build Plan** in `../blueprint.md` (the build engine reads
> that, not this). This file is the readable summary. The work order carries its own `implementation_status`
> frontmatter and copies in its acceptance criteria.
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> `../work-orders.md` (SVC-01 to SVC-04, the 2026-10-20 attended delivery slices) is kept as delivery
> history; the scripts ignore it and it is not a work order.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-26-001 | cuentas | PLANNED | WO-13-012, WO-25-001 | The project Cuentas table and the global Cuentas directory (search, state chips, row dialog, bounded invalid-source notice), with the reader's issue codes aligned to the design. |

> **Depends on** mirrors the work order's `dependsOn` frontmatter (DR-087). WO-25-001 is added to the map's
> `[WO-13-012]` because the work order uses its URL keys and `useUrlSearch`.

## AC coverage

| AC | Work order |
|---|---|
| AC-26-001.1 | WO-26-001 |
| AC-26-002.1 | WO-26-001 |
| AC-26-003.1 | WO-26-001 |
| AC-26-004.1 | WO-26-001 |
| AC-26-005.1 | WO-26-001 |
| AC-26-006.1 | WO-26-001 |
| AC-26-007.1 | WO-26-001 |
| AC-26-008.1 | WO-26-001 |
| AC-26-009.1 | WO-26-001 |
| AC-26-010.1 | WO-26-001 |
| AC-26-011.1 | WO-26-001 |

## Build order

W3 (after WO-13-012 and WO-25-001). It runs in parallel with the other W3 surface work orders (disjoint
artifacts). Consumers: WO-03-007 (W4, mounts `AccountsDirectory` in Portafolio and deletes
`PortfolioViews.tsx`) and WO-04-010 (W5, mounts `ProjectAccounts` in the workspace Cuentas panel).

## Definition of done

- Tests first (RED, then GREEN); `.pandacorp/verify.sh` green: biome, `tsc --strict`, vitest, knip, madge.
- Read-only: no cloud API call, no registry write; only the whitelisted DTO reaches the browser.
- The built screens match the FDD mocks on the frozen tokens in light and dark, at 375, 768 and 1280.

## Superseded (v1 history)

None. FRD-26 had no work-order files in v1 (only the scope note `../work-orders.md`).
