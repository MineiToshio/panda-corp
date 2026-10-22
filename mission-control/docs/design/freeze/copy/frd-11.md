# Copy reconciliation · FRD-11 · Per-project build modes (S1.4-11)

Summary: 4 rows judged from the pack's 3 listed mismatches: 1 FRD quote stale, 3 prototype copy wrong, 0 both fine.

Note: the prototype's tags `pro`, `powerful`, `deep` are the literal command arguments (REQ-11-004) and stay in English. Plan names (Pro, Max 5x, Max 20x) are product names and stay as they are.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Mode names | "Pro / economical", "Balanced (default)", "Powerful", "Deep" (REQ-11-001) | Labels "Pro", "Equilibrado", "Potente", "Profundo" | FRD quote stale (prototype string wins) | none. Spanish interface; "economical" is a descriptor already carried by the Pro hint ("modelos económicos") |
| 2 | Tag of the default mode | "Balanced (default)" | Tag "default" next to "Equilibrado" (the other tags are the real arguments `pro` / `powerful` / `deep`) | prototype copy wrong | "por defecto". The default mode has no argument, so "default" is not a command token; it is an English word in a Spanish interface, and the card's own hint already says "Por defecto" |
| 3 | Plan names in the hints | "For the Pro plan", "Designed for Max 5x", "For Max 20x" | "Para plan Pro.", "Para Max 20x.", "Por defecto, pensado para Max 5x." | prototype copy wrong (minor grammar, one hint) | "Para el plan Pro." The plan names stay as they are; the other hints are correct |
| 4 | Target builder (no FRD quote) | none | "Construir un objetivo concreto"; "Elige un FRD, una orden pendiente o un cambio de la cola para acotar el build."; option "Elige un FRD o work order…"; `/pandacorp:implement <id>` | prototype copy wrong (intro sentence only) | "Elige un FRD, una work order pendiente o un cambio de la cola para acotar el build." Work order stays English by the 2026-10-21 artifact-names decision; the option text already uses it. The heading, the option and the command are fine |

Row 4 is part of a wider term sweep: the prototype writes "orden / órdenes" for work order in several FRDs (see frd-12). The lead should confirm the sweep at M1 because it touches many strings.
