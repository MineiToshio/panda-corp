---
id: FDD-06
---
# FDD — FRD-06 Operator console

## Screens

| ID | Screen | Oracle state |
|---|---|---|
| S1 | **Operación** console (`mocks/operator.html#operator`) | `operator` |

## States

| State | What the capture shows | Oracle state |
|---|---|---|
| Partial run (default) | "Reanudar pendientes" (`ops.run.resume`) is the one primary button; "{n} candidatos por revisar" (`ops.queue.count`) | `operator` |
| Motivo error | "Escribe el motivo de la decisión." (`ops.motivo.error`) drawn at rest, as the prototype | `operator` |

S1 layout: H1 "Operación" (`ops.title`). Leaving the console goes to FRD-01's "Explorar".

## Interaction & flow

1. The operator resumes pending work with "Reanudar pendientes", as the prototype.

## Fidelity references

Build against `docs/design/fidelity-checklist.md`; screen ids: `operator`.
