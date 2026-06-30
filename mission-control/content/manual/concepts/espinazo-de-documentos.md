---
title: "El espinazo de documentos"
group: concepts
order: 17
---

# El espinazo de documentos

Cada proyecto se documenta con una cadena de documentos que se enlazan por IDs estables. No es burocracia: es la **trazabilidad** que permite que muchos agentes (y tú) sepan, para cada línea de código, de qué requisito vino y qué criterio la verifica.

## Qué es cada documento

- **PRD** (`docs/product/prd.md`) — la visión, usuarios, métricas y alcance + una tabla VIVA de "feature landscape" (el mapa de FRDs).
- **FRD** (`docs/frds/frd-NN-<slug>/frd.md`) — el **contrato de usuario**: `REQ-NN-MMM` + `AC-NN-MMM.K` (en formato EARS, testeable). Qué hace la feature y cómo se acepta.
- **FDD** (`docs/frds/frd-NN-<slug>/fdd.md`) — el diseño de la feature. **Condicional: solo si tiene UI.**
- **Blueprint** — diseño de implementación. Hay **dos capas**: el blueprint de **plataforma** (`docs/product/architecture.md`, uno por proyecto: stack, modelo de datos, transversales) y el blueprint de **feature** (`docs/frds/frd-NN-<slug>/blueprint.md`, uno por FRD). Nunca se fusionan.
- **ADR** (`docs/adr/`) — decisiones técnicas a nivel de plataforma (cross-feature).
- **Work order** (`docs/frds/frd-NN-<slug>/work-orders/wo-NN-MMM-<slug>.md`) — una **rebanada gruesa** (una vista/capacidad); copia sus AC en línea y cita los IDs de REQ/CMP/IF.

## La cadena de trazabilidad

Los IDs forman el espinazo. `NN` es el número de la carpeta del FRD (no cambia una vez asignado); el nombre legible vive en el slug, no en el ID:

```
REQ-NN-MMM  →  AC-NN-MMM.K  →  CMP-NN-<slug> / IF-NN-<slug>  →  WO-NN-MMM
```

- `REQ-NN-MMM` — requisito (en `frd.md`).
- `AC-NN-MMM.K` — criterio de aceptación (EARS, testeable).
- `CMP-NN-<slug>` / `IF-NN-<slug>` — componente / interfaz (en `blueprint.md`).
- `WO-NN-MMM` — work order; sus tests mapean de vuelta a `AC-NN-MMM.K`.

## La jerarquía de fuente de verdad

Cuando dos documentos se contradicen, **gana el de arriba** y se corrige el de abajo:

```
FRD  >  FDD  >  design-tokens  >  blueprint  >  work order
```

Los cambios propagan upstream en ese orden: comportamiento → FRD, visual/copy → FDD, arquitectura → blueprint, alcance → WO. Esto *es* la regla de documentación de dos capas hecha estructura.

## La disciplina de las dos escrituras

Documentar un cambio son **dos cosas, siempre**:

1. **Actualizar el documento canónico** (la verdad de ahora) — el que *posee* ese hecho, para que describa la realidad actual.
2. **Registrar la decisión** en `docs/decision-log.md` (la historia) — fecha, *qué*, *por qué*, enlazando el documento tocado (lo más reciente arriba).

El documento canónico responde *"¿qué es verdad ahora?"*; el decision-log, *"¿cómo llegamos aquí y por qué?"*. Hacen falta los dos: el FRD solo pierde el porqué; el log solo deja el FRD mintiendo. Un cambio de comportamiento **no está hecho** sin su FRD actualizado **y** su entrada de decision-log.

> La estructura es **feature-céntrica** (DR-049): una capa fina de producto en `docs/product/` + un módulo autocontenido por feature en `docs/frds/frd-NN-<slug>/`. Las carpetas aparecen **bajo demanda** — una feature nueva es solo una carpeta nueva. El Manual de Mission Control refleja esta misma disciplina (DR-046).

## Patrón prohibido — `docs/proposals/` en un proyecto

Un proyecto **nunca** tiene una carpeta `docs/proposals/`. Ese patrón solo existe en el repo de la fábrica (`panda-corp/docs/proposals/`) para RFCs de la propia fábrica.

Un cambio pendiente siempre va a **`.pandacorp/inbox/changes/`** (vía `/pandacorp:change`). Un archivo en `docs/proposals/` es invisible para el motor de build y para la cola de cambios de Mission Control: nunca se va a procesar. Si tienes una idea o cambio para un proyecto, usa `/pandacorp:change` — no crees un doc de propuesta dentro de `docs/`.
