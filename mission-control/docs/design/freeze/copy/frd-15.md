# S1.4-15 · Copy reconciliation · FRD-15 Plugin out-of-sync warning

Summary: 3 mismatches judged; 1 FRD quote stale (prototype wins), 1 prototype string wrong (dirty-plugin variant), 1 both fine.

Source: `docs/design/freeze/packs/frd-15.md` section 4. Rules applied: Spanish interface, shown content keeps its language, artifact names stay English, no em dash in product copy, approved prototype wins unless genuinely wrong.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Recovery steps | "run command → restart session" | "1) Corre el comando · 2) Reinicia la sesión de Claude Code." (command box with copy button below) | Both fine. The FRD paraphrases the two steps; the prototype gives them in plain Spanish, imperative, in the right order. | none |
| 2 | Sidebar pill | not in the FRD | "Plugin desactualizado" (title "Instalado 9.140.0 · repositorio 9.141.0"), links to Inicio | FRD quote stale (prototype string wins). The FRD is silent; S2.2 adds the pill. Shorter wording than the banner heading ("El plugin instalado está atrás") is deliberate for a pill. | none |
| 3 | Dirty-plugin variant of the banner | FRD: uncommitted changes in `plugin/` are deliberately NOT a trigger (owner decision 2026-06-22); heading is only "El plugin instalado está atrás" | Code path renders heading "Hay cambios sin commitear en el plugin" and "N archivos modificados en `plugin/` sin commitear" | Prototype copy wrong. The variant contradicts a recorded owner decision and would raise the false positive the FRD removed. It is not visible in the captured state, so remove it from the prototype in S2.1. | Remove the variant (no string); the only banner heading is "El plugin instalado está atrás" |
