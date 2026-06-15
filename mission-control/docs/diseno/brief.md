# Brief de diseño — Sistema de diseño de Mission Control de Pandacorp

Eres el **diseñador UX/UI de Pandacorp** (Claude Design). Tu trabajo es entregar el
**sistema de diseño completo** de Mission Control y 3 direcciones de mockups navegables,
con **light mode y dark mode** de primera clase, estética **RPG con gamificación
honesta**, y rigor de accesibilidad. El dueño es débil en diseño: tu trabajo es que
no tenga que serlo. **Investiga antes de diseñar.**

Corre este trabajo **dentro de `mission-control/`** (ahí están `docs/prd.md` y `docs/frds/`,
así que la precondición de `/pandacorp:design` ya está cumplida).

## ⚠️ Reglas que mandan sobre todo lo demás

1. **El prototipo `mission-control/prototype/index.html` es referencia SOLO de funcionalidad,
   contenido, pantallas y estados — NO de diseño visual.** NO tomes de ahí colores,
   tipografía, formas, layout ni "look". El resultado **puede y debe verse como una
   aplicación distinta**: otra paleta, otras formas, otra personalidad. La paleta es
   **libre y la decides tú a partir de la investigación** (esto **relaja** la nota de
   FRD-13 sobre "mantener la paleta cálida tipo Anthropic": ya no es un requisito —
   solo una opción más).

2. **Los sprites de personajes y los fondos de zona del Party son insumos
   FIJOS: se reusan tal cual, NO se inventan nuevos.** Están en
   `mission-control/prototype/assets/agents/*.png` (los 10 roles) y
   `mission-control/prototype/assets/zones/*.png` (zonas existentes). Son pixel-art 16-bit
   (SNES JRPG), de paleta **cálida**, y ya están perfectos. **No generes personajes ni
   fondos nuevos.**

3. **Coherencia con los sprites = requisito duro sobre las 3 direcciones.** Todo debe
   verse **bien y fluido junto a los sprites pixel-art cálidos**: nada que los haga ver
   pegados, disonantes o de otra app. La libertad de paleta de la regla 1 está
   **acotada por esta regla 3** — puedes explorar familias de color distintas, pero
   todas deben **armonizar con el pixel-art cálido JRPG**. Si una paleta hace que los
   sprites se vean fuera de lugar, está descartada. Resolver esta convivencia (chrome,
   fondos, halos, bordes que enmarcan los sprites) es el corazón del encargo.

---

## 1. Qué es la aplicación

El **Mission Control de Pandacorp**: una app web **local** (`127.0.0.1`, sin auth, sin
deploy) y **100% solo-lectura** para operar una "fábrica de software 100% IA".
Sirve para **ver** el estado de todas las ideas y proyectos, **leer** su
documentación, **saber qué comando ejecutar** a continuación (con botón Copiar), y
**seguir en vivo al "party" de agentes** construyendo — todo envuelto en una capa
de gamificación RPG **honesta**.

Regla de oro del producto: **Mission Control NUNCA llama a Claude**. Solo lee archivos
del repo y muestra texto de comandos para copiar. Esto importa para el diseño: no
hay spinners de "IA pensando" ni chat; es un **tablero de observación + lanzadera de
comandos**, no un asistente.

**Pestañas v1 (cubrir todas en los mockups):** Tablero (kanban de ideas, solo-
lectura), Portfolio (tabla de proyectos), **Logros** (salón de stats/logros),
Configuración (modos de construcción, niveles de agentes), Documentación. Más:
**workspace por proyecto** (detalle a página completa con navegador de documentos +
siguiente comando) y **Party RPG** (mapa en vivo de agentes).

## 2. Perfil del usuario (es el dueño, el único operador)

- **Operador único, hispanohablante.** Toda la UI y los `aria-label` en **español**.
- **Débil en UX/diseño** → la herramienta debe **guiar y deleitar**, no solo mostrar
  datos. No puede depender de que el usuario "tenga buen ojo": la restricción y los
  defaults hacen el trabajo.
- **Solo, sin equipo, uso diario.** La motivación importa: operar la fábrica solo
  desde la terminal es árido. La capa RPG existe para **sostener el hábito sin
  fatiga**, no para manipular.
- **Le gusta el mundo RPG / gamer.** Quiere genuinamente sentir que dirige un gremio
  y un party de personajes. Eso es un requisito, no un adorno — pero **la legibilidad
  de los datos va primero** (la gamificación complementa buena UX, nunca la compensa).
- **Sesiones potencialmente largas** mirando agentes trabajar → motion sobrio y
  `prefers-reduced-motion` son obligatorios para no cansar la vista.

## 3. Dirección creativa: RPG + gamificación honesta

- **Estética:** "gremio / campaña RPG" con alma de videojuego. La paleta, las formas y
  la personalidad visual son tuyas (decididas por investigación, §8), **pero todas las
  direcciones deben verse fluidas y coherentes con el pixel-art 16-bit cálido fijo**
  (regla ⚠️3). Piensa "panel de ingeniería con alma de RPG", no "videojuego que
  estorba": el sabor RPG se logra con tipografía, iconografía, microformas, jerarquía
  y el mapa pixel — **no** llenando todo de color.
- **Gamificación HONESTA (no tóxica) — restricciones duras:**
  - XP/niveles/logros representan **trabajo real verificable** (work order / fase /
    release cerrados, tests verdes), nunca por volumen ni por abrir la app.
  - La celebración **escala**: toast pequeño (work order) → animación media (fase) →
    celebración (release) → momento de **subir de nivel**. Nunca celebración plana en
    cada acción.
  - **PROHIBIDO:** leaderboards, vidas/muerte, rachas diarias con reset, urgencia
    falsa/timers, barra "clavada al 80%", recompensas variables tipo tragaperras,
    notificaciones machaconas. Las rachas (si hay) son **semanales con freeze**.
  - **Endowed progress honesto:** las barras arrancan mostrando el avance **ya
    logrado** (no en cero), porque corresponde a trabajo real.
  - El mayor activo intrínseco es **ver a los agentes trabajar en vivo**; el XP es
    capa secundaria de confirmación, no el gancho. Invierte el craft en la legibilidad
    del estado.

## 4. Light mode y dark mode (ambos de primera clase)

- Entrega **ambos temas**, derivados de los **mismos tokens** (no dos hojas de estilo
  divergentes). Toggle de tema visible y persistente; respeta `prefers-color-scheme`
  como default.
- En **ambos** temas: mantener **un único acento racionado**, los **colores por
  agente** (§6) y el contraste **≥4.5:1**, y asegurar que **el pixel-art cálido se vea
  bien y fluido sobre ambos fondos** (cuida halos/bordes/sombras que enmarcan los
  sprites; los sprites no cambian, así que el chrome se adapta a ellos).
- Diseña además un **modo alto-contraste** que salga "gratis" del esquema de tokens.
- El dark mode es donde la atmósfera RPG puede respirar más; el light mode es el
  "taller de día", limpio y legible. Ambos con la misma personalidad, no dos diseños.

## 5. Las 3 direcciones (exploración visual fresca, NO evolución del prototipo)

Genera **3 direcciones genuinamente distintas** — distintas de verdad: otra paleta,
otras formas, otra densidad, otra personalidad (no la misma con otro color). Todas
deben cumplir: RPG + gamificación honesta + light/dark + las restricciones de §6 +
**verse fluidas y coherentes con el pixel-art cálido fijo** (regla ⚠️3). Ejes de
variación posibles (decídelos tú): grado de "marco RPG" (sobrio tipo dashboard ↔
inmersivo tipo campaña); familia de paleta — **siempre dentro de lo que armoniza con
los sprites cálidos** (cálida clásica / tierra-apagada / cálida con un acento más
saturado…); formas (esquinas suaves modernas ↔ bordes pixel/duros); y qué es
protagonista (el kanban ↔ el mapa vivo). El prototipo **no** es una de las direcciones
ni un punto de partida visual.

## 6. Restricciones duras del sistema (FRD-13 + investigación 2026)

Son criterios de aceptación, **independientes de la paleta que elijas**:

- **Tema desde pocos tokens en OKLCH** (base / acento / contraste + superficies por
  elevación), estilo "Linear pasó de 98 variables a 3". Tocar el acento NO debe
  descuadrar el contraste del texto.
- **Un único acento racionado** ("puntuación, no pintura"): acento solo en lo
  importante (tab activa, agente trabajando, barra de XP, acción primaria). El resto,
  neutros. Una sola acción primaria por pantalla.
- **`font-variant-numeric: tabular-nums` en TODO número** (XP, niveles, conteos por
  columna, stats, timestamps).
- **3 niveles de elevación** (canvas → panel → tarjeta/popup) con escala tokenizada:
  radio base ~8px (0.5rem), espaciado en múltiplos de 0.25rem, base 16px, hairline 1px.
- **Color persistente por agente, reusado en TODA la UI** (sprite + feed + kanban +
  DAG). Define la paleta de los ~10 roles (researcher, backend-dev, frontend-dev,
  test-writer, reviewer, security-auditor, architect, product-manager, designer, +
  gremio) para light y dark, con AA. **Cada color de agente debe armonizar con el tono
  dominante de su sprite fijo**, para que el sprite y su código de color coincidan.
- **El fallo es un estado de primera clase**, tan visible como el logro (sprite caído
  + borde rojo + ❌, claramente distinto de "completado").
- **Ningún estado depende solo del color**: cada estado (trabajando / inactivo /
  fallido / completado / bloqueado / revisando) se empareja con **icono o forma +
  etiqueta**. Define un **vocabulario icónico fijo y acotado (~12 eventos)**:
  leer/escribir/editar/test ✅❌/arranque/fin, combinando evento + herramienta.
- **Motion sobrio y honesto:** solo `transform` y `opacity`, **<300ms**, 2–3 tokens de
  easing. **Frequency test**: lo cotidiano (tabs, hover) sobrio; lo expresivo reservado
  a eventos raros y satisfactorios (logro, subir de nivel, work order completada).
- **`prefers-reduced-motion`** desactiva TODA la animación de Party.
- **Accesibilidad:** contraste **≥4.5:1**, `aria-label` en **español**,
  `aria-live="polite"` para anunciar eventos sin robar foco, foco visible que respeta
  el `border-radius`, navegación de listas con teclado, touch targets ≥44px.
- **Header con ≤5 KPIs** + indicador **Live/Stale** con timestamp del último evento.
- **Toggle "RPG ↔ timeline/árbol"**: misma data, dos vistas. DAG con path-focus +
  go-to-failure.

## 7. Pantallas / estados a cubrir en los mockups

Con **textos reales** (nada de lorem ipsum) y los estados **vacío / cargando /
error** diseñados explícitamente:

1. **Tablero** — kanban de ideas por estado (solo-lectura, sin drag): título + chip
   de tipo + score.
2. **Workspace de proyecto** — detalle a página completa: cabecera, resumen con puntos
   clave, navegador de documentos renderizados, bloque "Siguiente paso" (comando +
   carpeta con botón Copiar), botón Descartar.
3. **Portfolio** — tabla de proyectos (fase, versión, resumen, última actualización).
4. **Party RPG** — el mapa vivo de agentes usando **los sprites y fondos de
   zona existentes** (estados trabajando/caminando/idle/bloqueado/revisando con halo,
   barra de avance, emotes, partículas), + toggle a vista timeline/DAG + selector de
   modo de construcción. Ver `mission-control/PARTY.md` para el modelo de estados.
   Nota: faltan los fondos de zona de `reviewer` y `security-auditor` (hoy usan un
   tinte de respaldo); **úsalo igual, NO inventes arte nuevo** — si algún día se
   generan, deberán imitar exactamente el estilo pixel existente.
5. **Salón de Logros** — stats que solo crecen, cadenas con tiers Bronce→Plata→Oro→
   Platino→Leyenda con barra al siguiente tier, sección "Casi ahí", logros únicos por
   categoría, logros secretos (silueta + pista; al desbloquear revelan su criterio).
6. **Configuración** — modos de construcción (pro/equilibrado/potente/profundo),
   niveles de agentes.
7. **Documentación** — visor de los documentos internos.
8. **Barra superior del gremio** — nivel y XP del operador con título y barra al
   siguiente nivel.
9. **Momentos de celebración** — toast de work order, celebración de release, y el
   **momento de subir de nivel** (con su versión `reduced-motion`).

## 8. Qué investigar (entrégalo en `referencias.md`)

Investiga colores, formas y demás **con libertad de paleta acotada a la coherencia con
los sprites cálidos** (regla ⚠️3):

- **Paletas y personalidades visuales** para un Mission Control RPG que **armonicen con
  pixel-art 16-bit cálido (JRPG)**: explora variantes (cálida clásica, tierra apagada,
  cálida con acento más saturado…) y propón candidatas con su racional, descartando las
  que harían ver los sprites fuera de lugar.
- **Cómo enmarcar pixel-art 16-bit en una UI moderna sin que choque** (problema
  central): bordes, halos, fondos, escalado nítido (`image-rendering: pixelated`), cómo
  el chrome moderno convive con sprites JRPG y se ve fluido.
- **Dashboards de ingeniería "restraint as a feature":** Linear (rediseño a ~3
  tokens), Vercel **Geist**, **Rauno** (interfaces.rauno.me), observabilidad multi-
  agente. De ahí salen acento racionado, elevación y motion.
- **Accesibilidad de la paleta elegida** en light y dark: mantener AA, derivar el par
  light/dark de los mismos tokens OKLCH, y distinguir ~10 colores de agente entre sí y
  del acento, estables en ambos temas y para daltonismo.
- **Iconografía y formas** coherentes con el sabor RPG pero legibles a tamaño pequeño.

Documenta 3–5 referencias con links y por qué cada patrón aplica a Mission Control.

## 9. Entregables (contrato de la fase `/pandacorp:design`)

1. `docs/diseno/referencias.md` — la investigación de §8.
2. `docs/diseno/design-tokens.json` — tokens en **OKLCH**, con **light + dark** (+
   alto-contraste), paleta de agentes, escala de elevación/espaciado/radio, tokens de
   motion. Base shadcn/ui; tweakcn.com como referencia de formato.
3. `DESIGN.md` (raíz del proyecto) — tokens + componentes permitidos + prohibiciones.
4. `docs/diseno/mockups/direction-{1,2,3}.html` — autocontenidos (CSS/JS inline, solo
   CDN de Tailwind), **navegables**, mobile-first, responsive, con toggle light/dark.
   3 direcciones **genuinamente distintas**, todas reusando los sprites/fondos fijos y
   viéndose fluidas junto a ellos.
5. **Verificación antes del gate:** screenshots a 375px y 1280px (Playwright) en
   `docs/diseno/mockups/screenshots/` + axe-core → `a11y-report.md`. **Corrige las
   violaciones serias (contraste, foco, aria) ANTES de presentar.**
6. Al elegirse una dirección: congela `design-tokens.json` final +
   `docs/diseno/decisiones-de-diseno.md` con el racional.

## 10. Archivos del repo que DEBES leer / usar

- `mission-control/prototype/assets/agents/*.png` y `mission-control/prototype/assets/zones/*.png` —
  **los assets fijos a reusar** (sprites de los 10 roles + fondos de zona).
- `mission-control/prototype/index.html` — referencia **solo de funcionalidad/contenido/
  pantallas/estados** (NO de diseño visual, ver regla ⚠️1).
- `mission-control/PARTY.md` — modelo de estados e indicadores del mapa RPG.
- `mission-control/docs/prd.md` y `mission-control/docs/frds/` (todos; en especial **FRD-06** Mission
  Control, **FRD-09** gamificación, **FRD-10** salón de logros, **FRD-12**
  observabilidad/data-viz, **FRD-13** sistema visual y accesibilidad — recordando que
  su línea de "paleta cálida Anthropic" queda relajada por decisión del dueño, pero la
  coherencia con los sprites cálidos sí manda).
- `mission-control/docs/logros.md` — lista de stats, tiers y logros (textos reales).
- `docs/propuestas/06-plan-de-mejoras-2026.md` — **Dimensión 5** (UI/UX y gamificación
  honesta): origen de casi todas las restricciones de §6.
- `fabrica/estandares/convenciones.md`, `fabrica/estandares/calidad.md`,
  `fabrica/constitucion.md`.

## 11. Gate humano (el dueño)

Al final, presenta las 3 direcciones (abre los HTML o muestra los screenshots, en
light y dark) y **espera la elección o feedback del dueño**. Itera si pide cambios.
No congeles el contrato hasta que él elija.
