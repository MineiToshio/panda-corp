# S1.4-06 · Copy reconciliation · FRD-06 Party · La Fragua

Summary: 7 mismatches judged plus 1 related finding; 5 FRD quotes stale (prototype wins), 1 prototype string wrong (singular agreement in the remaining-orders chip), 1 both fine.

Source: `docs/design/freeze/packs/frd-06.md` section 4. Rules applied: Spanish interface, artifact names (work order, FRD) stay English, no em dash in product copy, approved prototype wins unless genuinely wrong. Structural gaps (sprite per order, flow strip, tribunal, relays) are not copy and stay with S1.3.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Room names | "Sala de Forja" / "Tribunal del Juez" / "Bóveda" | stations "Cola" / "Taller" / "Revisión" / "Bóveda" | FRD quote stale (prototype string wins). Owner-approved replacement, iterations 19, 21, 24, 26. | none |
| 2 | AC-06-013.2 factory-off overlay | copy saying the factory starts by launching `/pandacorp:implement` (not "press play") | "El equipo descansa: no hay un build corriendo." | FRD quote stale (prototype string wins). The line is accurate and derived from the real flag; the next-step command is carried by the "Siguiente paso" chip. | none |
| 3 | AC-06-012.2 demo marking | "SOLO DEMO" | tag "Demo" plus "En la app la escena muestra siempre el estado real del build." | FRD quote stale (prototype string wins). The tag plus note state clearly that the control is mock-only. (The control leaking under `?demo=off` is a defect for S2.1, not copy.) | none |
| 4 | AC-06-016.1 achievement toast | "¡Logro desbloqueado!" | "¡Nuevo logro!"; preview label "Vista previa del aviso" | FRD quote stale (prototype string wins). Shorter and consistent with the guild vocabulary on Inicio. | none |
| 5 | AC-06-001.3 queue overflow | "+N en cola" | "+N" on the token row and the "Cola" station | FRD quote stale (prototype string wins). The station is already named "Cola", so "en cola" would repeat it. | none |
| 6 | Empty station messages (not in the FRD) | none | "Nada por empezar", "Nadie construyendo ahora", "Nada esperando revisión", "Aún nada verificado" | Both fine. Correct, short, active-voice Spanish that say what the empty station means. | none |
| 7 | Global counter | "52 / 109 WO" | headline "39 de 48 work orders verificadas…", chips "Faltan 9" / "Todo forjado" | FRD quote stale (prototype string wins). The counter is now a sentence plus a ring and chips. | none |
| 7b | Related finding on the same chips (singular case) | n/a | "Faltan 1" and, in the headline, "Las 1 restantes ya están construidas y esperan la revisión de su FRD." (shown for Mission Control, which has exactly 1 order left) | Prototype copy wrong. The prototype has no singular branch, so it prints "Faltan 1" and "Las 1 restantes". | "Falta 1" and "La 1 restante ya está construida y espera la revisión de su FRD." (plural forms stay "Faltan N" and "Las N restantes ya están construidas…") |
