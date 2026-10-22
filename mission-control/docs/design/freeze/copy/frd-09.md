# Copy reconciliation · FRD-09 · Gamification (S1.4-09)

Summary: 3 mismatches judged: 2 FRD quote stale, 0 prototype copy wrong, 1 both fine.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Guild title in the "top bar" | `frd.md` line 19: 'Guild level/XP in the top bar ("Guild Master")' | Sidebar guild card shows the rank name ("Portador de Luz III"); Logros hero shows "Gremio Pandacorp · nivel 22" | FRD quote stale (prototype string wins) | none. "Guild Master" is an English title the interface never shows; the rank name is the title, and there is no top bar (see S1.3) |
| 2 | Guild level-up moment and release celebration | "Guild level-up moment", "release celebration" (U6, U7) | absent (no string drawn) | both fine | none. There is no prototype string to compare; whether these moments exist in v2 is a scope item for S1.3 / M1, not a wording one |
| 3 | Achievement notice heading | FRD-06 AC-06-016.1: "¡Logro desbloqueado!" | "¡Nuevo logro!" (real notice); "Vista previa del aviso" (only under `?achievement=preview`) | FRD quote stale (prototype string wins; the quote lives in FRD-06, S2.2 amends it there) | none. "¡Nuevo logro!" is correct Spanish and matches "Último logro" / "Nuevo logro" on Inicio. "Vista previa del aviso" is a review-only label and must not ship as product copy |
