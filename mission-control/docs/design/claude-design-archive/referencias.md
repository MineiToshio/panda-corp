# Referencias de diseño — Cockpit de Pandacorp

> Investigación previa al diseño (encargo §8). Decide la dirección visual del cockpit:
> un **panel de ingeniería con alma de RPG** que conviva de forma fluida con los
> **sprites pixel-art 16-bit cálidos fijos** (`assets/agents/*.png`, `assets/zones/*.png`).
> La paleta es libre (Regla 1) pero **acotada por la coherencia con esos sprites** (Regla 3).

---

## 0. El problema central: enmarcar pixel-art 16-bit en una UI moderna sin que choque

Los sprites son JRPG tipo SNES: **paleta cálida y saturada**, **contornos negros gruesos**,
sombreado por bandas (cel-shading), y una **sombra elíptica** bajo los pies. Los fondos de
zona son **interiores top-down** (piedra, madera, alfombras, hierro, frascos) muy ricos y
oscuros-cálidos. Cualquier chrome que los rodee tiene que **parecer del mismo mundo**.

Patrones que adopto (y por qué):

1. **El chrome se adapta a los sprites, no al revés.** Los sprites no cambian entre temas;
   por eso el fondo (canvas/panel) se elige para que el contorno negro del sprite siempre
   tenga contraste suficiente y la sombra elíptica no "flote". En light, un canvas demasiado
   blanco-frío hace ver el sprite "pegado"; un blanco **cálido** (papel) lo asienta.
2. **`image-rendering: pixelated` siempre** en sprites y fondos de zona, y escalar a
   **múltiplos enteros** del tamaño base cuando se pueda, para que el pixel-art se vea
   nítido y no borroso/interpolado (regla clásica de pixel-art en pantallas HiDPI).
3. **Marco explícito tipo "ficha de personaje".** Cada sprite vive en una superficie con
   borde + leve inset, no suelto sobre el canvas. El borde puede tomar el **color del rol**
   (ver §2), de modo que el marco *explique* el sprite en vez de competir con él.
4. **Halos y "puestos de trabajo" como puente.** El indicador de estado (halo elíptico bajo
   los pies, igual orientación que la sombra del sprite) es lo que más comunica "ocupado"
   de lejos, y al ser una forma orgánica encaja con el arte sin parecer un widget de
   dashboard. Los fondos de zona se **atenúan** cuando el agente no trabaja ahí y se ven
   **vívidos + halo** cuando sí: el propio arte se vuelve el indicador.
5. **El acento de la UI se elige cerca de la familia cálida del arte** (terracota / oro /
   teal-pino), nunca un azul-violeta SaaS genérico que haría ver los sprites como de otra app.

---

## 1. Paletas y personalidades candidatas (armónicas con pixel-art cálido JRPG)

Probé tres familias. Las tres mantienen **canvas cálido** y **agentes cálidos**; cambian la
personalidad, las formas y qué es protagonista. (Detalle de tokens en `design-tokens.json`.)

| # | Nombre | Familia de paleta | Personalidad | Acento | Riesgo evitado |
|---|---|---|---|---|---|
| **D1** | **Pergamino** | Cálida clásica (papel/tinta marrón) | Dashboard sobrio con alma de pergamino; serif humanista | **Terracota/ascua** (echo de las forjas y del rojo del diseñador) | Que el RPG "estorbe": el sabor está en tipo + microformas, no en color |
| **D2** | **Cripta** | Tierra apagada (oliva, arcilla, pizarra, ceniza) | Inmersivo "gremio de noche"; menú JRPG; bordes pixel duros | **Oro de quest** (+ verdigris secundario) | Pixel-art que se ve "pegado" sobre chrome plano: aquí el chrome también es pixel/biselado |
| **D3** | **Atelier** | Neutro cálido moderno + acento joya | SaaS limpio (Linear/Geist) con RPG de guarnición; aireado | **Teal-pino** (echo de la biblioteca verde + la forja teal) | Densidad excesiva: máxima legibilidad, kanban protagonista |

**Descartadas** (harían ver los sprites fuera de lugar): púrpura-índigo neón / gradientes
fríos saturados (chocan con el negro de contorno y la calidez); blanco-azulado puro de alto
brillo en light (hace flotar la sombra del sprite); cualquier acento pastel desaturado (no
sostiene el "acento como puntuación" ni la barra de XP).

---

## 2. Color persistente por agente (10 roles) — derivado del tono dominante de cada sprite

Cada rol tiene **un solo color**, anclado al tono dominante de su sprite fijo, reutilizado en
TODA la UI (sprite ↔ feed ↔ kanban ↔ DAG). Definidos en OKLCH para mantener el **mismo
hue** en light y dark variando solo L y C, y para garantizar AA sobre ambas superficies.

| Rol | Sprite (tono dominante) | Hue OKLCH | Racional |
|---|---|---|---|
| researcher | mago de túnica verde | ~145° verde | hoja/biblioteca |
| product-manager | capa púrpura | ~300° violeta | estrategia |
| designer | gorro rosa-carmín + paleta | ~355° magenta-rosa | separado del rojo de seguridad |
| architect | azul + plano | ~250° azul | plano/blueprint |
| backend-dev | gafas teal + forja | ~195° teal | hierro/forja |
| frontend-dev | rubio + pantalla cian | ~232° azur | pantalla brillante |
| test-writer | capucha marrón + pociones | ~65° ámbar | alquimia/probetas |
| reviewer | escudo plata + check | ~165° esmeralda | "verde de QA" (MISSION-CONTROL.md), distinto del researcher |
| security-auditor | armadura roja + candado | ~28° rojo | alerta/seguridad |
| gremio (operador) | — | = acento de la dirección | el "color del jugador" |

Spread de hue (28·65·145·165·195·232·250·300·355) ⇒ 9 matices bien separados. Los pares
más cercanos (architect 250 ↔ frontend 232; researcher 145 ↔ reviewer 165) se separan además
por **L/C** y **nunca aparecen adyacentes sin etiqueta + sprite**. Para **daltonismo**: rojo
(28) y verde (145) son la adyacencia clásica de riesgo, mitigada porque **ningún estado ni
identidad depende solo del color** — siempre hay icono/forma + etiqueta + el propio sprite.

---

## 3. Estado por icono + forma + etiqueta (nunca solo color) — vocabulario fijo

Crítico con paleta cálida (rojos/naranjas/ámbar próximos). Vocabulario icónico acotado
(~12 eventos, set **Tabler Icons**, ver §5):

| Estado / evento | Forma + icono | Etiqueta |
|---|---|---|
| Trabajando | halo pulsante (color rol) + barra de avance + `ti-tool` | "Trabajando" |
| En tránsito (handoff) | paquete `ti-package` cruzando el mapa | "En tránsito" |
| En espera (idle) | sprite atenuado + emote `z` | "En espera" |
| Bloqueado | halo rojo + `!` rebotando `ti-alert-triangle` | "Bloqueado" |
| Revisando | halo ámbar + `?` `ti-eye` | "Revisando" |
| Completado | `ti-circle-check` (verde) | "Completado" |
| **Falló (1ª clase)** | **sprite caído/desaturado + borde rojo + `ti-x` (❌)** | **"Falló"** — visualmente ≠ "Completado" |
| leer · escribir · editar | `ti-book` · `ti-pencil` · `ti-edit` | en el feed |
| test ✅ · test ❌ | `ti-test-pipe`+`ti-check` · `ti-test-pipe`+`ti-x` | en el feed |
| arranque · fin | `ti-player-play` · `ti-flag-check` | en el feed |

---

## 4. Referencias externas (3–5, con por qué aplican)

1. **Linear — rediseño "de 98 variables a 3" (`linear.app/now/how-we-redesigned-the-linear-ui`).**
   Tema derivado de **pocos tokens en espacio perceptual** (base/acento/contraste + superficies
   por elevación). *Aplica:* mis 3 direcciones comparten un esquema de ~3 tokens raíz en OKLCH;
   tocar el acento no descuadra el contraste del texto y el modo alto-contraste sale "gratis".
2. **Vercel Geist — "restraint as a feature" (`designsystems.one/design-systems/vercel-geist`).**
   Acento racionado ("puntuación, no pintura") + `tabular-nums` en todo número = credibilidad de
   ingeniería casi gratis. *Aplica:* un solo acento por dirección, una sola acción primaria por
   pantalla, `font-variant-numeric: tabular-nums` global.
3. **Rauno Freiberg — `interfaces.rauno.me`.** Microinteracciones honestas, foco visible que
   respeta el `border-radius`, motion sobrio. *Aplica:* tokens de motion (`<300ms`, solo
   `transform`/`opacity`, 2–3 easings) y *frequency test* (lo cotidiano sobrio; lo expresivo
   reservado a logro/nivel/WO completada).
4. **Observabilidad multi-agente (`github.com/disler/claude-code-hooks-multi-agent-observability`).**
   Color persistente por agente, vocabulario icónico acotado, fallo como estado de primera clase,
   feed con follow-tail + cap. *Aplica:* §2 y §3 completos; header con ≤5 KPIs + indicador
   **Live/Stale** con timestamp del último evento.
5. **Octalysis "White Hat" (`yukaichou.com`) + efectos Zeigarnik / Endowed Progress
   (`learningloop.io`).** *Aplica:* gamificación honesta — XP por resultado verificable, barras
   que **arrancan en el avance ya logrado**, celebración que **escala** (toast → fase → release →
   subir de nivel), y prohibiciones (sin leaderboards, rachas diarias, urgencia falsa, recompensas
   variables, barra "clavada al 80%").

---

## 5. Iconografía y formas con sabor RPG pero legibles a tamaño pequeño

- **Set único: Tabler Icons (webfont vía CDN).** ~4.900 iconos, trazo 2px consistente, muy
  legibles a 14–16px; el prototipo ya lo usa (`ti ti-*`), así que es coherente con el ecosistema.
  Da vocabulario "de quest" (`ti-trophy`, `ti-flame`, `ti-shield-check`, `ti-map-2`, `ti-sword`,
  `ti-bolt`) sin tener que dibujar SVGs a mano. **No** se dibujan iconos propios ni se usa emoji.
- **Pixel-art solo para los assets fijos** (sprites + zonas). El resto de la iconografía es
  vectorial Tabler, para no degradar la legibilidad de datos.
- **Microformas que dan el sabor:** "pips" de tier (puntos), badges de nivel tipo placa,
  barras de XP/avance con esquinas según la dirección (suaves en D1/D3, duras/biseladas en D2),
  marcos de ficha de personaje, y emotes-burbuja sobre los sprites (`…`, `?`, `!`, `z`).

---

## 6. Accesibilidad de la paleta (light + dark, AA, daltonismo)

- **Light y dark derivados de los mismos tokens OKLCH** (no dos hojas divergentes): el par se
  obtiene invirtiendo L de las superficies y ajustando L/C del texto y el acento.
- **Contraste ≥ 4.5:1** para texto sobre toda superficie; los colores de agente se calibran a
  dos lightness (uno para texto/borde sobre canvas claro, otro para canvas oscuro).
- **~10 colores de agente distinguibles** entre sí y del acento, estables en ambos temas; para
  daltonismo, identidad y estado siempre con **icono/forma + etiqueta** además del color.
- **Modo alto-contraste** que sube el contraste del texto y engrosa hairlines, derivado del mismo
  esquema (un override de variables, sin rediseñar).
- `aria-label` en **español**, `aria-live="polite"` para eventos, foco visible que respeta el
  `border-radius`, navegación por teclado, touch targets ≥44px, `prefers-reduced-motion` que
  desactiva toda la animación de Mission Control.

*(Auto-chequeo de contraste/foco/aria por dirección en `a11y-report.md`.)*
