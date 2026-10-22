# Copy reconciliation · FRD-12 · Observability and data visualization (S1.4-12)

Summary: 5 rows judged from the pack's 4 listed mismatches: 2 FRD quote stale, 2 prototype copy wrong (one cause: "orden / órdenes" used for work order), 1 both fine.

Rule applied: the 2026-10-21 owner decision keeps "work order" in English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog). The prototype already writes "work order" in most places ("Vista de work orders", "Work orders verificados", the "Por work order" switch) but mixes in "orden / órdenes". One term per concept: "work order". Plural is "work orders". Gender: "orden" is feminine, so "una work order", matching the prototype's "cada work order verificada".

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | View toggle | "Línea de tiempo ↔ DAG" toggle (AC-12-002.3) | Segmented control "Por FRD · Tablero · Dependencias", plus the level switch "Por FRD / Por work order" inside Dependencias | FRD quote stale (prototype string wins) | none. The owner removed "Línea de tiempo" in iteration 22 (the ACs that need it are S1.3 / S2.2 business) |
| 2 | Name of the graph | "DAG" (AC-12-004.*) | Card title "Grafo de dependencias" with a count chip ("23 FRDs") | FRD quote stale (prototype string wins) | none for the title. "DAG" is jargon; "Grafo de dependencias" is plain. The count chip "110 órdenes" is fixed by row 3 |
| 3 | List version (tablet and phone) | none (not in the FRD) | "Paso 1 · 1 orden", "Paso 2 · 3 órdenes"; "Abrir orden"; aria "Orden en foco"; chip "110 órdenes" | prototype copy wrong (term) | "Paso 1 · 1 work order", "Paso 2 · 3 work orders"; "Abrir work order"; "Work order en foco"; "110 work orders" |
| 4 | Other strings of the same list | none | "Depende de · N", "Desbloquea · N", "Quitar foco" | both fine | none. Clear, active verbs, consistent with the desktop card ("Depende de", "Desbloquea") |
| 5 | Explanatory texts | none | "De izquierda a derecha: lo que va primero → lo que desbloquea. Pulsa una orden para ver su cadena."; "Por pasos: cada paso se puede construir cuando termina el anterior. Pulsa una orden para ver de qué depende y qué desbloquea."; "…Pulsa el título de un FRD para verlo en detalle, o una orden para abrirla." | prototype copy wrong (term, one word each) | "Pulsa una work order para ver su cadena."; "Pulsa una work order para ver de qué depende y qué desbloquea."; "…o una work order para abrirla." Everything else in these sentences is fine |

The term sweep ("orden / órdenes" meaning work order) also reaches other states and FRDs (Observabilidad filter "110 órdenes", the Comandos intro in frd-11). The lead should confirm it once at M1 and let S2.1 apply it in one pass. Note also that the prototype writes "Work orders verificados" (masculine) in Logros while "cada work order verificada" (feminine) elsewhere; one gender should be picked in the same pass.

Also noticed, outside the pack list: the cross-FRD line tooltip reads "FRD-01 → FRD-02: 1 dependencias" (22 times). Broken plural. The code builds it as `${n} dependencias` (`prototype.js` line 1394) while the helper `plural()` is used on the cards. Corrected: "FRD-01 → FRD-02: 1 dependencia" / "N dependencias".
