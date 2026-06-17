---
title: "Alimentar una construcción en marcha"
group: guides
order: 4
---

# Alimentar una construcción en marcha

Cuando el motor de `implement` está construyendo un proyecto sin supervisión, puedes reportar bugs, añadir funcionalidades o resolver decisiones pendientes **sin interrumpirlo**. La comunicación es asíncrona: escribes un fichero y el motor lo recoge al terminar la siguiente work order (el próximo **safe point**).

## Los tres canales de feedback

El motor nunca interrumpe el trabajo a mitad de una work order. En cada safe point — cuando una WO termina con `verify.sh` verde y se commitea — el motor revisa los canales antes de arrancar la siguiente WO.

| Canal | Habilidad | Para qué | Mecanismo |
|---|---|---|---|
| `/pandacorp:bug` | `bug` | Reportar un bug encontrado durante las pruebas | Escribe un fichero en `.pandacorp/inbox/bugs/` |
| `/pandacorp:iterate` | `iterate` | Añadir una funcionalidad o cambiar un comportamiento | Escribe/actualiza `.pandacorp/inbox/iterate.md` |
| `/pandacorp:decide` | `decide` | Resolver un punto de decisión pendiente | Escribe/actualiza `.pandacorp/inbox/decisions.md` |

### `/pandacorp:bug` — reportar un bug

Ejecuta este comando desde la carpeta del proyecto cuando encuentres un bug mientras pruebas la snapshot probable:

```
/pandacorp:bug
```

La habilidad crea un fichero en `.pandacorp/inbox/bugs/<slug>.md` con la descripción del problema. El motor lo recoge en el próximo safe point, lo introduce como un trabajo de corrección y actualiza `pending_bugs` en `status.yaml`.

> El contador `pending_bugs` aparece como chip rojo en el panel de snapshot de Mission Control.

### `/pandacorp:iterate` — añadir o cambiar

```
/pandacorp:iterate
```

Escribe la petición de cambio en el inbox del proyecto. El motor la procesa en el próximo safe point: genera o actualiza las work orders necesarias y las integra en el build en curso. No es necesario detener ni relanzar `implement`.

### `/pandacorp:decide` — resolver una decisión pendiente

Durante la construcción el motor puede encontrar puntos de decisión que no puede resolver solo — los marca en `status.yaml` como `pending_decisions` y los lista en `.pandacorp/inbox/decisions.md`. Para responderlos:

```
/pandacorp:decide
```

La habilidad escribe tu respuesta en el fichero de decisiones. El motor lee ese fichero en el próximo safe point y retoma el trabajo con la decisión tomada.

> El contador `pending_decisions` aparece como chip ámbar en el panel de snapshot de Mission Control. Los puntos de decisión también son visibles en el workspace del proyecto (pestaña Work Orders).

## La semántica del safe point

El motor **nunca interrumpe** el trabajo a mitad de una work order. El flujo es:

```
WO-N en ejecución
    ↓ termina verde → commit → safe point
    ↓ motor revisa los canales de inbox
    ↓ incorpora bugs / iterate / decide al plan
WO-N+1 arranca
```

Esto significa que tu feedback se verá reflejado entre WOs, no de forma inmediata. Si el build tarda varios minutos por WO, puede pasar un rato antes de que el motor lo recoja — es por diseño: garantiza que el estado de git siempre sea coherente.

## El panel de snapshot

Mientras el build avanza, el **panel de snapshot** de Mission Control (en el workspace del proyecto) muestra:

- El **último punto probable** — la última FRD cerrada en verde con su `last_green_sha`. Es la versión que puedes probar con seguridad.
- El comando `git worktree add ../<proyecto>-review <sha>` para crear un worktree de revisión sin tocar el árbol del agente.
- El **estado actual** ("construyendo ahora: `<WO en curso>` · no pruebes esto todavía") cuando el motor está en marcha.
- Un aviso si el snapshot probable está quedando anticuado (muchos commits detrás o muchas horas desde el último punto verde).

Es en ese panel donde verás los chips de `pending_bugs` (rojo) y `pending_decisions` (ámbar) que indican si hay feedback pendiente de procesar.

## Cuándo usar cada canal

| Situación | Canal |
|---|---|
| Probaste la snapshot y algo no funciona | `/pandacorp:bug` |
| Quieres añadir una pantalla, cambiar un flujo | `/pandacorp:iterate` |
| El motor tiene una pregunta bloqueante (chip ámbar) | `/pandacorp:decide` |
| Quieres pausar el build para replantear el plan | Escribe `rethink_pending: true` en `status.yaml` |

## Estado escrito por el gate, no por el agente

El estado de la construcción — `last_green_sha`, `safe_to_test`, `pending_bugs`, `pending_decisions` — lo escribe el **script de gate** (`.pandacorp/verify.sh` y el motor), no el agente implementer directamente. Esto garantiza que el estado reflejado en Mission Control sea siempre consistente con git y con lo que `verify.sh` ha verificado.

## Resumen

1. No interrumpas al agente — usa los tres canales de inbox.
2. El motor los recoge en el próximo safe point (al terminar la WO en curso).
3. Revisa el panel de snapshot en Mission Control para saber qué versión puedes probar y si hay decisiones o bugs pendientes.
4. Si necesitas que el motor se detenga para replantear el plan, escribe `rethink_pending: true` en `.pandacorp/status.yaml`.
