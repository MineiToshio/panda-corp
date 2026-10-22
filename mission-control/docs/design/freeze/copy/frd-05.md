# S1.4-05 · Copy reconciliation · FRD-05 Work orders

Summary: 4 mismatches judged, 2 FRD quotes stale (prototype wins), 2 prototype strings wrong (gender agreement of "work order"), 0 both fine.

Source: `docs/design/freeze/packs/frd-05.md` section 4. Rules applied: Spanish interface, artifact names (work order) stay English, no em dash in product copy, approved prototype wins unless genuinely wrong. Evidence for the gender finding: the prototype writes "work order" as feminine in most places ("1 work order verificada", "work orders planificadas", "work orders publicadas" in one string, "Esta orden no está publicada") and as masculine in others ("work orders publicados", "los work orders capturados", "work orders verificados"). Spanish "orden" is feminine, so feminine is the single choice.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | REQ-05-001 columns | "To do · In progress · Review · Fail · Done" | "Planificado · En curso · En revisión · (Bloqueado) · Verificado" | FRD quote stale (prototype string wins). English column names replaced by the Spanish state vocabulary; "Bloqueado" appears only when a failing order exists. | none |
| 2 | Edge case: project without work orders | message saying they are generated in /pandacorp:architecture | "Este proyecto todavía no tiene work orders publicados. Sus documentos de producto y diseño siguen disponibles." plus the `/pandacorp:architecture` command | Prototype copy wrong. The command chip covers the FRD intent, but "publicados" breaks gender agreement with "work orders" (feminine). | "Este proyecto todavía no tiene work orders publicadas. Sus documentos de producto y diseño siguen disponibles." (the same fix applies to the tooltip "Aún no tiene work orders publicados" in the Portafolio cards: "publicadas") |
| 3 | Detail tab names | "Summary" / "Full document" | "Resumen" / "Documento completo" | FRD quote stale (prototype string wins). English quotes of Spanish tabs. | none |
| 4 | Not-found work order (no FRD text) | none | "Esta orden no está publicada" / "WO-99-999 no aparece entre los work orders capturados de Mission Control." / "Ver work orders" | Prototype copy wrong for the second line only (gender agreement). Title and link are fine. | "WO-99-999 no aparece entre las work orders capturadas de Mission Control." |
