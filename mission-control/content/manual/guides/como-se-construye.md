---
title: "Cómo se construye"
group: guides
order: 2
---

# Cómo se construye

Esta guía explica cómo el motor de `implement` construye un proyecto de principio a fin — el pipeline completo de build.

## El punto de entrada: `/pandacorp:implement`

Desde la carpeta de un proyecto que ya tiene su blueprint y work orders generadas:

```
/pandacorp:implement
```

Esto lanza un **Dynamic Workflow**: un script nativo de Claude Code que orquesta subagentes especializados con dependencias y paralelismo explícitos.

## Cómo se divide el trabajo

El blueprint de cada FRD genera **work orders** (WOs) numeradas: `WO-NN-MMM-<slug>.md`. Cada WO es una rebanada cohesiva (una vista, una capacidad, una función pública) — no un componente atómico.

El motor asigna las WOs a subagentes según su tipo:

| Rol | Qué construye |
|---|---|
| `backend-dev` | Lógica de servidor, APIs, acceso a datos |
| `frontend-dev` | Componentes UI, layouts, interactividad |
| `test-writer` | Tests de aceptación, adversariales, e2e |
| `reviewer` | Revisa el trabajo de otros y escribe tests que el implementer no vio |

## El ciclo RED → GREEN → refactor

Cada work order sigue TDD obligatorio:

1. **RED** — se escriben los tests de los criterios de aceptación (EARS) antes del código. Los tests deben fallar.
2. **GREEN** — implementación mínima que los hace pasar. Máximo 3 intentos de reparación por fallo; si el mismo error se repite, se escala.
3. **REFACTOR** — solo con todo verde. Sin cambiar comportamiento.

## Safe points y freeze-on-red

Cada WO que termina verde se **commitea** (safe point). Si `verify.sh` falla, el motor se congela (`freeze-on-red`) y escala al owner: nunca avanza sobre código roto.

## El gate de revisión por FRD

Cuando todas las WOs de un FRD están `IN_REVIEW`, el `reviewer` (un agente de modelo diferente al implementer) re-verifica el conjunto completo:

- Vuelve a correr toda la evidencia.
- Escribe **tests adversariales** que el implementer no vio.
- Ejecuta mutation testing para confirmar que los tests no son decorativos.

Solo cuando el reviewer aprueba, el FRD pasa a `VERIFIED`.

### Cuando el gate rechaza: reparar antes de rehacer

Si el reviewer encuentra un fallo concreto en una WO, el motor **no tira el trabajo para reconstruirlo de cero**. Primero intenta **un parche puntual sobre lo ya construido** (DR-073): le inyecta el fallo exacto y un test que lo prueba, y arregla solo eso. El parche se re-valida sobre **todo el proyecto** (no solo los tests afectados), de modo que un resto de código muerto no pueda romper otro FRD.

- Si el parche deja todo en verde → la WO pasa a `VERIFIED` **en sitio**, sin reconstruir nada.
- Si el parche no lo consigue → recién ahí el motor revierte esa WO al último verde y la reconstruye en la siguiente pasada (con un modelo más potente, ver abajo).
- Si una WO falla el gate demasiadas veces seguidas sin resolverse, el motor la **bloquea y escala al owner** en vez de reintentar para siempre.

## Qué modelo usa cada WO (selección adaptativa)

Cada modo de build define un modelo base para los implementers (p. ej. en `powerful`, Sonnet). Pero el motor **sube a Opus automáticamente** —sin salir del modo— cuando una WO lo justifica (DR-073):

- **A priori** — la WO viene marcada `difficulty: high` en su frontmatter (una superficie compleja: muchos componentes, navegación cruzada, ≥5 criterios). Arranca directamente en Opus.
- **Empírico** — la WO ya falló el gate al menos una vez. El reintento sube a Opus, porque un modelo más capaz tiene más probabilidad de cerrarla.

El freno de presupuesto cuenta cada agente Opus como ~3, para que escalar no dispare el gasto sin que se note.

## Seguir el avance

Mission Control muestra:

- **Work Orders** — tablero kanban con columnas PLANNED / IN_PROGRESS / IN_REVIEW / VERIFIED / BLOCKED.
- **Party** — los agentes animados reaccionan a los eventos en tiempo real (trabajo, handoff, logro, error).
- **Observabilidad** — grafo de dependencias entre WOs, freshness badge, timeline de eventos.

## Retomar una construcción interrumpida

El build es resumible sin pérdida. Al relanzar `/pandacorp:implement`, el motor lee el estado de `status.yaml` y las WOs y retoma desde el último commit verde.
