---
title: "El pipeline"
group: concepts
order: 2
---

# El pipeline

El pipeline es la secuencia de fases que lleva una idea desde su descubrimiento hasta la operación en producción. Cada fase produce artefactos versionados y requiere aprobación del propietario antes de avanzar.

## Las fases

```
product → design → architecture → build → release → operation
```

### 1. Product

Se documenta la visión del producto: **PRD** (Product Requirements Document) con objetivos, métricas de éxito, hipótesis de valor y el mapa de funcionalidades. Se generan los **FRDs** (Feature Requirements Documents) con criterios de aceptación en formato EARS para cada funcionalidad.

Habilidades: `/pandacorp:spec`, `/pandacorp:explore`, `/pandacorp:new-idea`.

### 2. Design

Se crean mockups navegables con identidad visual bespoke para el dominio. El sistema de diseño produce tokens (colores, espaciado, tipografía, radio) que son la única fuente de valores visuales en el código — nunca valores hardcodeados.

El motor de generación se elige por situación con una tabla de ruteo (DR-109): en un proyecto nuevo (camino EXPLORE) con acceso al canvas, el motor por defecto es **Claude Design** (claude.ai/design); sin acceso, direcciones HTML hechas a mano; con un visual ya aprobado se extrae fielmente (ADOPT-VISUAL); en brownfield con UI construida se itera en el repo. Con Claude Design, el loop lo conduce el agente con estado en disco (DR-109): un **tracker** enumera desde los FRDs todas las pantallas a generar (saltarse una página es imposible — el gate de avance lo verifica), los prompts viajan por el mejor transporte disponible (navegador vía claude-in-chrome, o portapapeles — tu único trabajo por ronda es un Cmd+V), el agente **detecta solo** cuándo el canvas terminó (polling) y revisa cada pantalla contra una rúbrica antes de mostrártela, y cada ronda queda registrada en el journal. Al cierre, un barrido reconcilia los componentes usados en las pantallas contra la galería del sistema. Tú solo tomas decisiones (aprobar / corregir / diferir), nunca haces de mensajero.

Habilidad: `/pandacorp:design`.

### 3. Architecture

Se documenta la arquitectura técnica de la plataforma (`docs/product/architecture.md`) y el blueprint de cada FRD (`docs/frds/frd-NN-<slug>/blueprint.md`). Se generan las **work orders** que dividen la construcción en rebanadas cohesivas (COARSE, con un techo: una WO no debe ser inrevisable de una sentada ni mezclar varias preocupaciones — DR-100).

Antes de pasar a construir, el blueprint cruza un **readiness gate** (DR-100): cada requisito mapea a un componente, **cada criterio de aceptación lo cubre exactamente una work order**, el modelo de datos no tiene huecos (`TBD`), el grafo de dependencias es acíclico, la foundation está completa y **no queda ninguna pregunta abierta sin resolver** (`[NEEDS CLARIFICATION]` bloquea). Un blueprint con agujeros produce work orders ambiguas, así que la cohesión se **verifica**, no se confía.

Al cerrar la fase, el skill emite `.pandacorp/comms/arquitectura-resumen.md` (español, owner-facing) que Mission Control renderiza nativamente en la pestaña **Arquitectura** de la card (el análogo de arquitectura a las pestañas Propuesta y Spec): el stack, el modelo de datos (con la rama condicional "Sin BD — contenido como código"), comunicación y servicios, los **ADRs** y las **variables de entorno** (leídos en vivo de `docs/adr/*` y `.env.example`), y el **plan de implementación** como grafo DAG de las work orders. Cada FRD abre un modal con su blueprint y sus WOs, y —si tiene más de una— su propio sub-DAG de dependencias y paralelismo.

> El nombre del skill cambió de `/pandacorp:blueprint` a **`/pandacorp:architecture`** (la fase produce la arquitectura completa, no solo un blueprint). El artefacto `blueprint.md` por-FRD **conserva su nombre** — sigue siendo la capa de diseño de implementación de cada feature.

Habilidad: `/pandacorp:architecture`.

### 4. Build (Implement)

El motor de `implement` orquesta subagentes especializados que construyen las work orders con TDD (RED → GREEN → refactor). El `reviewer` valida cada FRD antes de marcarlo VERIFIED. Si una WO falla la revisión, el motor **repara el fallo puntual en sitio antes de reconstruirla** y **sube el modelo a Opus** cuando la WO es difícil o ya falló (DR-073). El ciclo de rechazo tiene además un **presupuesto de convergencia (DR-107)**: el parche puede corregir los fallos que sus propios edits introdujeron (hasta 2 ciclos internos); si el bloqueador es un **test adversarial defectuoso del reviewer** (imposible de satisfacer por una implementación correcta), un agente independiente repara el TEST — nunca se descarta un build correcto (BL-0001); y si aun así hay que revertir, los tests con evidencia se preservan y la WO se **reintenta una vez en la misma corrida** desde base limpia antes de diferirse a la siguiente pasada. El gate por FRD corre una verificación **acotada** (DR-106): vitest solo de lo afectado y, del navegador, solo smoke + shell — la suite e2e completa (visual + responsive) corre una sola vez al cierre. Cada builder recibe un **context pack (DR-108)**: la ruta de su work order + los criterios de aceptación EARS que le tocan, extraídos una sola vez por el planner — para construir bien al primer intento en vez de re-leer todos los docs y aun así quedarse corto. Los pasos mecánicos (commits, stamps de estado, sync, archivo, avisos) corren en el modelo económico (haiku); el trabajo real mantiene sonnet como piso con escalada a opus (DR-073). El motor además emite los eventos `achievement` y `gate` que alimentan la Bóveda y el tribunal del Party (BL-0020).

El skill acepta tres modos de construcción:

| Modo | Invocación | Qué construye |
|---|---|---|
| **Completo** | `/pandacorp:implement` | Todos los FRDs pendientes en orden de dependencias |
| **Parcial por FRD** | `/pandacorp:implement frd-05-settings` | Solo el FRD indicado (o varios separados por espacio). Un gate bloquea si sus deps no están `VERIFIED` |
| **Por change** | `/pandacorp:implement change:mc-fix-pagination` | Procesa la change, crea/actualiza los FRDs y WOs, y construye solo los afectados |

Los identificadores se normalizan automáticamente: `frd-05-settings`, `docs/frds/frd-05-settings` y `docs/frds/frd-05-settings/frd.md` son equivalentes; igual para el nombre de una change (con o sin `.md`, con o sin ruta completa).

Cuando hay dependencias sin `VERIFIED`, el motor se detiene antes de escribir código y lista exactamente qué implementar primero. Ver la guía **«Build parcial: por FRD o por change»** para el flujo detallado de cada modo.

Habilidad: `/pandacorp:implement`.

### 5. Release

Auditoría de calidad, seguridad y accesibilidad. Plan de lanzamiento informado por el análisis de demanda. Gate humano obligatorio antes de cualquier despliegue a producción.

Habilidad: `/pandacorp:release`.

### 6. Operation

El producto está en producción. Se monitorizan métricas reales contra la hipótesis de valor.

Habilidad: `/pandacorp:review-launch` — lee métricas reales y recomienda kill / hold / double-down.

## Antes del pipeline: descubrir y capturar ideas

Antes de la fase *product*, una idea nace en el tablero. `/pandacorp:discover` sale a internet a **encontrar** oportunidades en **dos fases**: un barrido ancho y barato por lentes de caza rotativos (extensiones que arreglan quejas de apps conocidas · tus otras identidades · own-itch · challengers AI-first/unbundling de SaaS exitosos) que te presenta 8-12 **teasers** de una línea con evidencia de fuentes verificadas; tú eliges los que te chispean, y solo esos pasan por los gates de calidad (dedup por problema, founder-fit, painkiller, fuente-de-la-verdad + riesgo legal, cubeta de construibilidad micro/pequeña/grande) y un red team, para documentarse como cards. `/pandacorp:new-idea` hace lo mismo cuando **tú** traes la idea: la documenta y propone cómo mejorarla, sin venderte nada.

Cada idea que sobrevive se escribe como un **memo-pitch** ordenado *caliente → frío*: arriba el sueño (la apuesta · el problema contado · por qué tú · la visión) y abajo el criterio para decidir (mercado · distribución · gaps y riesgos · red team · el ask). En el tablero, abres la card y la tab **Propuesta** (la primera, por defecto) te muestra ese pitch renderizado con el diseño de Pandacorp.

## El estado del proyecto

El fichero `.pandacorp/status.yaml` de cada proyecto registra la fase actual, la versión y el SHA del último commit verde. Mission Control lo lee para mostrar el estado en el portfolio.

## Avance entre fases

El avance es siempre **explícito**: cada skill termina con `advance_pending: true` y espera el "ok" del propietario. Re-ejecutar la misma skill refina el output, no lo regenera ni avanza automáticamente (DR-032).

## Iteración sin retroceder

`/pandacorp:iterate` añade funcionalidades o cambia comportamientos en cualquier momento del pipeline sin necesidad de volver a la fase product. El motor crea nuevas WOs y las integra en el build en curso.

## El flujo inverso: del código a los documentos

A veces editas el código directamente —para ir rápido o ver el cambio en vivo— sin pasar por el pipeline. Entonces el código se adelanta a los documentos. `/pandacorp:sync` es el **flujo inverso** (`código → documentos`), el reverso de `/pandacorp:iterate`: clasifica los cambios, te muestra un plan y, con tu visto bueno, propaga la realidad a los documentos dueños (FRD, work orders, blueprint, FDD…) y al `docs/decision-log.md`. Como el código se vuelve el oráculo, **documenta pero no verifica**: tú aportas la intención en un gate, y solo se documenta lo que el código hace de más —un bug o una feature documentada-pero-no-construida no se escribe en la especificación, se deriva a `/pandacorp:change`. Detalle en la guía «Documentar cambios hechos a mano».
