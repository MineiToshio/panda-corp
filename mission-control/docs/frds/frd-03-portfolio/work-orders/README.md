# Work orders — FRD-03 Portfolio and project navigation

> The authoritative order and parallelism is the **Build Plan** in `../blueprint.md` (the build engine reads
> that, not this). This file is the readable summary. The work order carries its own `implementation_status`
> frontmatter and copies in its acceptance criteria.
> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.

The Portafolio is the overview of every project (cards or the «Comparativa» list), with Cuentas as its third
view and the «Cambiar de proyecto» dialog. v2 rebuilds it in one work order and removes the v1 rail; the
three v1 work orders are superseded.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-03-007 | portafolio-overview | PLANNED | WO-13-012, WO-25-001, WO-26-001, WO-01-010, WO-01-004 | Every project once, ordered by last commit: `ProjectCard`, Lista, the Tarjetas / Lista / Cuentas switch mounting the global directory, the project picker, the empty, missing-folder and no-signal states, the unknown-project card; removes the rail. |

> **Depends on** mirrors the work order's `dependsOn` frontmatter (DR-087).

## AC coverage

| AC | Work order |
|---|---|
| AC-03-008.1 | WO-03-007 |
| AC-03-008.2 | WO-03-007 |
| AC-03-008.3 | WO-03-007 |
| AC-14-003.1 | WO-03-007 |
| AC-14-003.2 | WO-03-007 |

AC-14-003.1 and AC-14-003.2 belong to FRD-14 and are **Out of v2** (the rail is gone); WO-03-007 owns them
and verifies them by removal. AC-14-004.1 and AC-14-005.1 are struck in FRD-14 and not owned. The
REQ-level bullets of FRD-03 (REQ-03-001 to REQ-03-007, REQ-03-009 and the two unnumbered rules) have no AC
id; the blueprint maps them to components.

## Build order

W4 (after WO-26-001 in W3 and WO-25-001 in W0). It runs in parallel with WO-17-008, WO-10-016 and WO-02-016
(disjoint artifacts). Consumers: WO-04-010 (W5), WO-18-002 (W5), WO-19-003 (W6).

## Definition of done

- Tests first (RED, then GREEN); `.pandacorp/verify.sh` green: biome, `tsc --strict`, vitest, knip, madge,
  smoke and shell.
- Read-only: the recovery commands are copyable text; the app never clones, writes the portfolio or calls
  Claude.
- The removal list of the work order is entirely gone; the built screens match the FDD mocks on the frozen
  tokens in light and dark at 375, 768 and 1280.

## Superseded (v1 history)

- WO-03-001 `active-projects` (VERIFIED), superseded_by: [WO-03-007]
- WO-03-002 `project-rail` (VERIFIED), superseded_by: [WO-03-007]
- WO-03-006 `last-sync-chip` (VERIFIED), superseded_by: [WO-03-007]
