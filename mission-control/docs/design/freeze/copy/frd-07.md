# S1.4-07 · Copy reconciliation · FRD-07 Configuration

Summary: 7 mismatches judged (expanded to 13 string rows); 5 FRD quotes stale (prototype wins), 8 prototype strings wrong (untranslated or raw values: "Owner", "Comando del owner", dialog "MUST", "Skill", "project", "Programming", "opus", "esfuerzo high"), 0 both fine.

Source: `docs/design/freeze/packs/frd-07.md` section 4; the wrong strings were confirmed in `docs/design/prototype/prototype.js` (lines 1972 to 1995 and 2164 to 2166). Rules applied: Spanish interface, shown content (skill and agent descriptions, rule and standard bodies) keeps its source language, artifact names stay English, no em dash in product copy, approved prototype wins unless genuinely wrong. The interface addresses the user as "tú" everywhere ("Tus comandos", "tu decisión", "13 requieren tu OK"), so "owner" is an inconsistent anglicism there.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Section names | "Skills · Agents · Decision rules · Standards" | "Habilidades · Agentes · Reglas de decisión · Estándares" (plus the extra "Resumen" hub tab) | FRD quote stale (prototype string wins). | none |
| 2 | Internal skill flag (list rows) | "interno" | chip "Motor interno" | FRD quote stale (prototype string wins). Clearer than a bare "interno". | none |
| 2b | Same flag, detail header for owner commands | n/a | chip "Comando del owner" | Prototype copy wrong. Hub and list already say "Comandos tuyos" / "Tus comandos"; "owner" is untranslated. | "Comando tuyo" |
| 3 | Decision rule approval indicator | "auto-approves (●) / asks you (●)" | row chips "Auto" / "Owner"; filters "Automáticas" / "Requieren al owner" | Prototype copy wrong for "Owner" and "Requieren al owner" (the hub tile already says "13 requieren tu OK"). "Auto" and "Automáticas" are fine. | chip "Tu OK"; filter "Requieren tu OK" |
| 4 | Standard severity badges, list rows | "MUST / SHOULD / MAY" | "Obligatorio" / "Recomendado" (MAY never appears) | FRD quote stale (prototype string wins). If a MAY standard ever exists, the Spanish label is "Opcional". | none |
| 4b | Severity chip in the standard dialog | n/a | raw "MUST" (the list says "Obligatorio") | Prototype copy wrong. Same fact, two labels; the dialog prints the data value. | "Obligatorio" (and "Recomendado" for SHOULD) |
| 5a | Skill dialog kicker | n/a | "Skill" | Prototype copy wrong. The section is "Habilidades". | "Habilidad" |
| 5b | Skill dialog scope chip | n/a | raw "project" / "factory" | Prototype copy wrong. The list groups already name the scopes in Spanish. | "Dentro de un proyecto" / "En la fábrica" |
| 5c | Standard dialog kicker | n/a | "Estándar · Programming" | Prototype copy wrong. The domain select already says "Programación"; the kicker prints the English data value. | "Estándar · Programación" (same pattern for the other domains: Calidad, Datos y privacidad, Producto y docs, Seguridad, Otros) |
| 5d | Agent model chip in the agent dialog | n/a | raw "opus" / "sonnet" | Prototype copy wrong. The group headers read "Opus" / "Sonnet" / "Modelo heredado"; the chip prints the lowercase data value. | "Opus" / "Sonnet" / "Modelo heredado" |
| 5e | Agent effort chip (cards and dialog) | n/a | "esfuerzo high", "esfuerzo medium" | Prototype copy wrong. Spanish word followed by an English value. | "esfuerzo alto" / "esfuerzo medio" / "esfuerzo bajo" |
| 6 | Creation buttons | "New decision rule" and "New standard" (copy `/pandacorp:learn`) | absent | FRD quote stale (prototype wins). Owner scope decision 2026-10-21: creation affordances stay out of v2. | none |
| 7 | Agent avatar | "pixel-art avatar, Final Fantasy style" | sprite where the agent has one, else two-letter initials | FRD quote stale (prototype string wins). | none |
