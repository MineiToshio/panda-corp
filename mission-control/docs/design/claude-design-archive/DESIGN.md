# DESIGN.md — Sistema visual del cockpit de Pandacorp

> Estado: **3 direcciones propuestas, sin congelar.** Sergio elige una (encargo §10) y
> entonces se congela `design-tokens.json` + `decisiones-de-diseno.md`.
> Tokens completos en [`design-tokens.json`](design-tokens.json). Investigación en
> [`referencias.md`](referencias.md). Mockups navegables en `direction-1/2/3.html`.

---

## 1. Las 3 direcciones (genuinamente distintas)

| | **D1 · Pergamino** | **D2 · Cripta** | **D3 · Atelier** |
|---|---|---|---|
| Personalidad | Dashboard sobrio, alma de pergamino | Gremio de noche inmersivo, menú JRPG | SaaS limpio (Linear/Geist) con RPG de guarnición |
| Paleta | Cálida clásica (papel/tinta) | Tierra apagada (oliva/arcilla/ceniza) | Neutro cálido + acento joya |
| Acento | Terracota / ascua | Oro de quest | Teal-pino |
| Formas | Esquinas suaves (8px) | Bordes pixel duros (0–3px), biselados | Esquinas amplias (12–18px) |
| Tipografía | Spectral (serif) + Public Sans | Pixelify Sans (títulos) + IBM Plex | Space Grotesk + Hanken Grotesk |
| Protagonista | Balance kanban / mapa | El mapa vivo | El kanban / los datos |
| Densidad | Media | Media-alta | Aireada |

Las tres cumplen: **light + dark + alto-contraste** desde los mismos tokens · acento
racionado · `tabular-nums` · 3 elevaciones · color persistente por agente · fallo de
primera clase · estado por icono+forma+etiqueta · motion sobrio · `prefers-reduced-motion`
· `aria` en español · **coherencia fluida con el pixel-art cálido fijo (Regla 3)**.

---

## 2. Tokens (esquema común a las 3 direcciones)

Tema desde **pocos tokens OKLCH** (estilo "Linear: de 98 variables a 3"):

- **Raíz:** `base` (canvas) · `accent` (el único acento) · `contrast` (texto). Tocar el
  acento no descuadra el contraste del texto.
- **3 superficies por elevación:** `--canvas` → `--panel` → `--card` (canvas → panel →
  tarjeta/popup).
- **Texto:** `--t1` / `--t2` / `--t3` (primario / secundario / terciario).
- **Bordes:** `--bd` (hairline 1px) / `--bd2` (fuerte).
- **Acento:** `--accent` / `--accent-text` (AA sobre canvas) / `--accent-bg` / `--on-accent`.
- **Semánticos:** `ok` / `warn` / `danger` / `info`, cada uno con `*-bg`.
- **Radio:** `--rsm` / `--rmd` / `--rlg` / `--rpill` (cambian por dirección).
- **Espaciado:** múltiplos de `0.25rem`; base `16px`; hairline `1px`.
- **Motion:** `--du`; duraciones `120 / 180 / 280ms`; easings `standard / entrance / spring`.
- **Agentes (10):** `--ag-<rol>` + `-text` + `-bg` + `-bd`. **Idénticos en las 3
  direcciones** (anclados al sprite, no a la dirección) → la identidad de cada agente es
  estable en todo el sistema.
- **Tiers:** `--tier0..4` (Bronce → Leyenda).

Light/dark se derivan invirtiendo L de las superficies y recalibrando texto/acento.
Alto-contraste = override de `--t1`/`--bd`/`--canvas`/`--accent-text` (sin rediseñar).

### Paleta de agentes (hue OKLCH, anclado al sprite)
`researcher 145` · `product-manager 300` · `designer 355` · `architect 250` ·
`backend-dev 195` · `frontend-dev 232` · `test-writer 65` · `reviewer 165` ·
`security-auditor 28`. El **gremio (operador)** usa el acento de la dirección.

---

## 3. Componentes permitidos (vocabulario)

- **Topbar del gremio:** marca + nivel/título + barra de XP (acento, *endowed progress*) +
  toggles de tema/alto-contraste + tabs. Una sola fila de KPIs (≤5) debajo, con indicador
  **Live/Stale** + timestamp.
- **Tabs / segmented controls** (`.tab`, `.seg`): acento solo en el activo.
- **Botones:** `.btn`, `.btn.primary` (**una sola acción primaria por pantalla**),
  `.btn.danger`. `.iconbtn` para acciones de icono (≥38px).
- **Superficies:** `.panel`, `.card`, `.col` (columna kanban).
- **Chips/badges:** `.chip` (tipo, tier, estado), `.tierbadge`, `.plate` (nivel).
- **Kanban:** `.kcard` (título + chip de tipo + score + indicador "construyendo").
- **Tabla de portfolio** (fase, versión, resumen, actualización).
- **Workspace:** navegador de documentos + bloque "Siguiente paso" (`.cmd` con botón
  Copiar) + `.decision` (punto de decisión con recomendación) + botón Descartar.
- **Mission Control:** `.station` (fondo de zona + borde de rol + rótulo, estados
  `dim`/`hot`), `.agent` (sprite + `.halo` + `.prog` + `.emote` + `.badge` + `.pkt`),
  contadores en vivo, toggle RPG ↔ Timeline/DAG (`.dag`, `.node` con `focus`/`fail`/`done`
  + "ir al primer error"), selector de modo.
- **Feed:** `.fe` con vocabulario icónico fijo (leer/escribir/editar/test ✅❌/arranque/
  fin/handoff/commit/review/blocked), color por agente, follow-tail, cap 60.
- **Logros:** `.stat` (tabular-nums), `.chain` (tier + `.pips` + barra al siguiente),
  "Casi ahí" (Zeigarnik), `.ach` (únicos por categoría; secretos con silueta + pista).
- **Config:** `.mode` (pro/equilibrado/potente/profundo), `.rcard` (nivel de agente).
- **Celebraciones (escalan):** `.toast` (work order) → `.celebrate` (fase) →
  `.celebrate` + confeti (release) → momento de **subir de nivel** (con versión
  reduced-motion).
- **Estados:** vacío (`.empty`), cargando (`.skel`), error (borde + icono `danger`).

---

## 4. Prohibiciones (lo que el sistema NO hace)

- ❌ **Más de un acento** o acento como "pintura". El acento es puntuación: tab activa,
  agente trabajando, barra de XP, acción primaria. El resto, neutros.
- ❌ **Más de una acción primaria** por pantalla.
- ❌ **Estado solo por color.** Siempre icono/forma + etiqueta (rojos/naranjas/ámbar
  cálidos están próximos).
- ❌ **Celebración plana** en cada acción. La celebración escala con la magnitud del logro.
- ❌ **Gamificación tóxica:** leaderboards, vidas/muerte, rachas diarias con reset,
  urgencia falsa/timers, barra "clavada al 80%", recompensas variables tipo tragaperras,
  notificaciones machaconas. Rachas (si hay) = semanales con freeze.
- ❌ **XP por volumen o por abrir la app.** XP solo por trabajo real verificable.
- ❌ **Barras desde 0** cuando hay avance real: *endowed progress* honesto.
- ❌ **Animar algo que no sea `transform`/`opacity`**, o durar ≥300ms, o usar curvas por
  componente. Nada de loops decorativos infinitos en contenido.
- ❌ **Inventar sprites o fondos de zona.** Los assets pixel-art son fijos; `reviewer` y
  `security-auditor` usan tinte de respaldo del color de rol, **no** arte nuevo.
- ❌ **Números sin `tabular-nums`.**
- ❌ **Iconos dibujados a mano / emoji como UI.** Iconografía = Tabler Icons (CDN). Pixel-art
  solo para los assets fijos.
- ❌ **Contraste < 4.5:1**, foco no visible, o `aria` que no esté en español.
- ❌ **Spinners de "IA pensando" / chat.** El cockpit es observación + lanzadera de
  comandos, nunca un asistente; nunca llama a Claude.

---

## 5. Reglas de convivencia con el pixel-art (Regla 3 — el corazón)

1. `image-rendering: pixelated` en todo sprite y fondo de zona.
2. Cada sprite vive en una **superficie enmarcada** con borde del **color de su rol**.
3. El **halo** bajo los pies replica la orientación de la sombra del sprite.
4. Los **fondos de zona** se atenúan (`dim`) cuando el agente no trabaja y se ven vívidos +
   sombra de acento (`hot`) cuando sí: el arte *es* el indicador de "quién trabaja".
5. El **acento** se mantiene en la familia cálida (terracota / oro / teal-pino) para que el
   sprite nunca parezca de otra app.
6. En light, canvas **cálido** (no blanco-frío) para asentar el contorno negro del sprite y
   la sombra; en dark, "gremio de noche" donde la atmósfera respira más.

---

## 6. Accesibilidad (resumen — detalle en `a11y-report.md`)

Contraste ≥4.5:1 (texto y agentes en ambos temas) · `aria-label` español ·
`aria-live="polite"` para el feed · foco visible que respeta el `border-radius` ·
navegación por teclado (tabs, tarjetas, modos) · touch ≥44px (`.iconbtn` 38–44, hit-area
holgada) · `prefers-reduced-motion` desactiva toda la animación de Mission Control y
muestra un snapshot estático con nota.
