# Work orders — FRD-25 Persistent navigation URLs

> The authoritative order and parallelism is the **Build Plan** in `../blueprint.md` (the build engine reads
> that, not this). This file is the readable summary. The work order carries its own `implementation_status`
> frontmatter and copies in its acceptance criteria.
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> `../work-orders.md` (NAV-01 to NAV-04, the 2026-10-17 manual delivery slices) is kept as delivery history;
> the scripts ignore it and it is not a work order.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-25-001 | url-contract-v2 | PLANNED | — | The codec ships every v2 key and legacy alias, the active-destination rule and `useUrlSearch`; the oracle spec is split by family; the intermittent history failure of step 342 is investigated and fixed at its confirmed cause. |

> **Depends on** mirrors the work order's `dependsOn` frontmatter (DR-087).

## AC coverage

| AC | Work order |
|---|---|
| AC-25-001.1 | WO-25-001 |
| AC-25-002.1 | WO-25-001 |
| AC-25-003.1 | WO-25-001 |
| AC-25-004.1 | WO-25-001 |
| AC-25-005.1 | WO-25-001 |
| AC-25-006.1 | WO-25-001 |
| AC-25-007.1 | WO-25-001 |
| AC-25-008.1 | WO-25-001 |
| AC-25-009.1 | WO-25-001 |
| AC-25-010.1 | WO-25-001 |
| AC-25-011.1 | WO-25-001 |
| AC-25-012.1 | WO-25-001 |

## Build order

W0, no dependencies; it runs in parallel with WO-13-010, WO-22-001 and WO-02-019. Every surface work order
depends on it. Later writers of the files it creates: WO-03-007 (W4) and WO-04-010 (W5) edit steps of the
core spec; the family spec files are updated by the owners named in the work order (WO-02-016,
WO-02-018, WO-02-020, WO-07-006, WO-08-003, WO-10-016, WO-17-008, WO-19-002, WO-22-002, WO-04-010).

## Definition of done

- Tests first (RED, then GREEN); the repaired step passes ten isolated runs and three `verify.sh` runs.
- `.pandacorp/verify.sh` green: biome, `tsc --strict`, vitest, knip, madge, smoke, shell.
- The only writes are filesystem-read ones; no URL write ever runs a mutation; no new dependency.

## Superseded (v1 history)

None. FRD-25 had no work-order files in v1 (only the scope note `../work-orders.md`).
