# FRD-14 — Snapshot probable y canales de feedback

Lo que Mission Control muestra para operar una construcción desatendida: cuál es el último punto **probable** (testeable), qué se está construyendo ahora, y los canales para meterle feedback sin parar. Derivado de [docs/propuestas/07-construccion-desatendida.md](../../../docs/propuestas/07-construccion-desatendida.md). Solo-lectura.

## Criterios de aceptación (EARS)

- POR cada proyecto en construcción, Mission Control DEBERÁ mostrar un **panel de snapshot** con: el **último punto probable** (FRD cerrado en verde + `last_green_sha`), un badge "verde", y el **comando `git worktree add ../<proyecto>-review <sha>`** listo para copiar. Lee `last_green_sha` y `safe_to_test` de `docs/estado.yaml`.
- EL panel DEBERÁ distinguir **"construyendo ahora"** (el work order en curso, "no probar esto todavía") del **"último punto probable"** — son dos cosas distintas.
- SI `last_green_sha` está muy atrás de HEAD (muchos commits/horas), DEBERÁ alertar que el snapshot probable está quedando viejo.
- CADA proyecto en el rail del portfolio DEBERÁ mostrar **chips** con el número de **decisiones pendientes** (ámbar) y **bugs en bandeja** (rojo), leídos de `decisiones_pendientes` y `bugs_pendientes`.
- SI un proyecto tiene `replanteo_pendiente: true`, DEBERÁ indicarlo (la construcción se va a pausar para un cambio fuerte).
- LA documentación de Mission Control DEBERÁ explicar los **tres canales de feedback** a una construcción en curso: `/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide` (todos por archivos, recogidos en el próximo punto seguro).

## No-objetivos
- Mission Control NO ejecuta `git worktree` ni levanta el dev server: muestra el comando para que el dueño lo corra (solo-lectura). En el futuro podría haber un botón que lo arme, pero sigue siendo acción del operador.

## Relación
Complementa Party ([FRD-06](frd-06-party.md)) y los work orders ([FRD-05](frd-05-work-orders.md)). El estado lo escribe el script del gate del proyecto, no el agente (ver `fabrica/estandares/infra.md`).
