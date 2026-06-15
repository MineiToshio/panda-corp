---
description: Arranca y ejecuta la construcción de un proyecto Pandacorp con un workflow dinámico que orquesta a los subagentes de la fábrica (backend-dev, frontend-dev, test-writer, reviewer) con TDD y revisión. El workflow corre en background, recorre todos los work orders hasta terminar y es reanudable; se sigue en vivo desde Mission Control. Usar dentro del proyecto después de /pandacorp:blueprint. Es el paso arquitectura → en construcción.
---

# /pandacorp:implement

**Este es el comando que arranca (y reanuda) la construcción.** Lanza un **workflow dinámico** (un script JS nativo de Claude Code que corre en background) que orquesta a los subagentes de la fábrica, reparte los work orders y avanza hasta terminar; lo sigues en vivo en Mission Control y en `/workflows`. Se ejecuta EN el proyecto. Al arrancar, marca `docs/estado.yaml → fase: implementacion`, `running: true` (la idea pasa a «en construcción»); al detenerse/terminar, `running: false`.

`$ARGUMENTS` opcional: un **modo** (`pro` | `potente` | `profundo`) y/o work orders específicos. Sin argumentos: modo equilibrado, construye desde el primer work order pendiente.

> **Motor = Dynamic Workflows, no Agent Teams** (DR-013). El loop de work orders vive en el **código del script** (`pipeline()` / `while`), no en mensajes entre agentes peer. Eso lo hace **reanudable de raíz** (el estado vive en variables del script + los archivos del proyecto + commits), **determinista** (dependencias y paralelismo explícitos en el código) y barato de aislar (cada subagente puede correr en su propio git worktree). Agent Teams queda solo para revisión adversarial puntual, nunca como columna vertebral.

## Modos de ejecución (control de consumo/calidad)

Los modos controlan la **concurrencia y los modelos del workflow** (cuántos `agent()` corren en paralelo y con qué modelo cada etapa), no el "tamaño del equipo":

- **pro** (`/pandacorp:implement pro`): para plan Pro / mínimo consumo. Un solo obrero a la vez (concurrencia 1), modelos económicos (sonnet/haiku). El más lento pero el más barato. **Por defecto un único agente `implementer` (full-stack) en vez de equipo dividido**: sin paralelismo, separar en backend-dev/frontend-dev no aporta velocidad y suma overhead de coordinación (handoffs, publicar contrato). El `reviewer` igual revisa al cerrar. Solo dividir si el proyecto tiene una separación back/front muy marcada.
- **equilibrado** (default): pensado para Max 5x. Hasta 3 `agent()` en paralelo; el juicio (review/arquitectura) en opus, los obreros en sonnet/haiku.
- **potente** (`/pandacorp:implement potente`): para Max 20x. Más concurrencia (hasta 5) → avanza más rápido. Úsalo cuando quieras terminar antes y tu plan lo permita.
- **profundo** (`/pandacorp:implement profundo`): máxima calidad. El mejor modelo (opus) en todas las etapas, revisión adversarial extra (las 3 lentes como subagentes concurrentes) y verificación más estricta. Más lento y más caro — para un proyecto al que le tienes cariño especial o cuando algo no está saliendo bien.

## Reanudable (no empezar de cero)

Reanudar es nativo: el estado del workflow vive en el código y en los archivos del proyecto.
- **Re-lanza `/pandacorp:implement`**: relee `docs/work-orders/` y `docs/estado.yaml` y continúa desde el primer pendiente.
- O **reanuda el run con `resumeFromRunId`**: los work orders ya cerrados devuelven su resultado cacheado y solo corre lo nuevo.

Cada work order se commitea al cerrarse → el avance no se pierde. (Ya no aplica el viejo caveat de "Agent Teams no tiene resume".)

## Operación desatendida (correr y largarse) — ver `docs/propuestas/07-construccion-desatendida.md`

El objetivo: El dueño corre `implement` y se va por horas, **sin babysitting**, y puede **probar lo avanzado cuando vuelva** sin adivinar si está "testeable". El workflow corre en background y se detiene solo cuando la cola se vacía — eso ya es "corre y lárgate", nativo. El principio: **el punto seguro no es un estado del agente, es un commit de git** — cada work order cerrado en verde es un snapshot inmutable.

- **Auto mode (permisos), no babysitting**: El dueño activa el *auto mode* de Claude Code (Shift+Tab → "Auto mode", o `defaultMode: "auto"` en SU `~/.claude/settings.json` — el repo no puede auto-concedérselo). Con eso los subagentes dejan de preguntar "¿continúo?" y solo se detienen en rojo irrecuperable o en un gate humano. **Auto mode (permisos) ≠ modo de construcción (concurrencia/modelos).** NUNCA `--dangerously-skip-permissions`.
- **Freeze-on-red (sale natural del pipeline)**: una etapa que no pasa el gate **lanza (throw)** → ese work order cae a `null` y el `pipeline()` **sigue con los work orders independientes**, sin frenar el lote por un frente roto. Para el WO roto: NO commitees lo roto, deja `HEAD` en el último verde (`last_green_sha`), márcalo `BLOQUEADO` en `docs/estado.yaml` y **emite una notificación al dueño** (hook Notification / PushNotification).
- **Circuit breakers** (obligatorios para no quemar plata desatendido): tope de iteraciones, detección de no-progreso (mismo error / diff vacío / mismo test fallando N veces) y tope de presupuesto por corrida (el `budget` del workflow). Van en la condición del loop del script. El backstop nativo de auto mode (pausa tras bloqueos del clasificador) NO sustituye esto.
- **`/loop` vs `/goal` — cuál y cuándo** (no son alternativas a `implement`; son el *motor de cadencia* que `implement` invoca según el caso):
  - **Build normal**: ninguno de los dos. El workflow ES el loop; corre hasta vaciar la cola y para solo.
  - **Fábrica continua / desatendida**: envuelve `implement` en **`/loop`** *self-paced* para re-lanzar el workflow cada tanto, recoger las bandejas (`docs/bugs/`, `docs/decisiones.md`) y seguir. NO a intervalo fijo de cron (los scheduled tasks expiran y meten delays).
  - **`/goal`**: herramienta de borde — para una sesión supervisora que no debe parar hasta una condición concreta. Raro con workflows, porque el workflow ya trae su propia condición de fin.
- **Probar un snapshot SIN parar la construcción (git worktrees)**: El dueño prueba el último verde en OTRA carpeta — `git worktree add ../<proyecto>-review <last_green_sha>` — mientras el workflow sigue. Mantiene UNA sola carpeta de review y la refresca al último verde. El cockpit le da el comando listo. Cada subagente trabaja idealmente en su propio worktree aislado (`isolation: 'worktree'`).
- **BD en dev con Docker** (`fabrica/estandares/infra.md`): cada proyecto y cada worktree levanta su BD en Docker, con puerto propio, para que la prueba del dueño y la del agente no se pisen.

## Cómo corre (forma del workflow)

El skill autoriza **lanzar un workflow dinámico** con el tool Workflow. Su forma:

- **Estado en archivos**: lee `docs/work-orders/` (cola + dependencias) y `docs/estado.yaml`; escribe avance ahí mismo (el cockpit lo lee en vivo).
- **`pipeline(workOrders, build, review, verify)`** — cada work order recorre las 3 etapas sin barrera entre items (un WO puede estar en *review* mientras otro está en *build*). Concurrencia y modelos por modo (DR-014); cada `agent()` puede correr en su worktree (`isolation: 'worktree'`).
- Una etapa que falla **lanza** → freeze-on-red gratis (ese WO se salta, los independientes siguen).
- Cada subagente **emite su evento** a Mission Control (`emit-event.sh`) y **escribe el contexto crítico a archivos**, no solo lo retorna.

Esta forma ya viene **scripteada como workflow guardado** en cada proyecto: `.claude/workflows/pandacorp-build.js` (lo trae el scaffold). `implement` lo lanza con el tool Workflow:

```
Workflow({ name: "pandacorp-build", args: { mode } })   // mode: pro | equilibrado | potente | profundo
```

El script lee la cola, arma las **olas por dependencias** (paralelo dentro de la ola, barrera entre olas; en `pro`, de a una), spawnea los subagentes del stack vía `agentType` (DR-013), corre el gate y commitea cada WO en verde. Es **agnóstico de la app**: solo depende de la cola de work orders y del `verify.sh` del proyecto — nada del producto está hardcodeado. Para proyectos triviales (un solo módulo) usa un solo `implementer`, sin pipeline.

## Composición y modelos

- **Composición según stack** (DR-013): web (A) → `backend-dev` + `frontend-dev` + `test-writer`, con el `reviewer` al cerrar. API/scraper (B/C/D) → `backend-dev` + `test-writer` (sin frontend). **Sin investigador fijo**: los obreros llaman al `researcher` a demanda; la investigación de fondo ya se hizo en spec y blueprint.
- **Concurrencia y modelos** (DR-014, diseñar para Max 5x): hasta 3 `agent()` simultáneos; juicio en opus, obreros en sonnet/haiku. Si el dueño construye la propia fábrica, puede subir concurrencia (Max 20x).

## Loop por work order (cada item del pipeline)

1. **Selecciona** el siguiente work order según `docs/work-orders/README.md` (respeta dependencias) y márcalo `en-progreso`.
2. **build — reparte con dependencias** (orquestadas en el script, no por mensajes peer):
   - `backend-dev`: implementa datos/lógica/API con TDD; publica el contrato en `docs/api.md`.
   - `frontend-dev`: arranca en su etapa cuando el contrato está listo; implementa UI con design tokens y **consume los strings del `copywriter`** desde los recursos i18n (`docs/diseno/voz-y-tono.md` + claves) — cero texto hardcodeado ni "Error 500" improvisado.
   - `test-writer`: escribe/corre tests de aceptación (RED antes de implementar; e2e de los flujos al cerrar).
   - **Telemetría**: cuando un work order toca un flujo del plan de eventos (`docs/analitica/eventos.md`), se instrumenta ahí mismo (el `analytics` definió qué/dónde; sin PII, DR-025). No se deja para después.
   - Cada agente escribe el contexto crítico a archivos (los archivos son la fuente de verdad compartida entre etapas).
3. **review** (agente `reviewer`, modelo distinto al generador): verifica evidencia él mismo (corre tests/lint/typecheck) y **escribe tests adversariales que el implementer no vio** (DR-015), anclados en EARS y en bugs de `docs/progreso.md`. Revisa con sus 3 lentes. En **modo profundo**, las 3 lentes (correctitud / seguridad / calidad) corren como **subagentes concurrentes** (terminan en el tiempo del más lento, no la suma) y se exige **mutation testing** en hitos de FRD (DR-016). RECHAZADO → vuelve al agente responsable con los hallazgos (máx. 2 ciclos; al tercero, escala al dueño).
4. **verify — cierra (punto seguro)**: SOLO si `.pandacorp/verify.sh` pasa, commitea/mergea el work order; work order → `terminado` con evidencia; el script del gate escribe en `docs/estado.yaml` el `last_green_sha` (commit) y `safe_to_test: true`. **Nunca commitees a medio work order.**
5. **Revisa las bandejas** (en este punto seguro, nunca a media obra — así es como el dueño te habla sin parar la construcción):
   - `docs/bugs/` → bugs nuevos: primero un **test de regresión** que lo reproduce, luego el fix; prioriza los `crítico`.
   - `docs/estado.yaml` `replanteo_pendiente: true` → `iterate` pidió pausar por un cambio fuerte: **detente limpio aquí** y avisa al dueño.
   - `docs/decisiones.md` → pendientes que el dueño ya respondió con `/decide`: aplícalas y desbloquea ese frente.
6. **Hito de FRD**: al completar los work orders de un FRD, corre la suite e2e de ese FRD y **mata los dev servers de prueba con `TaskStop`** (evita procesos zombie). Repite hasta agotar work orders.

> El cockpit (Mission Control) muestra en vivo este workflow: los eventos los emiten los subagentes (`emit-event.sh`) y el hook `SubagentStop` de la fábrica a `~/.claude/dashboard-events.ndjson`. No requiere acción del agente. Mientras tanto, `/workflows` da la vista nativa en vivo.

## Documentación en tiempo real (clave para reanudar y para el cockpit)

Mientras se construye, mantener SIEMPRE actualizado (el cockpit lo lee en vivo):
- **`docs/work-orders/`**: estado de cada work order (`todo` → `progress` → `review` → `done`) con evidencia al cerrar. Es la vista de solo-lectura del cockpit.
- **`docs/estado.yaml`**: `progreso:` (una línea de qué se está haciendo ahora), `running`, work orders hechos/total.
- **`docs/progreso.md`**: bitácora append-only (qué se hizo, decisiones tomadas, problemas). Permite retomar sin contexto previo.
- **Desviaciones**: si algo NO funciona como se planeó, documéntalo en el work order y en `docs/progreso.md` ("esto hay que mejorar / cambiamos X porque Y"). No lo escondas.

## Puntos de decisión (escalado al dueño, visible en el cockpit)

Cuando aparezca algo que no estaba resuelto: **primero investiga** (delega al `researcher`) y, si con eso puedes tomar la decisión coherente tú mismo, hazlo y documéntalo en `docs/progreso.md`. **Solo escala al dueño las decisiones genuinamente humanas**: scope de producto, algo irreversible, gastar dinero, o lo que el registro de decisiones marca como humano. En ese caso NO adivines: anótalo en `docs/decisiones.md` como `pendiente` (qué pasa, opciones investigadas, **tu recomendación**) y, si bloquea ese frente, sigue con otros work orders. El cockpit resalta estas entradas (un chip con el número de pendientes por proyecto). El dueño responde con **`/pandacorp:decide`**, que registra su respuesta en `docs/decisiones.md` y desbloquea el frente.

## Al terminar todos

- Suite completa + e2e en verde, `docs/estado.yaml` → `fase: release`.
- Resumen al dueño: qué se construyó, evidencia, y siguiente paso `/pandacorp:release`.

## Reglas
- Nunca avanzar con tests rojos. Errores idénticos repetidos 3 veces = **freeze-on-red** (no commitear lo roto, dejar HEAD en `last_green_sha`, marcar el WO `BLOQUEADO`, notificar al dueño, seguir con WOs independientes — el `pipeline()` lo hace solo cuando una etapa lanza).
- Límites de cuota: si se topan rate limits, baja la concurrencia del workflow (menos `agent()` en paralelo) y/o baja los modelos de los obreros. No es un error del código.
- Si un work order revela que el blueprint/FRD estaba mal, documenta el conflicto, ajusta el documento fuente (ADR si es arquitectónico) y recién continúa.
- Para proyectos triviales o sin separación clara (un solo módulo), está bien usar un único agente `implementer` en vez del pipeline completo.
- **Procesos largos en background**: dev servers, watchers y builds se corren como background tasks para no bloquear. Los checkpoints de Claude Code son red de seguridad de sesión, pero NO reemplazan el commit por work order ni rastrean cambios hechos por Bash — commitea cada work order al cerrarlo.
- **No confiar en la honestidad del obrero** (constitución §22): la propensión a "hacer trampa" depende del modelo; por eso el `reviewer` re-verifica todo y el entorno es fail-closed. Nunca relajar la verificación porque "el agente dijo que pasó".
