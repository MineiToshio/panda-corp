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

Un safe point se publica como una pareja de commits: el primero es el **snapshot verde** que pasó la revisión independiente; el segundo solo registra en `status.yaml` que `last_green_sha` apunta al primero y que `safe_to_test` es verdadero. El motor comprueba que ese snapshot existe y es ancestro de `HEAD`; nunca intenta que un commit contenga su propio hash. Si el proceso se interrumpe, el próximo arranque retoma desde ese snapshot verde — nunca pierde trabajo completado.

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

## Paralelismo — oleadas globales

El motor construye en **oleadas globales** (BL-0021): cada oleada toma las work orders **listas de TODOS los FRDs** — dependencias (`dependsOn`) satisfechas y artefactos disjuntos (DR-060) — hasta el tope del modo (potente = 8 en paralelo). Ya no se espera a que termine un FRD para empezar el siguiente: seis features independientes construyen a la vez. Las dependencias son explícitas en el frontmatter de cada work order — no se infieren.

```
Oleada 1:  WO-01-001 (fundación, sola)
Oleada 2:  WO-02-001 ─┐
           WO-03-001 ─┼── FRDs independientes, todos a la vez
           WO-05-001 ─┘
Gates:     frd-02 → frd-03 → frd-05  (serializados, árbol quieto)
```

Los **gates de review siguen siendo uno por FRD** y corren **serializados en las fronteras de oleada** — nunca mientras hay builders en vuelo, así su suite whole-project siempre ve un árbol quieto. La frontera de confianza no cambió; solo el scheduling.

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
