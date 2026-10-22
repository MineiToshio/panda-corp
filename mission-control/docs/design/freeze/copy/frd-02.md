# S1.4-02 · Copy reconciliation · FRD-02 Ideas board

Summary: 13 mismatches judged, 12 FRD quotes stale (prototype wins), 0 prototype strings wrong, 1 both fine.

Source: `docs/design/freeze/packs/frd-02.md` section 4. Rules applied: Spanish interface, shown content keeps its language, artifact names (FRD, PRD, ADR, work order, spec, backlog) stay English, no em dash in product copy, approved prototype wins unless genuinely wrong.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | REQ-02-003 intake button and dialog title | "Capture ideas / oportunidades" | "Capturar ideas" | FRD quote stale (prototype string wins). The FRD quote is English; the interface is Spanish. | none |
| 2 | REQ-02-014 empty column marker | "Sin ideas en esta columna" | "Sin ideas en esta fase" | FRD quote stale (prototype string wins). Columns are pipeline phases now, so "fase" is the right noun. Visible text instead of visually hidden is a behaviour point for S1.3, not copy. | none |
| 3 | FRD-02#U4 discarded ideas button and modal | "Ver descartadas" | "Descartadas · 12"; modal title "Ideas descartadas · 12" | FRD quote stale (prototype string wins). The count in the label is the better affordance. | none |
| 4 | FRD-02#U5 restore action | "Volver a agregar" | "Restaurar"; dialog title "Restaurar idea" | FRD quote stale (prototype string wins). "Restaurar" matches the restore dialog and the ADR-0002 vocabulary. | none |
| 5 | FRD-02#U3 / REQ-02-008 discard action | "Discard idea" | "Descartar idea"; dialog "Descartar idea" with "Motivo (opcional)" | FRD quote stale (prototype string wins). English quote of a Spanish control. | none |
| 6 | AC-02-015.8 designed-model statement | "Modelo diseñado. Implementación sin verificar." | "Modelo diseñado, no verificado contra una base viva" | FRD quote stale (prototype string wins). Same meaning (designed, not verified against a live schema), correct Spanish, no verification implied. | none |
| 7 | Phase name in columns and Campaña | "6 Release" | "6 · Lanzamiento" | FRD quote stale (prototype string wins). Owner language rule, iteration 27: the phase shows as "Lanzamiento". | none |
| 8 | AC-02-011.2 Spec band headings | "📋 PRD", "🔬 Research", "🧩 FRDs" | "PRD · qué y por qué", "Research · la evidencia", "FRDs · las piezas del v1" | FRD quote stale (prototype string wins). Emoji headings were replaced by plain headings with a Spanish gloss; PRD, Research and FRDs name artifacts and stay English. | none |
| 9 | AC-02-011.3 FRD modal section names | "Overview", "User stories", "Reglas de negocio", "Fuera de alcance", "Open questions" | "Visión", "Historias de usuario", "Reglas de negocio", "Fuera de alcance", "Preguntas abiertas" | FRD quote stale (prototype string wins). The FRD mixes English and Spanish; the prototype is fully Spanish. The extra "Work orders" section is also fine. | none |
| 10 | AC-02-010.1 Campaña container heading | "EL VIAJE DE ESTA IDEA POR LAS 6 FASES" (uppercase) | "El viaje de esta idea por las 6 fases" (sentence case) | FRD quote stale (prototype string wins). Same words; the prototype renders it as a sentence-case heading. | none |
| 11 | AC-02-010.9 command mode control | select with first option "default" | no select; disclosure "Elegir modo de construcción" and "Cuántas preguntas te hago antes de generar la documentación" | FRD quote stale (prototype string wins). The prototype strings are correct Spanish; the control shape is a structure question for S1.3. | none |
| 12 | AC-02-010.4 ficha labels | "LEE" / "ESCRIBE" | "Lee" / "Escribe" under "Entra y sale", upper-cased by CSS | Both fine. The rendered text is the same ("LEE" / "ESCRIBE"); only the source casing differs. | none |
| 13 | AC-02-012.3 favourite star accessible name | "Marcar como favorita" / "Quitar de favoritas" | "Marcar como favorita: <título>" / "Quitar de favoritas: <título>" | FRD quote stale (prototype string wins). The title suffix makes each star's name meaningful out of context; S2.2 should add it to the AC. | none |
