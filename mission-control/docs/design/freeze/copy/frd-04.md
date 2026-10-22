# S1.4-04 · Copy reconciliation · FRD-04 Project workspace

Summary: 6 mismatches judged, 5 FRD quotes stale (prototype wins), 0 prototype strings wrong, 1 both fine.

Source: `docs/design/freeze/packs/frd-04.md` section 4. Rules applied: Spanish interface, shown content keeps its language, artifact names (FRD, PRD, ADR, work order, spec, backlog) stay English, no em dash in product copy, approved prototype wins unless genuinely wrong.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | REQ-04-002 / REQ-04-012 tab and section labels | tabs "Work orders" and "Party"; bar "Mission Objectives" | tab "Observabilidad" (no Party tab); "Avance por FRD" | FRD quote stale (prototype string wins). Owner decision, iteration 19: Observabilidad is the work-order section, Party is merged into the Resumen as La Fragua, the objectives bar became "Avance por FRD". | none |
| 2 | AC-04-013.4 empty Spec state | "Todavía no hay una especificación publicada." | "El spec todavía no está publicado." plus "Su PRD y sus FRDs reales siguen disponibles." | FRD quote stale (prototype string wins). "spec" is an artifact name and stays English in the Spanish interface (owner scope decision 3); the second line is honest and useful. | none |
| 3 | FRD-04#U3 history toggles | "Ver hechos (N)" / "Ver descartados (N)" | collapsed card "Historial 11" | FRD quote stale (prototype string wins). Done and discarded are merged in one collapsed "Historial"; "Historial" is the right Spanish term. | none |
| 4 | FRD-04#U3 change groups | "Listos (ready)", "Borradores (draft)", "En construcción", "Cerrando" | "Listos para construir", "Borradores", "En construcción", "Cerrando", "Historial" | FRD quote stale (prototype string wins). The English glosses in parentheses are not product copy; "Listos para construir" says what the group means. | none |
| 5 | FRD-04#U4 discard confirmation | inline "¿Seguro? Sí / No" swap | dialog "Descartar cambio" with optional "Motivo" and "Cancelar" / "Descartar" | FRD quote stale (prototype string wins) for the strings; the confirmation pattern (inline swap vs replacing dialog) is a behaviour point for S1.3. The dialog copy is correct Spanish. | none |
| 6 | "Comandos" tab title | "Commands tab" | "Comandos" | Both fine. REQ-04-002 already lists "Comandos"; "Commands tab" is English prose describing it. | none |
