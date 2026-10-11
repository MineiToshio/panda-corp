# Auto-chequeo de accesibilidad — Cockpit de Pandacorp

> Verificación por dirección antes del gate (encargo §5/§9.5). **Método:** no se corrió
> axe-core/Playwright en este entorno; en su lugar medí el **contraste real** resolviendo
> cada token OKLCH a sRGB en el navegador (canvas) y calculando el ratio WCAG 2.1 sobre la
> página viva, en light y dark, más una revisión manual de foco, teclado, `aria` y motion.
> Recomiendo correr axe-core + Playwright al congelar la dirección elegida (queda como
> tarea del gate).

## 1. Contraste de texto (ratios medidos, WCAG AA exige ≥4.5:1 texto normal)

Peor caso por par (texto sobre su superficie). ✓ = pasa AA.

| Par | D1 light | D1 dark | D3 light | D3 dark | AA |
|---|---|---|---|---|---|
| `--t1` / canvas (primario) | 14.27 | 15.28 | 14.93 | 15.47 | ✓ |
| `--t2` / canvas (secundario) | 6.83 | 9.37 | 6.67 | 9.20 | ✓ |
| `--t3` / card (terciario, peor caso) | 5.09 | 5.43 | 5.05 | 5.27 | ✓ |
| `--accent-text` / canvas | 6.93 | 8.38 | 6.51 | 9.54 | ✓ |
| texto sobre acción primaria (`on-accent`/accent) | 5.21 | 5.72 | 5.10 | 7.34 | ✓ |
| `--danger` / canvas | 5.53 | 6.03 | 5.38 | 5.90 | ✓ |
| agente *security-auditor* (texto) / canvas | 6.85 | 9.12 | 6.98 | 8.93 | ✓ |
| agente *test-writer* (texto) / card | 6.73 | 9.04 | 6.28 | 11.07 | ✓ |

D2 (Cripta) comparte los mismos *targets* de lightness (texto L≈0.28/0.44/0.52 sobre
canvas L≈0.91 en light; L≈0.91/0.74/0.69 sobre L≈0.16 en dark) → pasa con márgenes
equivalentes. **Modo alto-contraste** sube `--t1`, oscurece/engruesa bordes y satura el
acento, todo por encima de AAA en los pares de texto principal.

### Corrección aplicada en este chequeo
- `--t3` (terciario) bajaba a ~3.65–4.19 sobre la superficie más clara → **oscurecido**
  en las 3 direcciones hasta ≥4.7.
- D1 light: texto sobre el botón primario daba 4.40 → **acento terracota oscurecido**
  (L 0.58→0.55) y `on-accent` a blanco puro → 5.21.

## 2. Color no es el único portador de significado
- Cada **estado** (trabajando/tránsito/espera/bloqueado/revisando/completado/**falló**)
  lleva **icono + forma + etiqueta de texto**, no solo color (halo + emote + badge con
  palabra). El **fallo** es de primera clase: sprite caído + borde rojo + `❌` + "Falló",
  distinto de "Completado".
- El **feed** combina icono de evento + nombre del agente + color de rol (triple
  redundancia).
- Los **~10 colores de agente** nunca distinguen identidad por sí solos: van con sprite +
  nombre + icono de rol. Para daltonismo, la adyacencia roja(28)/verde(145) está mitigada
  porque ningún estado ni identidad depende solo del matiz.

## 3. Foco, teclado y touch
- **Foco visible:** anillo `2.5px` de acento con `outline-offset` y `border-radius`
  heredado (respeta la forma del componente). Presente en todo elemento interactivo.
- **Teclado:** tabs, tarjetas de idea, ítems de documento, modos y celebraciones son
  operables con `Tab` + `Enter`/`Space` (`role="button"`, `tabindex="0"`, handler de
  teclado). Cerrar celebración con clic en el backdrop.
- **Touch:** `.iconbtn` 38px con área de toque holgada; tabs/botones ≥38–44px de alto.
  *Pendiente al congelar:* subir `.iconbtn` a 44×44 estricto para cumplir el mínimo táctil
  al 100%.

## 4. `aria` y anuncios (en español)
- `aria-label` en español en iconos de acción, sprites, barras de XP/avance y toggles.
- El contenedor principal es `aria-live="polite"`; el registro de eventos anuncia sin
  robar foco; las celebraciones usan `role="status"` (toast) y `role="dialog"`.
- Idioma del documento `lang="es"`.

## 5. Motion
- Solo se anima `transform`/`opacity`, `<300ms`, 2–3 easings.
- **`prefers-reduced-motion: reduce`** desactiva toda animación (CSS media query global) y
  Mission Control entra en **modo snapshot estático** con nota visible; el toggle
  "Reduced-motion" del dock permite previsualizarlo. Sin loops decorativos infinitos en
  contenido; las celebraciones expresivas se reservan a eventos raros (logro/fase/release/
  subir de nivel).

## 6. Riesgos residuales / pendientes para el gate
1. Correr **axe-core + Playwright** (screenshots 375px/1280px) sobre la dirección elegida
   y adjuntar el reporte automático.
2. Subir `.iconbtn` a **44×44** estricto.
3. Revisar `--t3` en textos <12px sobre `--panel` translúcido del header (blur) — medir en
   el peor caso real de transparencia.
4. Verificar contraste de los **badges sobre sprite** (texto blanco sobre relleno de rol):
   los rellenos de rol (`--ag-*` solid) están calibrados, pero conviene medir cada uno con
   blanco encima al congelar.
