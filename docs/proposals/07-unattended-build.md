# Construcción desatendida + probar snapshots estables (sin babysitting)

> Generado 2026-06-14 a partir de una investigación web con verificación (30/32 hallazgos sobreviven).
> Resuelve la tensión: correr `/pandacorp:implement` por horas sin estar encima + poder revisar/probar
> lo avanzado cuando vuelves, sin adivinar si el estado es "testeable".

## El principio que lo resuelve

**El punto seguro no es un estado del agente: es un commit de git.** En vez de *pausar al agente para inspeccionar*, tratas **cada work order cerrado en verde como un snapshot inmutable**. Invariante (Fowler, *Release-Ready Mainline*): "the head of mainline can always be put directly into production". El agente nunca deja trabajo a medias en el punto estable: o el WO cierra verde y commitea, o se queda sucio en SU carpeta sin tocar el commit que tú pruebas. Como el historial de git es compartido, ese commit verde es visible al instante desde otra carpeta **sin parar, sin push, sin preguntar**. "Correr desatendido" y "probar un snapshot estable" dejan de competir: son la misma disciplina de *commit-en-verde* vista desde dos directorios.

## El patrón, paso a paso

### a) Correr desatendido — "small batches + freeze-on-red"
El agente avanza WO tras WO mientras el gate esté verde y **solo se detiene cuando un gate se pone rojo y no puede auto-arreglarlo en N intentos** (o un gate humano de la constitución). Autonomía ≠ "nunca preguntar"; es "preguntar solo en rojo irrecuperable".
1. **Quitar el "¿continúo?"** → **auto mode** (Shift+Tab → "Auto mode", o `defaultMode: "auto"` en `~/.claude/settings.json`). Un clasificador revisa cada acción antes de ejecutarla y solo bloquea lo que escala más allá de lo pedido / apunta a infra desconocida / viene de contenido hostil. Requiere Claude Code v2.1.83+ y Opus 4.6+. **El repo no puede auto-concedérselo** (ignorado desde v2.1.142) — alineado con los gates humanos. NO usar `--dangerously-skip-permissions`. [anthropic.com/engineering/claude-code-auto-mode]
2. **Procesos largos sin bloquear** → `run_in_background: true` en Bash (dev server / e2e watch) + el tool **Monitor** para tail-ear logs/CI sin pausar la conversación. [code.claude.com/docs/en/tools-reference]
3. **Driver orientado a meta**, no a intervalo: el **workflow ES el loop** ("construye hasta que la cola esté vacía y todos los FRD tengan e2e verde", y para solo). `/loop` *self-paced* solo si además se quiere correr en continuo/desatendido; `/goal` como herramienta de borde. Nunca a intervalo fijo de cron.
4. **Circuit breakers obligatorios** (sin esto, una corrida desatendida quema plata): tope de iteraciones, detección de no-progreso (mismo error / diff vacío / mismo test fallando N veces), tope de presupuesto. El backstop de auto mode (pausa tras 3 bloqueos seguidos) **no sustituye** esto: cuenta bloqueos del clasificador de seguridad, no tests rojos ni dólares.

### b) Marcar/publicar cada hito estable
- **El gate de cierre del WO corre LITERALMENTE el mismo `verify.sh` que CI** (no una versión "rápida" que pueda divergir; si no, el badge "verde" miente). El hook `Stop` ya corre `.pandacorp/verify.sh`; falta que GitHub Actions invoque ese mismo script.
- **Cada commit de cierre escribe en `docs/estado.yaml`**: `last_green_sha` y `safe_to_test: true/false`. `safe_to_test=true` SOLO cuando `HEAD == último WO cerrado en verde` (no si hay trabajo sin commitear). **Lo escribe el script del gate, no el agente.**

### c) El humano prueba un snapshot SIN tocar al agente — git worktrees
El agente sigue en su carpeta/rama; tú haces checkout del último verde en OTRA carpeta:
```bash
git worktree add ../<proyecto>-review <last_green_sha>
cd ../<proyecto>-review && <comando-dev del golden path>   # en otro puerto
# al terminar:
git worktree remove ../<proyecto>-review
```
El worktree de review comparte el historial pero tiene working dir y rama propios: queda **inmune** mientras el agente commitea, solo ve commits cerrados, **nunca** el medio-WO sucio. Los worktrees creados a mano no los borra el sweep de Claude Code (sobreviven horas) y permiten **cerrar la laptop sin matar el run**. Gotchas a resolver en la plantilla:
- **Config/deps no se heredan**: un worktree es un checkout fresco sin `.env`/`node_modules`. Usar `.worktreeinclude` (sintaxis `.gitignore`) para copiar `.env` + un paso post-create que instale deps.
- **Colisión de puertos/DB**: puerto por worktree vía `.env`. Cuidado con atajos tipo `UNSAFE_AUTH_BYPASS` (no shippear a release).
- **El dev server de review lo levantas tú, no el agente**: los background shells del agente se matan ~5s tras el resultado final y no se restauran en `--resume` (y dejan zombies si no se llama `TaskStop`).

### d) Qué muestra Mission Control (dos cosas hoy confundidas)
- **Badge `main = testeable`**: verde SOLO con `safe_to_test: true`. Muestra `last_green_sha` corto + "FRD-3 cerrado, e2e verde" + el comando `git worktree add …` para copiar. = "último punto probable".
- **Indicador "construyendo ahora"**: el WO en progreso, el agente activo, y un contador de antigüedad: si `last_green_sha` está muy atrás de HEAD → alerta (el snapshot probable está quedando viejo).
- **Botón "Probar snapshot estable"**: arma el worktree sobre `last_green_sha`.

## Qué cambiar en Pandacorp (concreto)
- **`plugin/skills/implement/SKILL.md`**: documentar arranque en auto mode; explicitar commit-solo-en-borde-de-WO-en-verde; añadir provisioning de worktree (.env + deps); convertir "3 errores = parar" en **freeze-on-red** (no commitear lo roto, dejar HEAD en `last_green_sha`, marcar WO `BLOCKED`, **PushNotification al dueño**, seguir con WOs independientes); `TaskStop` de dev servers al cerrar cada FRD.
- **`/loop` — SÍ y NO:** el **workflow ES el loop** (corre hasta vaciar la cola y para solo); `/loop` *self-paced* solo para mantenerlo corriendo en continuo/desatendido. NO a intervalo fijo (los scheduled tasks expiran a 7 días, son session-scoped, no hacen catch-up, y meten delays de 1min–1h). Para trabajo continuo: el workflow self-paced + Monitor.
- **git:** trunk-based — cada WO commitea/mergea al **cerrar el WO**, no al cerrar el proyecto (prohibir `feature/proyecto-completo` de horas). Tag semver opcional por hito de FRD. Para features que cruzan varios WOs: **feature toggles en source-control (YAML, no DB)** con fecha de expiración, para que cada WO intermedio deje `main` desplegable.
- **Mission Control:** los 3 elementos de (d), leyendo `last_green_sha`/`safe_to_test` de `estado.yaml`.
- **hooks:** `Notification` (idle) + notificación rica al cerrar FRD ("FRD-3 verde, SHA abc testeable").

## Alternativas
| Opción | Veredicto |
|---|---|
| **A. Pausa con timeout que auto-continúa** (el agente se detiene en cada hito, espera X min, si no respondes sigue) | **No.** Queda idle quemando tiempo/tokens, te ata a tu reloj, y el "punto estable" sigue siendo un estado de sesión que no sobrevive a un corte. |
| **B. No pausar nunca + testear snapshot vía worktree** (freeze-on-red, commit-en-verde, pruebas `last_green_sha` cuando quieras) | **Recomendado.** Avanza a máxima velocidad; el punto estable es un commit inmutable que sobrevive a cortes y a cerrar la laptop; pruebas async sin tocar al agente. |
| **C. Auto-revert del WO roto** (revertir el WO ofensor y seguir, en vez de freeze del lote) | Variante válida de B para WOs **independientes**. Por defecto preferir freeze + notificar. |

## Caveats
- **Auto mode no es blindaje de seguridad** (~17% falsos negativos). Los gates humanos (prod, dinero, borrar datos, comms externas) deben ser **reglas `deny` duras en `.claude/settings.json`**, no límites conversacionales (la compactación de contexto puede perderlos). Las deny rules ganan siempre.
- **"Verde en CI" ≠ "corre end-to-end en tu máquina"** si migraciones/servicios/env no están en el gate. El worktree de review necesita su `.env`, deps y a veces migraciones.
- **Checkpoints nativos NO sirven como snapshot**: solo rastrean Write/Edit, ignoran lo hecho por Bash (incluido git), y son session-scoped. El snapshot real es git.
- **Billing**: desde 2026-06-15, `claude -p` / Agent SDK en planes de suscripción consume un crédito separado del límite interactivo (relevante para loops largos).
- Algunas cifras citadas en fuentes son heurísticas de un autor, no leyes — no codificarlas como reglas duras.

## Fuentes principales
martinfowler.com/articles/branching-patterns · trunkbaseddevelopment.com · dora.dev/capabilities/trunk-based-development · martinfowler.com/articles/feature-toggles · anthropic.com/engineering/claude-code-auto-mode · code.claude.com/docs/en/{permission-modes,worktrees,tools-reference,hooks-guide,headless,scheduled-tasks,agent-sdk/file-checkpointing} · git-scm.com/docs/git-worktree · github.com/anthropics/claude-code/issues/16198
