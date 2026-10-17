---
id: FDD-06
---
# FDD — FRD-06 Operator console

## Screens

| ID | Screen | Realized in |
|---|---|---|
| S1 | **Operación** console | `mocks/operator.html` (prototype picture) |
| S3 | **Nueva carga** dialog | GAP, no picture (G2) |

## States

### Prototype states

| State | What the picture shows |
|---|---|
| Partial run (default) | "Reanudar pendientes" is the one primary button; the count reads "{n} candidatos por revisar" (`ops.queue.count`) | 

### Designed GAP states (no prototype picture)

| # | State | Layout |
|---|---|---|
| G2 | Nueva carga | `Dialog` with "Cancelar" (`common.cancel`) |

S1 layout: H1 "Operación" (`ops.title`), the **Nueva carga** button (`ops.backfill.new`), an inline select "Ver ejecución" (`ops.run.select.label`), "Configurar" (`ops.delta.configure`).

## Interaction & flow

1. "Volver a la cola" at the top of the candidate returns focus to the row; "Ver más candidatos" (`ops.queue.more`) pages the queue.
2. Errors appear only after a press (the prototype's pre-shown error is a demonstration, not the initial state).

## Fidelity references

Build against `docs/design/fidelity-checklist.md`.
