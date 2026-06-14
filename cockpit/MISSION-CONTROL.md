# Mission Control — Mapa RPG de agentes

Documenta el sistema de visualización del equipo de agentes en el cockpit
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
| Caminando | `s-walk` | Cruza el mapa hacia otra estación cargando un **paquete** (`.pkt`, el contrato/artefacto). Rebote (bob) más rápido. | Handoff real entre agentes |
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
- **Tinte de piso** (`.mcrug`): alfombra del color del rol bajo cada estación.
  Se **ilumina** (`.hot`, opacidad 0.13→0.30) cuando su dueño trabaja ahí.
- **Partículas** (`.mcpt`): estallido de puntos del color del rol cuando se
  entrega un handoff. Puramente cosmético.

Contadores en vivo (`#mc-cnt`): pills `N trabajando / N caminando / N en espera
/ N bloqueado`, recalculados cada ~260 ms desde el estado real de los sprites.

## 3. Mapa y modos

- **Estaciones**: cada rol tiene un escritorio fijo (`MCHOME`) alrededor de una
  **Mesa de reunión** central (`MCHUB`). Los handoffs pasan por el centro:
  el iniciador camina `home → centro → escritorio destino`, entrega, y vuelve
  `escritorio destino → centro → home`.
- **Modo de construcción → tamaño del party** (`MCROSTER`, leído de
  `ST.modes[slug]`):
  - `pro` (económico): 3 agentes — PM, Backend, Frontend.
  - `equilibrado` (default): 5 — PM, Arquitecto, Backend, Frontend, Testing.
  - `potente`: 9 — todo el roster.

  > Nota: hoy el cockpit tiene 3 modos de build (`BUILDMODES`). Si más adelante
  > se define un 4.º modo "profundo", basta con añadir su roster a `MCROSTER`.

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
real, reemplazar ese director por el consumo de eventos reales mapeando:

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

El sistema funciona con los **sprites pixel-art existentes** (`IMG[<rol>]`, los
9 roles) — no requiere imágenes nuevas. Mejoras visuales opcionales y sus
prompts de generación están al final de este documento, en el README del
cockpit / en el chat de diseño.
