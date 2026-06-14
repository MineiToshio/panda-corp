---
description: Arranca y ejecuta la construcción de un proyecto Pandacorp con un equipo de agentes (Agent Teams) que se comunican y se pasan el trabajo, con TDD y revisión. Corre todos los work orders hasta terminar, y se sigue en vivo desde Mission Control. Usar dentro del proyecto después de /pandacorp:blueprint. Es el paso arquitectura → en construcción.
---

# /pandacorp:implement

**Este es el comando que arranca (y reanuda) la construcción.** Dispara el equipo de agentes, reparte los work orders y avanza hasta terminar; lo sigues en vivo en Mission Control. Se ejecuta EN el proyecto. Al arrancar, marca `docs/estado.yaml → fase: implementacion`, `running: true` (la idea pasa a «en construcción»); al detenerse/terminar, `running: false`.

`$ARGUMENTS` opcional: un **modo** (`pro` | `potente` | `profundo`) y/o work orders específicos. Sin argumentos: modo equilibrado, construye desde el primer work order pendiente.

## Modos de ejecución (control de consumo/calidad)

- **pro** (`/pandacorp:implement pro`): para plan Pro / mínimo consumo. Un solo obrero a la vez (sin paralelismo), modelos económicos (sonnet/haiku). El más lento pero el más barato.
- **equilibrado** (default): pensado para Max 5x. Equipo ≤3 agentes; líder en opus, obreros en sonnet/haiku.
- **potente** (`/pandacorp:implement potente`): para Max 20x. Más agentes en paralelo (hasta 5) → avanza más rápido. Úsalo cuando quieras terminar antes y tu plan lo permita.
- **profundo** (`/pandacorp:implement profundo`): máxima calidad. Todos los agentes en el mejor modelo (opus), revisión adversarial extra y verificación más estricta. Más lento y más caro — para un proyecto al que le tienes cariño especial o cuando algo no está saliendo bien.

## Reanudable (no empezar de cero)

Si la conversación se corta o te quedas sin tokens, **vuelve a correr `/pandacorp:implement`**: lee el estado de `docs/work-orders/` y `docs/estado.yaml` y continúa desde el primer pendiente. Cada work order se comitea al cerrarse → el avance no se pierde.

## Operación desatendida (correr y largarse) — ver `docs/propuestas/07-construccion-desatendida.md`

El objetivo: Sergio corre `implement` y se va por horas, **sin babysitting**, y puede **probar lo avanzado cuando vuelva** sin adivinar si está "testeable". El principio: **el punto seguro no es un estado del agente, es un commit de git** — cada work order cerrado en verde es un snapshot inmutable.

- **Auto mode (permisos), no babysitting**: Sergio activa el *auto mode* de Claude Code (Shift+Tab → "Auto mode", o `defaultMode: "auto"` en SU `~/.claude/settings.json` — el repo no puede auto-concedérselo). Con eso el agente deja de preguntar "¿continúo?" y solo se detiene en rojo irrecuperable o en un gate humano. **Auto mode (permisos) ≠ modo de construcción (equipo/modelos).** NUNCA `--dangerously-skip-permissions`.
- **Freeze-on-red**: si un work order no pasa el gate tras los reintentos (máx. 3), NO commitees lo roto: deja `HEAD` en el último verde (`last_green_sha`), marca el work order `BLOQUEADO` en `docs/estado.yaml`, **emite una notificación a Sergio** (hook Notification / PushNotification), y **sigue con otros work orders que no dependan del roto**. No pares todo el lote por un frente.
- **Circuit breakers** (obligatorios para no quemar plata desatendido): tope de iteraciones, detección de no-progreso (mismo error / diff vacío / mismo test fallando N veces) y tope de presupuesto por corrida. El backstop nativo de auto mode (pausa tras bloqueos del clasificador) NO sustituye esto.
- **Probar un snapshot SIN parar al agente (git worktrees)**: Sergio prueba el último verde en OTRA carpeta — `git worktree add ../<proyecto>-review <last_green_sha>` — mientras el agente sigue en la suya. Mantiene UNA sola carpeta de review y la refresca al último verde. El cockpit le da el comando listo. El agente trabaja idealmente en su propio worktree aislado.
- **`/loop`**: SÍ como *self-paced* / `/goal` ("corre hasta vaciar la cola y para solo"). NO a intervalo fijo (los scheduled tasks expiran y meten delays). Para trabajo continuo: este loop de Agent Teams + background tasks + Monitor.
- **BD en dev con Docker** (`fabrica/estandares/infra.md`): cada proyecto y cada worktree levanta su BD en Docker, con puerto propio, para que la prueba de Sergio y la del agente no se pisen.

## Preparación del equipo (una vez por sesión)

1. **Habilitar Agent Teams**: requiere `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"` en el `settings.json` del proyecto (la plantilla del scaffold ya lo trae). Si no está, avisar a Sergio para activarlo.
2. **Composición según stack** (DR-013):
   - Stack A (web): equipo de **backend-dev + frontend-dev + test-writer**, con el reviewer al cerrar.
   - Stack B/C/D (API/scraper): equipo de **backend-dev + test-writer** (sin frontend).
   - **Sin investigador fijo en el equipo**: backend-dev y frontend-dev llaman al `researcher` a demanda cuando les falta algo. La investigación de fondo ya se hizo en spec (producto) y blueprint (técnico).
3. **Tamaño y modelos** (DR-014, diseñar para Max 5x): máximo 3 agentes simultáneos; líder (esta sesión) en opus, obreros en sonnet/haiku. Si Sergio está construyendo la propia fábrica, puede usar equipos mayores.

## Loop por work order

1. **Selecciona** el siguiente work order según `docs/work-orders/README.md` (respeta dependencias). Créalo como tarea del equipo y márcalo `en-progreso`.
2. **Reparte con dependencias** (mensajes entre agentes + task list compartida):
   - `backend-dev`: implementa datos/lógica/API con TDD; publica el contrato en `docs/api.md` y avisa al frontend.
   - `frontend-dev`: arranca cuando el contrato está listo; implementa UI con design tokens; avisa a test-writer al terminar una pantalla.
   - `test-writer`: escribe/corre tests de aceptación (RED antes de implementar; e2e de los flujos al cerrar).
   - Cada agente escribe el contexto crítico a archivos, no solo a mensajes (Agent Teams es experimental, no hay resume).
3. **Review** (agente `reviewer`, modelo distinto al generador): verifica evidencia él mismo (corre tests/lint/typecheck) y **escribe tests adversariales que el implementer no vio** (DR-015), anclados en EARS y en bugs de `docs/progreso.md`. Revisa con sus 3 lentes. En **modo profundo**, las 3 lentes (correctitud / seguridad / calidad) corren como **subagentes concurrentes** (terminan en el tiempo del más lento, no la suma) y se exige **mutation testing** en hitos de FRD (DR-016). RECHAZADO → vuelve al agente responsable con los hallazgos (máx. 2 ciclos; al tercero, escala a Sergio).
4. **Cierra (punto seguro)**: SOLO si `.pandacorp/verify.sh` pasa, commitea/mergea el work order; work order → `terminado` con evidencia; el script del gate escribe en `docs/estado.yaml` el `last_green_sha` (commit) y `safe_to_test: true`. **Nunca commitees a medio work order.**
5. **Revisa las bandejas** (en este punto seguro, nunca a media obra — así es como Sergio te habla sin parar la construcción):
   - `docs/bugs/` → bugs nuevos: primero un **test de regresión** que lo reproduce, luego el fix; prioriza los `crítico`.
   - `docs/estado.yaml` `replanteo_pendiente: true` → `iterate` pidió pausar por un cambio fuerte: **detente limpio aquí** y avisa a Sergio.
   - `docs/decisiones.md` → pendientes que Sergio ya respondió con `/decide`: aplícalas y desbloquea ese frente.
6. **Hito de FRD**: al completar los work orders de un FRD, corre la suite e2e de ese FRD y **mata los dev servers de prueba con `TaskStop`** (evita procesos zombie). Repite hasta agotar work orders.

> El cockpit (Mission Control) muestra en vivo este equipo: los eventos los emiten los hooks de la fábrica a `~/.claude/dashboard-events.ndjson`. No requiere acción del agente.

## Documentación en tiempo real (clave para reanudar y para el cockpit)

Mientras se construye, mantener SIEMPRE actualizado (el cockpit lo lee en vivo):
- **`docs/work-orders/`**: estado de cada work order (`todo` → `progress` → `review` → `done`) con evidencia al cerrar. Es la vista de solo-lectura del cockpit.
- **`docs/estado.yaml`**: `progreso:` (una línea de qué se está haciendo ahora), `running`, work orders hechos/total.
- **`docs/progreso.md`**: bitácora append-only (qué se hizo, decisiones tomadas, problemas). Permite retomar sin contexto previo.
- **Desviaciones**: si algo NO funciona como se planeó, documéntalo en el work order y en `docs/progreso.md` ("esto hay que mejorar / cambiamos X porque Y"). No lo escondas.

## Puntos de decisión (escalado a Sergio, visible en el cockpit)

Cuando aparezca algo que no estaba resuelto: **primero investiga** (delega al `researcher`) y, si con eso puedes tomar la decisión coherente tú mismo, hazlo y documéntalo en `docs/progreso.md`. **Solo escala a Sergio las decisiones genuinamente humanas**: scope de producto, algo irreversible, gastar dinero, o lo que el registro de decisiones marca como humano. En ese caso NO adivines: anótalo en `docs/decisiones.md` como `pendiente` (qué pasa, opciones investigadas, **tu recomendación**) y, si bloquea ese frente, sigue con otros work orders. El cockpit resalta estas entradas (un chip con el número de pendientes por proyecto). Sergio responde con **`/pandacorp:decide`**, que registra su respuesta en `docs/decisiones.md` y desbloquea el frente.

## Al terminar todos

- Suite completa + e2e en verde, `docs/estado.yaml` → `fase: release`.
- Resumen a Sergio: qué se construyó, evidencia, y siguiente paso `/pandacorp:release`.

## Reglas
- Nunca avanzar con tests rojos. Errores idénticos repetidos 3 veces = **freeze-on-red** (no commitear lo roto, dejar HEAD en `last_green_sha`, marcar el WO `BLOQUEADO`, notificar a Sergio, seguir con WOs independientes).
- Límites de cuota: si se topan rate limits, reducir el equipo (menos agentes en paralelo) y/o bajar modelos de obreros. No es un error del código.
- Si un work order revela que el blueprint/FRD estaba mal, documenta el conflicto, ajusta el documento fuente (ADR si es arquitectónico) y recién continúa.
- Para proyectos triviales o sin separación clara (un solo módulo), está bien usar un único agente `implementer` en vez de equipo.
- **Procesos largos en background**: dev servers, watchers y builds se corren como background tasks para no bloquear el loop. Los checkpoints de Claude Code son red de seguridad de sesión, pero NO reemplazan el commit por work order ni rastrean cambios hechos por Bash — commitea cada work order al cerrarlo.
- **No confiar en la honestidad del obrero** (constitución §22): la propensión a "hacer trampa" depende del modelo; por eso el `reviewer` re-verifica todo y el entorno es fail-closed. Nunca relajar la verificación porque "el agente dijo que pasó".
