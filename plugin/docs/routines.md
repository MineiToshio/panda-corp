# Machine-local scheduled routines — canonical definitions

The factory's automation has one layer that does NOT live in this repo: the **scheduled routines**
(Claude Code scheduled tasks, stored per-machine at `~/.claude/scheduled-tasks/<taskId>/SKILL.md`).
They are the loop's motor between builds — if a machine is rebuilt or the factory is cloned, they
must be recreated. **This file is their canonical, versioned definition** (DR-047 loop v2): the
installed copy on the owner's machine is a deployment of THIS content; when this file and the
installed routine diverge, this file wins — update the installed routine, not the other way around
(same discipline as the plugin: edit here, then deploy).

To (re)create a routine: ask the agent to create a scheduled task with the taskId, cron and prompt
below (the harness `create_scheduled_task` / `update_scheduled_task` tools), or use the Claude Code
routines UI. Routines run only while the machine is on; a missed run fires on next launch.

---

## 1. `pandacorp-memory-review` — the daily self-learning sweep

> The taskId keeps its historical name ("review") but since loop v2 (2026-07-02) it is the FULL
> sweep: **harvest → review → status**. It is trigger (2) of the DR-047 cadence — trigger (1) is
> the REQUIRED harvest at every `/pandacorp:implement` close-out, trigger (3) is on demand
> (Mission Control memory-health).

- **Cron:** `0 9 * * *` (daily, 9:00 local)
- **Description:** Diario con umbrales — barrido del loop de autoaprendizaje DR-047 v2: drena
  inboxes (fábrica + proyectos), cosecha, review/poda segura, salud del backlog; sale en silencio
  si no hay nada.
- **Prompt (canonical):**

```
Trabaja en /Users/Shared/Proyectos/panda-corp (la fábrica PandaCorp). Habla al owner SIEMPRE en español. Eres el barrido programado del loop de autoaprendizaje (DR-047, loop v2).

PASO 0 — ¿toca barrer? (corre a diario, pero solo trabaja cuando hay algo):
- Cuenta las notas pendientes: líneas con contenido en factory/memory/_inbox.md + en el .pandacorp/run/lessons.md de cada proyecto del portfolio (factory/portfolio.md tiene las rutas).
- Lee factory/memory/_last-sweep (timestamp ISO del último barrido completo; si no existe, trátalo como "hace infinito").
- Detecta proyectos huérfanos de cosecha: cualquier proyecto del portfolio con phase: release en su .pandacorp/status.yaml cuyo last_harvest falte o sea anterior a su último build.
- BARRE COMPLETO si: notas pendientes >= 20, O >= 7 días desde el último barrido (y hay al menos 1 nota pendiente), O hay algún proyecto huérfano de cosecha. Si no se cumple ninguna condición: termina EN SILENCIO (sin reporte al owner — un barrido vacío no es noticia).

BARRIDO COMPLETO:
1. Cosecha: invoca /pandacorp:memory harvest para la fábrica (drena factory/memory/_inbox.md con ruteo DR-103: defecto accionable → factory/backlog/ como BL-*, lección durable → factory/memory/, ambos → split) y /pandacorp:memory harvest <proyecto> para cada proyecto con notas pendientes o huérfano de cosecha (esto además corre count-lesson-citations.sh y estampa last_harvest en su status.yaml).
2. Review: invoca /pandacorp:memory review — deprecar/fusionar/reconciliar solo lo seguro y reversible (nunca borrar archivos); proponer promociones (promotion: proposed con target y rationale; nunca promuevas tú — eso es /pandacorp:learn + el owner). RESPETA EL PRUNE FREEZE: mientras haya menos de 3 proyectos distintos en los applied_in del store, NO propongas deprecar por "nunca recuperada" (times_applied: 0 significa "no medido", no "inútil"). Verifica que INDEX.md refleje las lecciones activas (ediciones delta, jamás regenerarlo entero).
3. Estado: invoca /pandacorp:memory status — conteos por tipo/estado, la cola de promociones (promotion: proposed), lecciones más citadas, candidatas pendientes, y la salud del backlog (bash plugin/scripts/validate-backlog.sh + los 3 BL-* abiertos más viejos, una línea cada uno).
4. Escribe el timestamp ISO de ahora en factory/memory/_last-sweep (archivo gitignored).
5. Reporte corto en español al owner: qué se drenó, qué se activó, qué espera su aprobación (la cola de promociones se aprueba con /pandacorp:learn), y la salud del backlog. Solo reporta cuando el barrido trabajó.
```

## 2. `pandacorp-review-launch` — the weekly post-launch loop (DR-043)

- **Cron:** `0 9 * * 1` (Mondays, 9:00 local)
- **Description:** Semanal — loop post-lanzamiento DR-043: métricas reales vs hipótesis de valor,
  veredicto kill/hold/double-down por proyecto lanzado.
- **Prompt (canonical):**

```
Trabaja en /Users/Shared/Proyectos/panda-corp (la fábrica PandaCorp). Habla al owner SIEMPRE en español.

Cierra el loop post-lanzamiento (DR-043): lee factory/portfolio.md y encuentra cada proyecto con `Fase: release`. Para cada uno, entra a su carpeta (ruta en la fila del portfolio) e invoca el skill /pandacorp:review-launch — lee las métricas reales (plan de eventos PostHog en docs/analytics/events.md) contra el activation milestone y los kill-signals del PRD, y produce el veredicto kill / hold / double-down con su evidencia. Actualiza las columnas de negocio (Usuarios / Retorno / Veredicto) de la fila del portfolio. NUNCA mates/archives nada por tu cuenta — el veredicto es una recomendación; matar es decisión del owner.

Si un proyecto no tiene datos (sin eventos instrumentados, deploy interno sin analytics), repórtalo honestamente como "sin datos" con la razón — no inventes números (regla: leer real o vacío honesto). Si no hay ningún proyecto en release, dilo y termina.

Al final entrega un resumen corto: proyecto · veredicto · señal clave · acción recomendada.
```

## 3. `pandacorp-consistency-sweep` — the advisory document-consistency sweep (DR-116)

> The lightweight, recurring version of the 2026-07-05 contradiction audit
> (`docs/proposals/30-factory-contradiction-sweep.md`). It is the **advisory** third layer of the
> supersession-completeness gate (`factory/standards/document-consistency.md`): the fresh-set
> verifier (spec/architecture) and the completeness check (change/iterate/learn) block at the moment
> of change; this catches drift that slips through **between** changes. It NEVER edits and NEVER
> blocks — it files what it confirms as a `BL-*` item for a fixer to close through the gate. It may
> also be run on demand as a `/loop` job, or folded into `pandacorp-memory-review`.

- **Cron:** `0 9 * * 1` (Mondays, 9:00 local — weekly, alongside the review-launch loop)
- **Description:** Semanal advisory — barrido de consistencia documental DR-116: fan-out de
  revisores sobre slices del corpus buscando contradicciones accidentales (una regla superada en un
  doc, su enunciado viejo vivo en otro); reporta y archiva como BL-*, nunca edita ni bloquea.
- **Prompt (canonical):**

```
Trabaja en /Users/Shared/Proyectos/panda-corp (la fábrica PandaCorp). Habla al owner SIEMPRE en español. Eres el barrido advisory de consistencia documental (DR-116, factory/standards/document-consistency.md). NO editas nada y NO bloqueas nada — solo detectas, deduplicas y archivas.

DEFINICIÓN de contradicción (vinculante): dos enunciados autoritativos, ACTUALES y mutuamente excluyentes sobre el mismo hecho. NO es contradicción: distinciones soft/hard, patrones "default salvo X", texto marcado como superado/tombstoned, ni un registro histórico fechado (una entrada de decision-log — era cierta cuando se escribió, es append-only). Ignora esos.

PASO 1 — Fan-out sobre slices del corpus. Reparte el corpus en 4 slices y revisa cada uno buscando pares de enunciados que se contradigan (el mismo hecho/regla/contrato afirmado de dos formas incompatibles en docs distintos):
  (a) factory/standards/ + factory/constitution.md
  (b) plugin/skills/*/SKILL.md + plugin/agents/*.md
  (c) AGENTS.md + CLAUDE.md + factory/decisions/registry.yaml
  (d) docs/ (proposals, product) + plugin/docs/
Para cada slice: lista los enunciados load-bearing (reglas, defaults, contratos, límites, nombres de modelo/stack) y contrasta con los demás slices donde el mismo hecho aparezca. Usa la tabla canonical-doc de AGENTS.md para saber qué doc OWNS cada hecho.

PASO 2 — Deduplica y verifica (critic). Junta los candidatos, quita duplicados, y para cada superviviente CONFIRMA que son de verdad dos enunciados actuales y mutuamente excluyentes (no un caso de la lista de exclusiones de arriba). Descarta los que no.

PASO 3 — Archiva, no edites. Por cada contradicción CONFIRMADA, fíchala en factory/backlog/ como un BL-* (copia factory/backlog/_item-template.md; id con `bash "${CLAUDE_PLUGIN_ROOT}/scripts/validate-backlog.sh"` que imprime el siguiente id libre; type: bug, status: open, source: pandacorp-consistency-sweep) describiendo los dos docs:línea y cuál parece el enunciado viejo. El fixer la cerrará luego pasando por el gate de completitud (change/iterate/learn). NUNCA edites los docs tú.

PASO 4 — Reporte corto al owner en español: cuántas contradicciones confirmadas, cuáles se ficharon como BL-*, una línea cada una. Si no hay ninguna, dilo en una línea y termina (un barrido limpio es buena noticia pero breve).
```
