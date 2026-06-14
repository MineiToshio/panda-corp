# Mission Control — Mapa RPG de agentes

Documenta el sistema de visualización de los subagentes de construcción en el cockpit
(`cockpit/prototype/index.html`, función `missionBody` y el motor `mc*`). El
objetivo es responder de un vistazo **qué agente trabaja y cuál está parado**,
manteniendo la estética RPG: los agentes son personajes pixel-art que caminan
por un gremio entre estaciones de trabajo.

## 1. Modelo de estados

Cada agente está siempre en uno de estos estados. El estado se refleja en la
clase CSS del sprite (`.mcag.s-<estado>`) y en un emote opcional sobre la cabeza.

| Estado | Clase | Qué se ve | Significa |
|---|---|---|---|
| Trabajando | `s-work` | En su escritorio, **halo** pulsante del color del rol + **barra de avance** llenándose. Alterna emote « … » (pensando) y sin emote (tecleando). | Está produciendo ahora |
| Caminando | `s-walk` | Cruza el mapa hacia otra estación cargando un **paquete** (`.pkt`, el contrato/artefacto). Rebote (bob) más rápido. | Handoff: transición de etapa del pipeline (p.ej. contrato listo → frontend) |
| En espera | `s-idle` | Sprite **apagado** (opacidad 0.45 + leve gris) + emote « z ». | Idle, esperando a otro |
| Bloqueado | `s-blocked` | Quieto + emote **« ! »** rojo rebotando (marcador de quest RPG) + halo rojo. | Necesita una decisión de Sergio |
| Revisando | `s-review` | Quieto + emote **« ? »** ámbar + halo ámbar. | El reviewer espera/evalúa una entrega |

Convención de color universal (coincide con el resto de herramientas del
mercado): **ámbar = trabajando**, **azul = en tránsito**, **gris/apagado =
idle**, **rojo = requiere atención humana**.

## 2. Vocabulario de indicadores

Cinco indicadores, combinables. Definidos en el bloque CSS `Mission Control —
mapa RPG` y controlados por el motor.

- **Halo** (`.mcag .halo`): elipse pulsante bajo los pies. Solo en `work`,
  `review`, `blocked`. Es el indicador que más comunica "ocupado" de lejos.
- **Barra de avance** (`.mcag .prog`): barra flotante sobre la cabeza que se
  llena de 0→100% durante el turno de trabajo. Solo en `work`.
- **Emotes** (`.mcag .emote`): burbuja sobre la cabeza. `…` pensando (azul),
  `?` por revisar (ámbar), `!` bloqueado (rojo), `z` en espera (gris).
- **Puesto de trabajo** (`.mcstation`): cada agente tiene un **puesto fijo** con
  **fondo pixel-art** (la imagen de zona en `IMG[ZONEBG[rol]]`), borde del color
  del rol y un **rótulo fijo** (ícono + nombre). El rótulo vive en el puesto, no
  en el agente, así que el área **sigue identificada cuando el agente se va** a
  un handoff. El fondo se **atenúa** (`.dim`: gris + opacidad) cuando el dueño
  NO está trabajando ahí, y se ve **vívido + halo** (`.hot`) cuando trabaja —
  esto es lo que más comunica "quién trabaja" de lejos. Los roles sin imagen de
  zona aún (`reviewer`, `security-auditor`, `analytics`) usan un tinte de color
  de respaldo. Igual, los agentes sin sprite propio (`analytics`) caen al sprite
  genérico del `implementer` vía `mcSprite()`, distinguidos por su halo de color.
- **Partículas** (`.mcpt`): estallido de puntos del color del rol cuando se
  entrega un handoff. Puramente cosmético.

Contadores en vivo (`#mc-cnt`): pills `N trabajando / N caminando / N en espera
/ N bloqueado`, recalculados cada ~260 ms desde el estado real de los sprites.

## 3. Mapa y modos

- **Layout en anillo, centro vacío** (`mcRing`): los puestos se reparten
  uniformemente en una elipse alrededor de un centro vacío. Los handoffs
  **enrutan por el centro** (`MCCENTER`): el iniciador camina `puesto → centro →
  junto al destino` (`mcApproach`), entrega, y vuelve `→ centro → su puesto`.
  Como todo cruza solo el centro vacío, **ningún camino pasa por encima del área
  de trabajo de otro agente**. No hay mesa central visible — el centro es solo
  un punto de ruteo.
- **El roster son los subagentes REALES de `implement`** (ver el skill
  `plugin/skills/implement/SKILL.md`), no todos los agentes de la fábrica. PM,
  diseñador, arquitecto, **copywriter** y **devops** son de fases anteriores o
  de release (spec / diseño / blueprint / release) y **no construyen**, por eso
  no aparecen en el mapa de construcción. El único agente "de soporte" que sí
  entra al build es **analytics** (instrumenta la telemetría sobre la marcha).
- **Modo de construcción → esfuerzo del equipo** (`MCROSTER`, leído de
  `ST.modes[slug]`; los 4 modos coinciden con el skill):
  - `pro` (económico): implementer (full-stack) + reviewer (2) — sin paralelismo,
    dividir no aporta; un solo obrero hace todo y el reviewer revisa al cerrar.
  - `equilibrado` (default): backend-dev, frontend-dev, test-writer, reviewer (4).
  - `potente`: + researcher + analytics (6) — investigación y telemetría entran a demanda.
  - `profundo`: + researcher + analytics (6) — máxima calidad; la Revisión corre
    en 3 lentes concurrentes (el reviewer se agranda y los demás esperan).

  El **selector de esfuerzo** vive en la propia pestaña Mission Control (fila
  `data-act="bmode"`); cambia `ST.modes[slug]` (es **por proyecto**) y re-monta
  el mapa con el nuevo party.

## 4. Cola de animación desacoplada (clave)

El estado **visual** está desacoplado del estado **real**. El motor encola
instrucciones de movimiento y las consume a su propio ritmo:

- Cuando un agente inicia un handoff, el registro (`mcFeed`) escribe
  **`✓ listo` de inmediato** (estado real), pero el muñeco todavía tarda ~2.5 s
  en caminar y entregar. La caminata es **cosmética**.
- Si la tarea real termina antes, el muñeco igual completa el viaje y vuelve a
  su escritorio. La información puede verse desfasada unos segundos; es
  intencional y aceptable.

Esto significa que cuando esto se conecte a datos reales, el cockpit **no**
necesita eventos en tiempo real perfectos: basta con un *stream* de eventos
(`started_task`, `handoff(from,to)`, `blocked`, `completed`, `needs_input`) que
el motor traduce a animaciones. La fidelidad temporal es secundaria a la
legibilidad.

### Contrato de integración (prototipo → datos reales)

El motor (`MC`, `mcBoot`, `mcLoop`, `mcSetState`, `mcStartHandoff`) hoy corre con
un *director* que genera eventos plausibles. Para conectarlo a la construcción
real, reemplazar ese director por el consumo de los eventos que la construcción
ya emite a `~/.claude/dashboard-events.ndjson`: con **Dynamic Workflows** los
emiten los subagentes del workflow (`emit-event.sh` al empezar/terminar su
etapa) y el hook `SubagentStop` — **no** los hooks de Agent Teams
(`TeammateIdle`/`TaskCreated`/`TaskCompleted`, que no disparan en workflows). La
emisión es fire-and-forget (append a archivo): no bloquea el workflow, así que el
mapa RPG no cuesta rendimiento. El mapeo evento → animación:

| Evento real del agente | Acción visual |
|---|---|
| empieza work order | `mcSetState(agent,'work')` |
| publica contrato / pasa trabajo a X | `mcStartHandoff(agent)` con `target=X` |
| termina, sin nada pendiente | `mcSetState(agent,'idle')` |
| choca con punto de decisión | `mcSetState(agent,'blocked')` |
| reviewer recibe entrega | `mcSetState(reviewer,'review')` |

## 5. Ciclo de vida en el cockpit

- `render()` llama a `mcBoot()` al final. `mcBoot` busca `#rpg-scene`; si existe,
  reconstruye `MC.agents` desde el DOM y arranca un `requestAnimationFrame`.
- Cada `render()` incrementa `MC.runId`; el loop viejo se detiene solo
  (`if(myId!==MC.runId)return`). Así no se acumulan loops al re-renderizar.
- **Pausar/Reiniciar** (`rpgpause`/`rpgreset`) actúan sin re-render para no
  reiniciar la escena.
- Si la pestaña no está visible, el navegador pausa `requestAnimationFrame`
  (la animación se congela hasta volver). Es comportamiento normal del
  navegador, no un bug.

## 6. Imágenes

Los **sprites de agente** (`IMG[<rol>]`, 96×96 RGBA) existen para los 13 agentes,
incluidos los 3 nuevos (`copywriter`, `analytics`, `devops`) — se cortaron de
`assets/agents/grid-v2.png` y se embebieron como base64. Los **fondos de puesto**
(`IMG[ZONEBG[rol]]`, 320×320 RGBA, de `assets/zones/`) existen para:

- `researcher` → `investigacion` ✓
- `test-writer` → `testing` ✓
- `backend-dev` → `backend` ✓
- `frontend-dev` → `frontend` ✓
- `reviewer` → `revision` ✓ (sala de control de calidad — cortada de `zones-grid-v2.png`)
- `analytics` → `analitica` ✓ (observatorio / cámara de datos)

**Pendiente menor:** la sala de `security-auditor` (`seguridad`) está cortada en
`assets/zones/seguridad.png` pero **no embebida** todavía, porque `security-auditor`
no está en el roster del build (`MCROSTER`); se embebe y se mapea en `ZONEBG` solo
si algún día entra al mapa de construcción. `copywriter` y `devops` no necesitan
sala (no aparecen en el mapa de construcción).

Estilo a respetar para que peguen: **pixel-art top-down 16-bit (estilo SNES JRPG)**,
una sala vista desde arriba, alfombra central con brújula, props en las paredes,
paleta cálida, 320×320 px, sin personajes, sin texto. Pipeline para regenerar:
generar la hoja (sprites 1024×1024 transparente 2×2 · zonas 1254×1254 opaca 2×2),
cortar por cuadrante con PIL, reescalar (96 / 320), base64 → `IMG`, mapear `ZONEBG`.
