---
title: "Construcción desatendida"
group: concepts
order: 10
---

# Construcción desatendida

La fábrica está diseñada para construir software durante horas sin supervisión humana. Esta página explica cómo funciona el modo desatendido y cómo el propietario puede interactuar con una construcción en marcha sin interrumpirla.

## El principio

El motor de `implement` es un **Dynamic Workflow** — un script determinista que orquesta subagentes con dependencias explícitas. Una vez lanzado, no necesita intervención humana para avanzar. El propietario puede cerrar la sesión y retomar más tarde: el build continúa desde el último safe-point.

## Safe points

Un safe point es un **commit verde** en git. Cada work order que termina con `verify.sh` verde se commitea inmediatamente. Si el proceso se interrumpe en cualquier momento, el próximo arranque retoma desde el último commit verde — nunca pierde trabajo completado.

```
WO-01 ✓ → commit → WO-02 ✓ → commit → WO-03 ✗ → freeze
                                                    ↑ retoma aquí
```

## Freeze-on-red

Si `verify.sh` falla, el motor se congela. No intenta reparar indefinidamente — máximo 3 intentos por fallo. Después escala al propietario registrando el bloqueo en `.pandacorp/status.yaml` (`blocked_work_orders`). La construcción queda en estado limpio (no hay código roto en HEAD).

## Comunicarse con una construcción en marcha

El propietario nunca interrumpe al agente directamente. La comunicación es **asíncrona a través de ficheros**:

| Canal | Para qué |
|---|---|
| `.pandacorp/inbox/bugs/<fichero>.md` | Reportar un bug encontrado durante las pruebas |
| `.pandacorp/inbox/decisions.md` | Anotar una decisión pendiente de resolver |
| `rethink_pending: true` en `status.yaml` | Señal para que el motor replantee el plan al próximo safe-point |

El motor revisa estos canales en cada safe-point (al terminar una WO). Nunca a mitad de trabajo.

## Paralelismo

El motor ejecuta hasta 3 subagentes en paralelo cuando sus work orders no tienen dependencias entre sí. Las dependencias son explícitas en el código del workflow — no se infieren.

```
WO-02 (backend) ──┐
                   ├── ambas en paralelo, sin dependencia
WO-03 (frontend) ─┘

WO-04 depende de WO-02 → espera a que WO-02 termine
```

## Monitorización en Mission Control

Mientras el build corre, Mission Control muestra en tiempo real:

- El estado de cada work order en el tablero Kanban.
- Los agentes activos con su estado en el Party panel.
- Los eventos recientes en la línea de tiempo de observabilidad.
- El freshness badge que indica si los datos son recientes.

El propietario puede revisar el avance sin intervenir — Mission Control es de solo lectura sobre el build.

## Reiniciar tras un bloqueo

Cuando el propietario resuelve el bloqueo (corrige el bug escalado, toma la decisión pendiente), actualiza el estado y relanza:

```
/pandacorp:implement
```

El motor retoma desde el último safe-point, con el bloqueo resuelto.
