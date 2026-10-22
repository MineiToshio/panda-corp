# S1.4-20 · Copy reconciliation · FRD-20 (Project overlay freshness)

Summary: 3 mismatches judged, 2 stale FRD quotes (prototype string wins), 0 prototype copy errors, 1 both fine.

Sources: `docs/design/freeze/packs/frd-20.md` §4, FRD `docs/frds/frd-20-overlay-freshness/frd.md`, prototype `prototype.js` (notice `.notice.upgrade`, line 738) and the served state `#portfolio?project=pandasaga`.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | Warn heading | "Versión desfasada de Pandacorp" (AC-20-001.1) | "Este proyecto usa una versión vieja del motor de Pandacorp" | FRD quote stale (prototype string wins). Plain-language heading approved in iteration 19; "desfasada" is jargon-leaning and the prototype heading says what is wrong, no grammar or term issue. | none |
| 2 | Up-to-date ok badge | "Última versión de Pandacorp" with "al día" (AC-20-001.2) | absent (an up-to-date project shows nothing) | FRD quote stale (prototype string wins). Iteration 19 decided the notice appears only when the overlay is behind; there is no ok string to keep. The behaviour side (drop AC-20-001.2 or keep it as "show nothing") is for S1.3 and S2.2. | none |
| 3 | Detail naming both versions | "a detail naming both versions" | "Va con la v8.98.0 y la fábrica ya está en la v8.110.0. Actualízalo para que el próximo build use las reglas y herramientas nuevas." | Both fine. The FRD gives a requirement, not a literal; the prototype names both versions in correct Spanish. Companion strings also fine: "Córrelo en la carpeta de PandaSaga", copy button `aria-label` "Copiar /pandacorp:upgrade". | none |

Notes: the FRD word "badge" should read "notice" when S2.2 amends it. The running-project suffix "(espera a que termine el build en curso)" is in code only and reads correctly.
