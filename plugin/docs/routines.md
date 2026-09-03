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

## Prerequisite for EVERY routine below: the unattended permission surface

Recreating the task is not enough to make it run. **Scheduled tasks run headless in permission mode
`default`**: any tool call not already covered by an allow-rule raises an interactive prompt, and an
unattended run then **stalls silently and indefinitely** — it never times out, never auto-proceeds and
never errors. A routine that "never runs by itself" with no error message is a permission-prompt stall,
not a scheduling bug; suspect this first.

So before relying on any routine here, **pre-seed its full tool surface in `permissions.allow`** (today:
`.claude/settings.local.json` in the factory repo — gitignored and personal, so it is NOT recreated by
cloning this repo; it is covered by the vault backup, `infra.md`). Two rules for those entries:

- **Anchor the wildcard at the STRUCTURAL segment, never at a value that changes on release.** A rule
  pinned to one plugin version (`.../pandacorp/9.71.0/scripts/*:*`) or to one exact command string breaks
  the moment the plugin bumps or the command text shifts by a character, silently reintroducing the stall.
  Write `.../pandacorp/*/scripts/*:*` — the Bash matcher's `*` spans path separators.
- **Residual gap, stated honestly:** a genuinely NEW tool the routine has never used can still prompt once
  even under a broad allowlist. `defaultMode` is repo-wide and cannot be scoped to a single task from
  `settings.json`, so the only per-task zero-prompt guarantees are `bypassPermissions` or setting that one
  task's mode in the app UI (not exposed via the `scheduled-tasks` MCP tool).

Promoted from `LESSON-0119` (owner-stated, 2026-07-08 incident and fix); closes `BL-0054`.

### Permission posture: `dontAsk` + a current allowlist (DR-121, BL-0103)

**Decided posture (owner-approved, proposal 33 §12.6 option ii):** each task's own permission
configuration should be **`dontAsk`** — *"denies anything not in your `permissions.allow` rules or the
read-only command set"* — which converts the silent stall above into a **loud, visible denial** the next
run can be fixed from. **Explicitly NOT `auto`**: `auto` is a per-action classifier that *widens* approval
with nobody present, on a machine whose one recorded permanent data loss (BL-0035) still has root cause
UNKNOWN. Order matters: refresh the allowlist FIRST, flip the mode SECOND — the reverse turns every
unlisted call into an immediate denial before the allowlist is ready.

**Where the allowlist now lives.** `.claude/settings.local.json` (personal, gitignored) still holds the
owner's ad hoc entries, but any entry a *routine itself* structurally depends on belongs in the
project's tracked **`.claude/settings.json`** instead — it ships with the repo, so a fresh clone or a
rebuilt machine gets it for free (this is what closes the "new machine hits the same stall" half of
BL-0054). The bundled `fewer-permission-prompts` skill's own behaviour is to write there ("Scan your
transcripts for common read-only Bash and MCP tool calls, then add a prioritized allowlist to project
`.claude/settings.json`"), which is why that is the target, not `settings.local.json`.

**Refresh mechanism — run it, don't hand-author it again.** Run `/fewer-permission-prompts` interactively
whenever a routine is added or its tool surface changes (folded into `pandacorp-memory-review`'s own
sweep below, so the cadence is at least weekly-on-drift, not "whenever someone remembers"). It proposes
additions; apply only the narrow, safe, structurally-anchored ones (read-only Bash/MCP calls, wildcards
anchored at the structural segment per the rule above) — never a blanket rule for a domain-arbitrary
network call (`curl`) or arbitrary code execution (`python3 -c`, `node -e`), which stay hand-reviewed
case by case. A 2026-09-03 run against this repo's real transcript history (74 sessions, ~2800 recorded
tool calls) found two concrete structural gaps and applied them to `.claude/settings.json`:
`Bash(bash factory/standards/*.sh:*)` (the consistency-sweep's own PASO 0 calls
`bash factory/standards/check-standards.sh` and had no covering rule) and `Bash(git check-ignore:*)`
(the memory-review's inbox-drain step verifies `_inbox.md` isn't itself gitignored), plus the read-only
`mcp__scheduled-tasks__list_scheduled_tasks` MCP tool. Candidates involving network egress or arbitrary
code execution were deliberately excluded, not silently dropped.

**What still has no tool — an owner-only manual step.** Setting a task's permission mode is **only
exposed in the Claude Code app's routines UI**, not through `create_scheduled_task`/`update_scheduled_task`
or any other tool an agent can call — no agent, in this factory or any other, can flip it. To finish this
posture the owner needs to, per task (`pandacorp-memory-review`, `pandacorp-review-launch`, and
`pandacorp-consistency-sweep` once it is installed): open the routine in the Claude Code routines UI →
its permission-mode setting → select **Don't ask** (explicitly not **Auto**) → save. Do this only AFTER
the allowlist above is current, per the ordering rule.

Canary once the posture is live: fire `pandacorp-memory-review` and confirm a genuinely new, unlisted
tool call now fails **loud** (an explicit denial in the run's record) instead of stalling silently
forever; confirm a run that only touches allowlisted tools still completes unattended. A local proxy for
this mechanism (same `dontAsk` semantics, exercised via `claude -p --permission-mode dontAsk` against an
isolated sandbox project) is recorded as this work order's Tests evidence.

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
4. Allowlist al día (BL-0103/DR-121): corre /fewer-permission-prompts. Aplica a .claude/settings.json SOLO agregados read-only/estructurales, anclados en el segmento estructural (nunca una regla amplia para curl/dominio arbitrario ni ejecución de código arbitrario tipo `python3 -c`/`node -e` — esas quedan fuera para revisión manual). Si no propone nada nuevo, sigue de largo.
5. Escribe el timestamp ISO de ahora en factory/memory/_last-sweep (archivo gitignored).
6. Reporte corto en español al owner: qué se drenó, qué se activó, qué espera su aprobación (la cola de promociones se aprueba con /pandacorp:learn), la salud del backlog, y si el paso 4 agregó algo al allowlist. Solo reporta cuando el barrido trabajó.
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

PASO 0 — Gate del catálogo de estándares (determinista, barato). Ejecuta `bash factory/standards/check-standards.sh` y reporta su código de salida. Si sale 1, cada FAIL es una contradicción estructural confirmada (un estándar sin fila en `rule-registry.md`, un preámbulo incompleto, una forma operativa que no existe): NO la edites — fíchala en PASO 3 como cualquier otra, citando la línea FAIL literal. Este es el único disparador del script (BL-0055): si nadie lo corre, se pudre.

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
