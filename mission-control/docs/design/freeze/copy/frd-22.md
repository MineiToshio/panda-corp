# S1.4-22 · Copy reconciliation · FRD-22 (Factory backlog surface)

Summary: 7 rows judged (5 listed mismatches; two split with a defect found in the same dialog), 4 stale FRD quotes (prototype string wins), 2 prototype copy errors (raw English status chip, "Cambio" vs "Mejora"), 1 both fine.

Sources: `docs/design/freeze/packs/frd-22.md` §4, FRD `docs/frds/frd-22-factory-backlog/frd.md`, prototype `prototype.js` lines 1613-1640 (`backlogView`) and 2162 (item dialog), served state `#propuestas?tab=Backlog`.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Group names | "Abiertos" / "En curso" / "Hechos" / "Descartados" (AC-22-001.2) | "En curso 1", "Abiertos 10", "Hechos y descartados 17" | FRD quote stale (prototype string wins). Same vocabulary, merged history, En curso first (iteration 15). Order and merge are for S1.3. | none |
| 2 | History toggles | "Ver hechos (N)", "Ocultar hechos (N)", "Ver descartados (N)" (AC-22-006.1/2, 007.3) | none; the collapsed card header "Hechos y descartados 17" opens the list; "Mostrar 2 más · quedan 2" | FRD quote stale (prototype string wins). | none |
| 3a | List chips | `type · area` chip and severity chip (AC-22-001.3) | "Bug" / "Mejora" outline chip, area as plain text, priority "P0 · URGENTE", "P1 · IMPORTANTE", "P2 · CUANDO HAYA TIEMPO" | FRD quote stale (prototype string wins). | none |
| 3b | Type chip inside the item dialog (found while checking 3a) | n/a | list and filters say "Mejora" / "Mejoras"; the dialog says "Cambio" (`prototype.js` line 2162: `it.type === 'bug' ? 'Bug' : 'Cambio'`) | Prototype copy wrong. One concept, two terms. "Cambio" belongs to the Cambios tab (project change queue), a different object. | "Mejora" (code fix at line 2162 and the same line in `index.html`) |
| 4 | Area labels | area codes (`build-engine`, `plugin-skill`, `templates`, `hooks`) | "Motor de construcción", "Skills", "Plantillas de proyecto", "Controles automáticos", "Estándares", "Agentes", "Plugin" | FRD quote stale (prototype string wins). Plain names approved in iteration 15. | none |
| 5a | Item dialog heading "Proof" | n/a | section heading "Proof" from the item file | Both fine. It is shown content from `BL-*.md`, which keeps its source language (English). | none |
| 5b | Status chip in the item dialog (found while checking 5a) | "status chips" (AC-22-005.3) | raw frontmatter value: "doing" (also "open", "done", "discarded"), `chip(esc(it.status) ...)` | Prototype copy wrong. Interface chrome shows an English data key while the list groups say "En curso" / "Abiertos". | "En curso" (doing), "Abierto" (open), "Hecho" (done), "Descartado" (discarded). Use the same labels as the group headers. |

Notes: the "—" fallback for a missing priority (`prototype.js` line 1623 and 2162) is an em dash used as a no-value marker; flagged for the owner's strict reading of the no-em-dash rule, not judged here. Other strings checked and fine: "Cómo avanzar", "Todo de una vez.", "Uno por uno.", "Por tema", "Quitar filtros", "Nada abierto con este filtro.", "Descartar del backlog", "Motivo (opcional)", "Por qué…". "backlog" stays English per the owner rule.
