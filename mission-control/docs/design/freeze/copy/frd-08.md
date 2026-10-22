# Copy reconciliation · FRD-08 · Documentation (S1.4-08)

Summary: 9 rows judged from the pack's 6 listed mismatches: 2 FRD quote stale, 4 prototype copy wrong (one cause: "Manual" used as the surface name), 3 both fine.

Rule applied: the interface is Spanish; the FRD (U1) names the surface "Documentación" and forbids "Manual" / "Códice" as the surface name; the owner's 2026-10-21 note says the "Manual" label should follow the contract name. The approved prototype wins everywhere else.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Tutorial bucket label | "Empezar aquí" | "Empieza aquí" (docs-home h2) | FRD quote stale (prototype string wins) | none. Imperative tú form matches the page ("Empieza por el tutorial", "Pulsa…") |
| 2 | Guides bucket | "Guías" | "Guías" (card) and "Guías para el día a día" (h2) | both fine | none. The card label equals the bucket; the h2 is a home-section heading |
| 3a | Surface name in the rail / bottom-nav mini label | "Documentación" in the top nav and H1; "Manual" SHALL NOT be the surface name | `mini: 'Manual'` (nav label and H1 already say "Documentación") | prototype copy wrong | "Docs" (the mini slot is short: "Ajustes" stands for Configuración). If the rail fits 13 characters at 12 px, use "Documentación" |
| 3b | Search label on the home | same | aria-label "Buscar en todo el Manual" | prototype copy wrong | "Buscar en toda la Documentación" |
| 3c | Reader index strings | same | aria "Índice del Manual"; placeholder "Buscar en el Manual…"; aria "Buscar en el Manual" | prototype copy wrong | "Índice de la Documentación"; "Buscar en la Documentación…"; "Buscar en la Documentación" |
| 3d | Descriptive subhead | same | "El manual de la fábrica. Empieza por el tutorial…" / "El manual de la fábrica: empieza por el tutorial…" | both fine | none. Lowercase common noun describing what the pages are, not the surface name |
| 4 | Full skill definition | "ver el `SKILL.md` completo" (collapsible, rendered as markdown) | "Definición completa" (`<details>` in the Configuración skill and agent dialogs) | FRD quote stale (prototype string wins) | none. One label serves skills and agents and renders markdown, which is what the AC asks |
| 5 | Not-found page | none (the FRD has no quote) | "Esta página no existe" / "El Manual no tiene una página «no-existe»." / "Ir al inicio del Manual" | prototype copy wrong (lines 2 and 3; line 1 is fine) | "La Documentación no tiene una página «no-existe»." / "Ir al inicio de la Documentación" |
| 6 | Search placeholder | none | home "Buscar en 38 páginas…" | both fine | none. It counts pages and names no surface (the reader placeholder is row 3c) |

Rows 3a to 3c and 5 are one fix (replace "Manual" as the surface name), kept apart because they sit in different elements.

Also noticed, outside the pack list and same cause: the review-only toast "Enlace interno del Manual de la app" (`prototype.js` line 2121) should read "Enlace interno de la Documentación de la app" if it ever ships. Captured page bodies keep their own wording (2026-10-21 language rule).
