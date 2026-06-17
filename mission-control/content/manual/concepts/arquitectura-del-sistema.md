---
title: "Arquitectura del sistema"
group: concepts
order: 5
---

# Arquitectura del sistema

Esta página describe la arquitectura técnica de la fábrica y cómo se organiza la documentación de cada proyecto según la estructura feature-centric (DR-049).

## Estructura de la fábrica

```
panda-corp/                        ← repositorio de la fábrica
  factory/                         ← estándares, decisiones, memoria
    constitution.md
    standards/
    decisions/registry.yaml
    memory/
  plugin/                          ← habilidades y agentes del plugin
    skills/<slug>/SKILL.md
    agents/<id>.md
  mission-control/                 ← este panel de control (Next.js)
  <proyecto-A>/                    ← proyecto hermano (repo propio)
  <proyecto-B>/
```

## Estructura de documentación de un proyecto (DR-049)

Cada proyecto sigue la estructura **feature-centric**: una capa de producto compartida + un módulo auto-contenido por FRD. Las carpetas aparecen **bajo demanda** (progressive disclosure).

```
docs/
  product/
    prd.md                         ← visión, métricas, mapa de features
    architecture.md                ← arquitectura de plataforma (stack, datos, deploy)
    research.md                    ← investigación de mercado
  frds/
    frd-NN-<slug>/                 ← módulo por feature
      frd.md                       ← contrato: REQ + criterios EARS
      fdd.md                       ← (bajo demanda) diseño UI + mocks/
      blueprint.md                 ← (bajo demanda) diseño de implementación
      work-orders/                 ← (bajo demanda) WOs de construcción
        README.md
        wo-NN-MMM-<slug>.md
  adr/                             ← decisiones de arquitectura de plataforma
  analytics/
    events.md                      ← plan global de eventos
  reviews/                         ← evidencia de auditoría
  decision-log.md                  ← historial de decisiones + por qué
```

Esta estructura reemplaza el layout antiguo por tipo (archivos de blueprint y work-orders a nivel raíz de `docs/`, FRDs en una carpeta plana sin sub-módulos). Esos patrones no deben usarse en proyectos nuevos — cada FRD tiene su propio módulo auto-contenido.

## La espina de trazabilidad

Los IDs forman una cadena que conecta requisitos con código. Ejemplo de un feature real (FRD-08, WO 005):

```
REQ-08-001  →  AC-08-001.1  →  CMP-08-concept-pages / IF-08-manual-index  →  WO-08-005
```

El patrón general:

```
REQ-NN-MMM  →  AC-NN-MMM.K  →  CMP-NN-<slug> / IF-NN-<slug>  →  WO-NN-MMM
```

- `REQ-NN-MMM` — requisito en el FRD (p.ej. `REQ-08-001`).
- `AC-NN-MMM.K` — criterio de aceptación EARS (p.ej. `AC-08-001.1`).
- `CMP-NN-<slug>` — componente que lo implementa (blueprint).
- `IF-NN-<slug>` — interfaz pública expuesta (contrato de módulo).
- `WO-NN-MMM` — work order que construye el componente/interfaz.

## Jerarquía de fuentes de verdad

Cuando hay conflicto entre documentos, la precedencia es:

```
FRD  >  FDD  >  design-tokens  >  blueprint  >  work order
```

El FRD define **qué** hace la feature. El blueprint define **cómo** se implementa. La work order es la tarea de construcción. Si el blueprint contradice el FRD, gana el FRD.

## Dos capas de arquitectura

- **Plataforma** (`docs/product/architecture.md`) — stack, modelo de datos, deploy, decisiones transversales. Una por proyecto.
- **Feature** (`docs/frds/frd-NN-<slug>/blueprint.md`) — diseño de implementación de esa feature concreta. Una por FRD.

Nunca se fusionan. El blueprint de feature referencia la arquitectura de plataforma, no la duplica.

## Arquitectura de Mission Control

Mission Control es una aplicación Next.js con App Router. Sus principios:

- **Solo lectura** sobre la fábrica — lee ficheros, nunca escribe (salvo el `status:` de descarte en FRD-02).
- **Server Components** por defecto; `"use client"` solo cuando la interactividad lo requiere.
- **Derivación en tiempo de render** — los catálogos de Referencia se derivan de la fuente canónica en cada render, nunca se copian a mano.
- **Design tokens** únicamente — cero colores ni espaciado hardcodeado.

La ruta de cada sección: `app/` (proyectos, partido, manual, configuración), `lib/` (readers de datos), `components/` (primitivas reutilizables).
