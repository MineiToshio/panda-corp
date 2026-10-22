# S1.4-13 · Copy reconciliation · FRD-13 Visual system and accessibility

Summary: 2 mismatches judged; 1 FRD quote stale (prototype wins), 0 prototype strings wrong, 1 both fine.

Source: `docs/design/freeze/packs/frd-13.md` section 4. Rules applied: Spanish interface, shown content keeps its language, artifact names stay English, no em dash in product copy, approved prototype wins unless genuinely wrong.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Language of accessible names and leftover English | "`aria-label` in Spanish on icons" | Icon buttons are Spanish ("Copiar …", "Cerrar", "Abrir menú", "Saltar al contenido"); the dialog kicker is "Skill" | Both fine. The FRD rule holds. "Skill" is the term the whole interface uses for this artifact ("Skills sin uso registrado", "estándar, regla o skill"), so it is consistent, not a leak. Other English seen in dialogs ("Estándar · Programming", scope chip "project", "opus/sonnet", "esfuerzo high") is shown content or proper names, which keep their language. | none |
| 2 | Palette and fonts | "warm pixel-RPG palette, dark default" | Graphite/porcelain Órbita palette, light at `:root` and dark under `[data-theme="dark"]`; Space Grotesk + Inter + JetBrains Mono | FRD quote stale (prototype string wins). Órbita was approved on 2026-10-21; the warm pixel-RPG description, the single-accent rule and the 3-level elevation scale no longer describe the CSS. | none |
