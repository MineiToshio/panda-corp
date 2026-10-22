# S1.4-03 · Copy reconciliation · FRD-03 Portfolio

Summary: 4 mismatches judged plus 1 related finding; 3 FRD quotes stale (prototype wins), 1 prototype string wrong (picker kicker "Cartera"), 1 both fine.

Source: `docs/design/freeze/packs/frd-03.md` section 4. Rules applied: Spanish interface, artifact names stay English, no em dash in product copy, approved prototype wins unless genuinely wrong.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | REQ-03-003 build indicator | "building" / "stopped" | "Construyendo" / "Sin construcción activa" | FRD quote stale (prototype string wins). English quote of Spanish chips. | none |
| 2 | REQ-03-007 relative time | "hoy", "ayer", "hace N días", "hace N meses" | cards: "hace 1 h", "hace 43 h"; project header: "hoy" / "ayer" / "hace N días" | FRD quote stale (prototype string wins). The prototype adds an hours step on cards. S2.2 should list the full ladder as drawn (hours, days, months). | none |
| 3 | FRD title and nav label | "Portfolio and project navigation" | nav label and H1 "Portafolio" | FRD quote stale (prototype string wins). Owner language rule, iteration 27: "Portafolio" in the interface; the English FRD title stays as the artifact name. | none |
| 3b | Related finding on the same concept (project picker dialog kicker) | n/a | kicker "Cartera" above "Cambiar de proyecto" | Prototype copy wrong. One term per concept: the nav, H1, breadcrumbs and "Abrir en Portafolio" all say "Portafolio". | "Portafolio" |
| 4 | Out of scope text | "business snapshot" | not drawn | Both fine. Consistent with the FRD: nothing is shown, nothing to reconcile. | none |
