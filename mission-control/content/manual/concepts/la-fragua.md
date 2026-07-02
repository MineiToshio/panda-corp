---
title: "La Fragua (el Party)"
group: concepts
order: 19
---

# La Fragua — el Party en vivo

La pestaña **Party** de un proyecto es **La Fragua**: un mapa RPG en pixel-art donde ves a tu
party de agentes construyendo el proyecto **en tiempo real**. No es una animación de adorno: cada
cosa que se mueve está anclada a una señal real del build. Esta página explica qué ves, de dónde
sale cada dato y cómo saber si lo que miras está vivo.

## La regla de oro: la decoración nunca finge medición

Todo lo que aparece en la escena es una de dos cosas:

- **Dato real** — viene de un archivo o evento concreto del build (abajo está el mapa completo).
- **Decoración pura** — el humo de la chimenea y el panda que pasea por abajo. No codifican nada,
  y por eso no intentan parecer datos.

No existe una tercera categoría. Si algo parece información, **es** información. Si el build no
emitió la señal, la escena muestra el vacío honesto (una sala fría, una banca vacía), nunca un
valor inventado.

## Qué ves y de dónde sale

| Elemento | Qué significa | Fuente real |
|---|---|---|
| **Herreros en la Sala de Forja** | Órdenes de trabajo construyéndose AHORA (la oleada activa, puede mezclar varios FRDs a la vez) | El frontmatter de las work orders (`implementation_status: IN_PROGRESS`) |
| **Banda de color bajo cada sprite** | A qué FRD pertenece esa orden | El `parent` de la work order (paleta fija de 13 colores) |
| **Burbuja de diálogo** | La orden "habla" cada ~6 s: su id y su tiempo real al fuego ("12 min al fuego") | `track.jsonl` — el registro durable de tiempos del build |
| **Tribunal del Juez** | Órdenes esperando o pasando revisión; la cola de gates (los gates corren de a UNO, serializados) | Frontmatter `IN_REVIEW` + eventos de gate del motor |
| **El mensajero (pergamino volador)** | Una orden acaba de quedar VERDE y committeada — el pergamino corre de la forja al tribunal | El evento real `wo_commit` del motor (nunca un replay viejo) |
| **Enfermería** | Órdenes BLOQUEADAS descansando hasta que decidas algo | Frontmatter `fail`/BLOCKED — el fallo es visible, nunca escondido en un "+N en cola" |
| **Bóveda de trofeos** | Las últimas órdenes VERIFICADAS (y "+N arch." para las anteriores) | Frontmatter `VERIFIED` |
| **Cinta de Campaña (arriba)** | Todos los FRDs del build con su estado: 🔥 forjando · ⚖️ en tribunal · 🏆 completo · ⛔ bloqueado | Derivado de TODAS las work orders del proyecto |
| **Contador global** | Órdenes hechas / totales | El mismo derivador que usa el Kanban (una sola fuente, nunca dos cuentas distintas) |
| **La bitácora (abajo)** | El relato de eventos del build, filtrado a ESTE proyecto | `~/.claude/dashboard-events.ndjson` (los emisores del motor y los hooks) |

## El badge de frescura: en vivo, hace N min, sin señal

Arriba de la escena hay un chip que declara **qué tan fresco es lo que estás viendo**:

- **● en vivo** — la última señal del build (heartbeat del supervisor o evento) tiene menos de
  3 minutos.
- **○ datos de hace N min** — hay señal, pero envejecida. Lo que ves es real, solo que de hace
  un rato; el chip te dice cuánto.
- **○ sin señal** — pasaron más de 10 minutos sin ninguna señal. Aunque el estado diga
  "corriendo", nadie lo respalda: revisa el build antes de confiar.

Esta es la regla DR-066 de la fábrica: **un monitor nunca presenta una bandera auto-reportada
como prueba de vida**. "Corriendo" solo cuenta si la recencia lo respalda.

## Por qué la escena nunca se congela "en falso"

Dos canales alimentan la vista en vivo:

1. **Eventos** — cada transición del motor (agente trabajando, gate abierto, logro, commit)
   llega por streaming y refresca la escena.
2. **El estado en disco** — a veces el build avanza SIN emitir evento (un arranque en frío, un
   gate largo reescribiendo work orders). El transporte vigila también `status.yaml` y el
   frontmatter, y avisa cuando se mueven. Así el Party no se ve "muerto" mientras el build sí
   avanza.

Y al revés: cuando el build está APAGADO, un eco viejo de eventos no puede reactivar la escena —
la fuente de verdad de encendido/apagado es `status.yaml`, cruzada con el heartbeat.

## Para profundizar

- El contrato de requisitos: `docs/frds/frd-06-party/frd.md` (REQ-06-019).
- El mapa técnico completo (qué archivo alimenta qué, el loop de render, el presupuesto de
  performance): `docs/frds/frd-06-party/blueprint.md` §7.
- El lado productor (quién emite los eventos y el heartbeat): el estándar de observabilidad de
  la fábrica (`factory/standards/observability.md`).
