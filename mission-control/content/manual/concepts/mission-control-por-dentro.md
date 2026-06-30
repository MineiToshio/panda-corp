---
title: "Mission Control por dentro"
group: concepts
order: 6
---

# Mission Control por dentro

Mission Control es la interfaz de control de la fábrica. Vive dentro del repositorio `panda-corp/mission-control/` y es una aplicación Next.js con App Router. Esta página explica su estructura interna.

## Secciones principales

| Sección | Ruta | Qué muestra |
|---|---|---|
| Inicio | `/` | Tablero de ideas en columnas Kanban |
| Proyecto | `/projects/[slug]` | Estado detallado de un proyecto activo |
| Portfolio | `/portfolio` | Lista de todos los proyectos con su fase |
| Manual | `/manual` | Esta documentación navegable |
| Configuración | `/configuration` | Skills, agentes, reglas, estándares derivados |

## La sección de Proyecto

Cada proyecto tiene una página con tabs:

- **Comandos** — los comandos recomendados para la fase actual, con botón de copia.
- **Work Orders** — tablero Kanban de WOs (PLANNED / IN_PROGRESS / IN_REVIEW / VERIFIED / BLOCKED).
- **Party** — los agentes del equipo animados con su estado en tiempo real.
- **Observabilidad** — **grafo de dependencias entre WOs en 2D** (cada FRD es una caja con sus work orders dentro, ubicadas en 2D; deps internas WO→WO y deps entre FRDs agregadas a una línea FRD→FRD; al hacer clic en un WO se resaltan sus relaciones con colores), freshness badge, y **línea de tiempo de la construcción** (FRD ▸ work order + revisión, con duraciones reales del track durable `.pandacorp/track.jsonl`; si el proyecto no tiene track, se reconstruye del historial de git con duraciones **estimadas** bajo bandera honesta, y si tampoco hay commits de build, una vista estructural sin duraciones).
- **Documentos** — navegador de los docs del proyecto (`docs/frds/`, `docs/product/`).

## La card de una idea (en el tablero)

Al hacer clic en una idea del tablero se abre su detalle, también con tabs. Las dos primeras son nativas (renderizadas con el diseño de Pandacorp, no un visor de markdown) y aparecen **según la fase** del proyecto:

- **Propuesta** — el memo-pitch *caliente → frío* de la idea (por defecto).
- **Spec** — resumen visual del PRD + research + FRDs; aparece cuando existe `.pandacorp/comms/spec-resumen.md` (fase product en adelante).
- **Arquitectura** — resumen visual de la arquitectura; aparece cuando existe `.pandacorp/comms/arquitectura-resumen.md` (fase architecture en adelante). Una sola pantalla: stack, modelo de datos (con la rama "Sin BD"), comunicación/servicios, **variables de entorno** y **ADRs** (en vivo de `.env.example` y `docs/adr/*`), el **plan de implementación** como grafo DAG de las work orders (reutiliza el mismo DAG de Observabilidad), y una ficha por FRD con su blueprint, sus WOs y —si tiene más de una— su sub-DAG de dependencias.
- **Documentos** — navegador de los docs del proyecto.
- **Campaña** — la vista "La Campaña" con la fase activa y el siguiente comando.

## Cómo lee los datos

Mission Control lee el sistema de ficheros de la fábrica directamente — no tiene base de datos propia. Los módulos de lectura viven en `lib/`:

| Módulo | Qué lee |
|---|---|
| `lib/projects.ts` | `factory/portfolio.md` + `.pandacorp/status.yaml` de cada proyecto |
| `lib/ideas.ts` | `factory/ideas/*.md` |
| `lib/work-orders.ts` | `docs/frds/*/work-orders/*.md` del proyecto |
| `lib/architecture/*` | `.pandacorp/comms/arquitectura-resumen.md` + `docs/adr/*` + `.env.example` (pestaña Arquitectura) |
| `lib/events.ts` | `~/.claude/dashboard-events.ndjson` |
| `lib/reference.ts` | `plugin/skills/*/SKILL.md` + `plugin/agents/*.md` |
| `lib/registry.ts` | `factory/decisions/registry.yaml` |
| `lib/standards.ts` | `factory/standards/*.md` |
| `lib/manual.ts` | `content/manual/**/*.md` (este Manual) |

Todo son lecturas puras — `fs.readFileSync`, sin escrituras, sin llamadas a la API de Claude.

## El Party panel

El Party panel muestra los agentes del equipo con avatares pixel-art animados. Los eventos llegan desde `~/.claude/dashboard-events.ndjson` (fichero NDJSON al que los agentes escriben con `printf`). El panel usa un loop de animación RAF para:

- **Breathing** — movimiento de reposo cuando el agente está activo.
- **Wander** — deambulación aleatoria en su zona.
- **Handoff** — animación de handoff entre agentes cuando pasan una WO.
- **Achievement** — celebración al completar una WO.
- **Down** — postura de error cuando hay un fallo.

## El Manual (esta página)

El Manual sigue la estructura Diátaxis: Tutorial, Guías, Referencia, Conceptos. Los catálogos de Referencia (comandos, agentes, reglas, estándares) se derivan de la fuente canónica en cada render — nunca se copian a mano (DR-046). Las páginas de Tutorial / Guías / Conceptos son ficheros `.md` en `content/manual/`.

## Invariantes de diseño

- **Solo lectura** — Mission Control nunca ejecuta código, nunca llama a Claude, nunca escribe (salvo el `status: discarded` de una tarjeta, FRD-02).
- **Design tokens únicamente** — todo color, espaciado y tipografía viene de `docs/design/design-tokens.json`.
- **Server Components por defecto** — `"use client"` solo cuando la interactividad lo requiere (estado, eventos del navegador).
- **Sin hardcoded copies** — los catálogos de Referencia se derivan; los textos de UI son i18n.
