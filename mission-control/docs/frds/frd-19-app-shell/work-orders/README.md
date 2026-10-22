# Work orders — FRD-19 Global app shell

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> The authoritative order and parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md)
> (the build engine reads that, not this). Each WO is a coarse slice, carries its own
> `implementation_status` frontmatter and copies in the acceptance criteria it owns.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-19-002 | appshell-frame-navigation | PLANNED | WO-13-012, WO-25-001, WO-01-008 | The Órbita shell on every route: sidebar, tablet rail, phone top bar, bottom navigation and drawer, skip link, 1180 px frame, seven destinations with one active, no exempt route, `e2e/shell.ts` and `e2e/routes.ts` (foundation, W3) |
| WO-19-003 | sidebar-contents | PLANNED | WO-19-002, WO-18-002, WO-17-008, WO-21-003, WO-04-013 | Sidebar contents: Proyectos group, counts and rail dot, collapse to the 64 px rail with float, theme button, guild card, plugin and pending pills, gold achievement notice (W6) |

> **Depends on** mirrors each WO's `dependsOn` frontmatter (DR-087).

## Build order

- **W3:** WO-19-002, the last foundation step, in parallel with the W3 surface work orders (disjoint
  files). From here every route renders the sidebar with the seven destinations.
- **W6:** WO-19-003, once the resolvers it shows exist (Inicio owner items WO-18-002, Propuestas actions
  WO-17-008, worktrees WO-21-003, resolved-in-file decisions WO-04-013), in parallel with the W6 panel
  work orders.
- FRD-19's gate runs after WO-19-003. FRD-13's WO-13-013 (W7) deletes the v1 modules this FRD only
  unmounted.

## AC coverage

| AC | Work order |
|---|---|
| AC-19-001.1 | WO-19-002 |
| AC-19-001.2 | WO-19-002 |
| AC-19-001.3 | WO-19-002 |
| AC-19-001.4 | WO-19-002 |
| AC-19-001.5 | WO-19-002 |
| AC-19-002.1 | WO-19-002 |
| AC-19-002.2 | WO-19-002 |
| AC-19-003.1 | WO-19-002 |
| AC-19-003.2 | WO-19-002 |
| AC-19-003.3 | WO-19-002 |
| AC-19-003.4 | WO-19-002 |
| AC-19-003.5 | WO-19-002 |
| AC-19-004.1 | WO-19-002 |
| AC-19-004.2 | WO-19-002 |
| AC-19-005.1 | WO-19-003 |
| AC-19-005.2 | WO-19-003 |
| AC-19-005.3 | WO-19-003 |
| AC-19-005.4 | WO-19-002 |
| AC-19-005.5 | WO-19-003 |

Cross-FRD ACs built here (listed in their own FRD's README): AC-09-008.1, AC-09-008.2 (FRD-09),
AC-15-006.1 (FRD-15), AC-21-008.1, AC-21-008.2 (FRD-21), all owned by WO-19-003.

## Superseded (v1 history)

- WO-19-001 (global app shell, v1 top bar) → WO-19-002, WO-19-003
