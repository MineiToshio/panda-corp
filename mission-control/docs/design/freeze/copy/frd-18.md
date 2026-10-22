# S1.4-18 · Copy reconciliation · FRD-18 Dashboard (Inicio)

Summary: 6 mismatches judged; 3 FRD quotes stale (prototype wins), 0 prototype strings wrong, 3 both fine.

Source: `docs/design/freeze/packs/frd-18.md` section 4. Rules applied: Spanish interface, shown content keeps its language, artifact names stay English, no em dash in product copy, approved prototype wins unless genuinely wrong.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Section order | health banners, digest, Tu turno, Pulso, Construcción y cartera, Tu progreso | Left column: plugin banner, "Tu turno", "Tu cartera", "En marcha"; right column: "Pulso", Gremio card, "Embudo de ideas", "Árboles de trabajo" | FRD quote stale (prototype string wins). The digest is out of v2 (owner decision 2026-10-21). | none |
| 2 | Section names | "Pulso de la fábrica", "Construcción y cartera", "Tu progreso" | "Pulso", "Tu cartera", "Gremio" (card), "En marcha" | FRD quote stale (prototype string wins). Shorter names, same meaning; "En marcha" is a new section. | none |
| 3 | Page title | "Dashboard (Inicio, the command center)" | H1 "Centro de mando"; nav label "Inicio" | FRD quote stale (prototype string wins). The English title is the artifact name. The H1 differs from the nav label on purpose (proposal, Inicio row); record it as a deliberate deviation from rule 4d in `design-decisions.md`. | none |
| 4 | Calm state of "Tu turno" | "al día" badge when nothing is waiting | Count chip "Tu turno 6"; empty message in code "Nada espera tu acción ahora mismo." | Both fine. "al día" is already used in the interface ("al día" memory status), so either the badge or the message is valid; the fixture is not quiet, so the state is not captured. Behaviour for S1.3. | none |
| 5 | Health flags on project cards | "N bugs", "sin señal", "estancado", "en vivo" | Absent; only the violet chip "Construyendo" | Both fine. The FRD strings are correct Spanish and no prototype wording competes with them; whether the flags exist in v2 is a Group B decision (S1.3, M1). "Construyendo" is the drawn equivalent of "en vivo". | none |
| 6 | Next-command line | next command per phase; shipped project: `/pandacorp:review-launch` and "estable · en operación" | "Siguiente · /pandacorp:release", "Siguiente · /pandacorp:implement", "Siguiente · /pandacorp:iterate" (command taken from the project's captured phase commands) | Both fine. The label "Siguiente ·" is correct; the command is data, not copy. Do not freeze the fixture's `/pandacorp:iterate` as copy: `iterate` is an internal engine, and REQ-18-021's derivation (implement / review-launch) stays the rule for S1.3 and the build. | none |
