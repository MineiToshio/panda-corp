# S1.4-19 · Copy reconciliation · FRD-19 Global app shell

Summary: 6 mismatches judged; 3 FRD quotes stale (prototype wins), 1 prototype string wrong (desktop toggle `aria-label`), 2 both fine.

Source: `docs/design/freeze/packs/frd-19.md` section 4. Rules applied: Spanish interface, shown content keeps its language, artifact names stay English, no em dash in product copy, approved prototype wins unless genuinely wrong.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Destination labels | "Inicio, Tablero, Portfolio, Propuestas, Logros, Documentación" (six) | "Inicio, Tablero, Portafolio, Propuestas, Logros, Documentación, Configuración" (seven); short labels on the rail and bottom nav: "Manual", "Ajustes" | FRD quote stale (prototype string wins). "Portafolio" is the Spanish term used everywhere; Configuración is a normal destination. "Manual" and "Ajustes" are deliberate short forms for the 76 px rail and the bottom bar (the section itself speaks of "el Manual"); keep them. | none |
| 2 | Skip link | skip link (copy not quoted) | "Saltar al contenido" | Both fine. Clear imperative Spanish. The defect is behavioural (`href="#content"` hits the hash router), not wording. | none |
| 3 | Toggle accessible names | "accessible open/close label" | Phone: `aria-label` "Abrir menú". Desktop: visible "Colapsar" / "Fijar abierta" with `aria-label` "Colapsar la barra lateral" / "Fijar la barra lateral abierta" | Prototype copy wrong, for one string. "Abrir menú" and "Colapsar la barra lateral" are fine. "Fijar la barra lateral abierta" does not contain the visible text "Fijar abierta", so the accessible name fails Label in Name (WCAG 2.5.3). | "Fijar abierta la barra lateral" |
| 4 | Guild identity | "NV n · rank · xp bar" in the header | Sidebar guild card: crest with the level, rank name, "175 / 200 XP al nivel 23", gold bar | FRD quote stale (prototype string wins). The guild block moved from the top header to the sidebar. | none |
| 5 | Brand text | "Pandacorp Mission Control" | "Pandacorp" over "MISSION CONTROL" (uppercase by style); brand link `aria-label` "Pandacorp Mission Control: ir a Inicio" | Both fine. Same words, stacked; the accessible name carries the full brand. | none |
| 6 | Proposals badge | "Propuestas ◦ n" (nested badge) | "Propuestas 4" count in the item; accessible name "4 cosas esperan tu decisión" | FRD quote stale (prototype string wins). The count is no longer a nested sub-destination; it counts actions that need the owner. | none |
