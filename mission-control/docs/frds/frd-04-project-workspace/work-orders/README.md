# Work orders — FRD-04 Project workspace

> The authoritative order and parallelism is the **Build Plan** in [`../blueprint.md`](../blueprint.md) (the
> build engine reads that, not this). This file is the readable summary. Source-of-truth hierarchy:
> `FRD > FDD > design-tokens > blueprint > work order`. Platform: [`docs/product/architecture.md`](../../../product/architecture.md).

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| [WO-04-001](./wo-04-001-docs-reader.md) | docs-reader | VERIFIED | WO-01-000, WO-01-001 | History, kept live: `src/lib/docs` tree and comms readers (`listProjectDocs`, `readDoc`, `readActivityLog`, `readDecisions`). |
| [WO-04-003](./wo-04-003-workspace-commands.md) | workspace-commands | VERIFIED | WO-02-003, WO-01-005 | History, kept live: `workspaceCommands(phase)` in `src/lib/next-step`. |
| [WO-04-013](./wo-04-013-decision-resolved-in-file.md) | decision-resolved-in-file | PLANNED | WO-24-001, WO-04-001 | `readDecisions` honours an in-entry resolution (`resolvedInFile`), strips «· », engine-log predicate; `countOpenChanges`. |
| [WO-04-010](./wo-04-010-workspace-frame.md) | workspace-frame | PLANNED | WO-19-002, WO-03-007, WO-02-017, WO-26-001, WO-25-001, WO-13-012, WO-06-013, WO-04-013, WO-02-020, WO-12-007 | Frame: heroes, eight tabs with badges, panel contract, Spec / Arquitectura / Cuentas panels, unknown tab, legacy links; removes Party and the Work orders tab. |
| [WO-04-011](./wo-04-011-resumen.md) | resumen | PLANNED | WO-04-010, WO-06-013, WO-14-005, WO-04-013, WO-20-001, WO-18-002, WO-12-007 | Resumen: upgrade notice, next step, La Fragua, snapshot, Avance por FRD, decisions + dialog, Tu turno, Últimos avances, Bitácora. |
| [WO-04-012](./wo-04-012-cambios-documentos.md) | cambios-documentos | PLANNED | WO-04-010, WO-08-003 | Cambios groups, banner, dialog and discard confirm; Documentos index by purpose, type chips, search, typed paper. |

> **Depends on** mirrors each work order's `dependsOn` frontmatter. WO-04-001, WO-04-003 and WO-04-013 own no
> live acceptance criterion (data side; REQ-traced).

## AC coverage

| AC | Work order |
|---|---|
| AC-04-012.1 | WO-04-010 |
| AC-04-012.2 | WO-04-010 |
| AC-04-012.3 | WO-04-010 |
| AC-04-012.4 | WO-04-010 |
| AC-04-012.5 | WO-04-010 |
| AC-04-013.1 | WO-04-010 |
| AC-04-013.2 | WO-04-010 |
| AC-04-013.3 | WO-04-010 |
| AC-04-013.4 | WO-04-010 |
| AC-04-013.5 | WO-04-010 |
| AC-04-014.1 | WO-04-010 |
| AC-04-014.2 | WO-04-010 |
| AC-04-014.3 | WO-04-011 |
| AC-04-014.4 | WO-04-011 |
| AC-04-014.5 | WO-04-011 |
| AC-04-014.6 | WO-04-011 |
| AC-04-014.7 | WO-04-011 |
| AC-04-014.8 | WO-04-012 |

Cross-FRD criteria owned by this FRD's work orders: AC-12-006.4 (WO-04-010); AC-06-020.1, AC-20-001.1,
AC-20-001.2, AC-20-001.3, AC-20-002.1, AC-20-002.2, AC-20-004.1 (WO-04-011).

## Build order

1. W2: WO-04-001 (VERIFIED history). W4: WO-04-003 (VERIFIED history).
2. W3: WO-04-013, in parallel with the other W3 work orders (it alone writes `src/lib/docs/activity.ts` and
   `src/lib/changes/openChanges.ts` in that wave).
3. W5: WO-04-010, after the shell (WO-19-002), the codec (WO-25-001), the composite primitives (WO-13-012), the
   shared digests (WO-02-017), `AccountsTable` (WO-26-001), La Fragua v2 (WO-06-013) and the Portafolio
   overview (WO-03-007). It wires every panel, the v1 ones as adapters.
4. W6: WO-04-011 and WO-04-012 in parallel (disjoint panel files and folders), alongside WO-05-008 and WO-11-004,
   which rewrite the Observabilidad and Comandos panels through the same contract.
5. W7: WO-13-013 removes the retired v1 skin after every surface is rebuilt.

## Superseded (v1 history)

- WO-04-004 — Workspace shell: header + tabbar + objectives bar. Superseded by WO-04-010.
- WO-04-005 — Resumen + Documentos tabs. Superseded by WO-04-011 and WO-04-012.
- WO-04-008 — Changes tab: relative date on the change card. Superseded by WO-04-012 (REQ-04-011 asks for the absolute date).
- WO-04-009 — Stale workspace e2e specs: ten tabs and FRD-25 portfolio URLs (IN_REVIEW). Superseded by WO-04-010, which owns `e2e/_workspaceTabs.ts` and the eight-tab specs.
