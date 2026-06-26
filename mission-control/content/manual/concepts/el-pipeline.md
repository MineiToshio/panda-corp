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

Habilidad: `/pandacorp:design`.

### 3. Architecture (Blueprint)

Se documenta la arquitectura técnica de la plataforma (`docs/product/architecture.md`) y el blueprint de cada FRD (`docs/frds/frd-NN-<slug>/blueprint.md`). Se generan las **work orders** que dividen la construcción en rebanadas cohesivas.

Habilidad: `/pandacorp:blueprint`.

### 4. Build (Implement)

El motor de `implement` orquesta subagentes especializados que construyen las work orders en paralelo con dependencias explícitas. Cada WO sigue TDD (RED → GREEN → refactor). El `reviewer` valida cada FRD antes de marcarlo VERIFIED. Si una WO falla la revisión, el motor **repara el fallo puntual en sitio antes de reconstruirla** y **sube el modelo a Opus** cuando la WO es difícil o ya falló (DR-073).

Habilidad: `/pandacorp:implement`.

### 5. Release

Auditoría de calidad, seguridad y accesibilidad. Plan de lanzamiento informado por el análisis de demanda. Gate humano obligatorio antes de cualquier despliegue a producción.

Habilidad: `/pandacorp:release`.

### 6. Operation

El producto está en producción. Se monitorizan métricas reales contra la hipótesis de valor.

Habilidad: `/pandacorp:review-launch` — lee métricas reales y recomienda kill / hold / double-down.

## Antes del pipeline: descubrir y capturar ideas

Antes de la fase *product*, una idea nace en el tablero. `/pandacorp:discover` sale a internet (Reddit, foros, reviews de 1-2★) a **encontrar** oportunidades, las pasa por gates de calidad (founder-fit, painkiller, fuente-de-la-verdad + riesgo legal, cubeta de construibilidad micro/pequeña/grande) y un red team, y documenta solo las supervivientes. `/pandacorp:new-idea` hace lo mismo cuando **tú** traes la idea: la documenta y propone cómo mejorarla, sin venderte nada.

Cada idea que sobrevive se escribe como un **memo-pitch** ordenado *caliente → frío*: arriba el sueño (la apuesta · el problema contado · por qué tú · la visión) y abajo el criterio para decidir (mercado · distribución · gaps y riesgos · red team · el ask). En el tablero, abres la card y la tab **Propuesta** (la primera, por defecto) te muestra ese pitch renderizado con el diseño de Pandacorp.

## El estado del proyecto

El fichero `.pandacorp/status.yaml` de cada proyecto registra la fase actual, la versión y el SHA del último commit verde. Mission Control lo lee para mostrar el estado en el portfolio.

## Avance entre fases

El avance es siempre **explícito**: cada skill termina con `advance_pending: true` y espera el "ok" del propietario. Re-ejecutar la misma skill refina el output, no lo regenera ni avanza automáticamente (DR-032).

## Iteración sin retroceder

`/pandacorp:iterate` añade funcionalidades o cambia comportamientos en cualquier momento del pipeline sin necesidad de volver a la fase product. El motor crea nuevas WOs y las integra en el build en curso.

## El flujo inverso: del código a los documentos

A veces editas el código directamente —para ir rápido o ver el cambio en vivo— sin pasar por el pipeline. Entonces el código se adelanta a los documentos. `/pandacorp:sync` es el **flujo inverso** (`código → documentos`), el reverso de `/pandacorp:iterate`: clasifica los cambios, te muestra un plan y, con tu visto bueno, propaga la realidad a los documentos dueños (FRD, work orders, blueprint, FDD…) y al `docs/decision-log.md`. Como el código se vuelve el oráculo, **documenta pero no verifica**: tú aportas la intención en un gate, y solo se documenta lo que el código hace de más —un bug o una feature documentada-pero-no-construida no se escribe en la especificación, se deriva a `/pandacorp:change`. Detalle en la guía «Documentar cambios hechos a mano».
