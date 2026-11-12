# Engine v2: the session protocol for a `pandacorp-build` run

**Default and only build engine.** `/pandacorp:implement` follows this protocol for every build and resume. Policy, thresholds and matrices live in
`factory/standards/build-engine.md` (BUILD-7..15); every command, flag, exit code, file and JSON shape lives in
`plugin/docs/build-engine-cli.md`. This file says only what the **session** does, in order. Autonomy (first minute,
doubts, parking, gates) is in `autonomy.md`; the Codex relay in `drive.md`.

The same protocol runs in Claude Code and in Codex. The CLI is the brain: scope, size, routing, admission, quota
policy, review cells, integration, parking and landing. **The session converses, writes the scope card, relays
units, files their reports, reads quota, notifies and reports.** It writes code only for a unit `next` hands it
with `via:"session"`.

## 0. Invariants (read before step 1)

1. **Never edit build state by hand.** Not `.pandacorp/run/**` (lease, token file, `build/state.json`, journal,
   jobs, handoff, quota, doubt records), not WO frontmatter, not `status.yaml`. The only files you write under
   `.pandacorp/run/` are `.pandacorp/run/scope.json`, unit reports at `report_path`, `build/units/<unit>/doubt.json`,
   `build/units/<unit>/answer.json` and `build/doubts/<id>.sources.json`. **Never commit in the main checkout**: every
   tracked change of a run is a CLI commit on `lane/<run_id>/integration`, and `land` (merge-queue) is the only path to `main`.
2. **Never wait for an owner "sí"** except the first-minute asks (`autonomy.md` §1) and a human gate (§4 there).
   Risk zone, giant size, `phase: release`, a doubt: none of them waits for the owner.
3. **Never watch by hand and never end the turn while anything runs.** No `tail`, no `sleep`, no shell polling.
   While any unit, job or worker runs, loop `next --wait 60`: each call also renews the lease (ttl 30 min). A
   silent coordinator lets the lease expire, and that is a relay trigger for drive (`drive.md`).
4. **Human gates are untouched**: production landing, spending money, deleting data, external communications. The
   session never pushes and never runs `merge-queue.sh`; it sets `PANDACORP_OWNER_RELEASE_OK=1` only on the one
   `land` the owner ordered in chat (`autonomy.md` §4).
5. **One JSON line per call.** Read `ok`, `code` and the exit status of every CLI call; act on the table of §9.
6. Fable (and `max` effort) is never chosen: dispatch exactly the `model`/`effort` the CLI returns (CONV-12).
7. Owner-facing text is Spanish, without em or en dashes; this file and every committed artifact are English.
8. Never print, log or commit the lease token. Pass a unit `token` only on `report`, `review-record` and the `doubt answer` of a `via:"agent"` consult.

## 1. How to call the CLI

Below, `pb <cmd>` means:

| Runtime | Exact invocation |
|---|---|
| Claude Code | `node "${CLAUDE_PLUGIN_ROOT}/scripts/pandacorp-build.mjs" <cmd> --project <projectDir> …` |
| Codex | `node "<factory>/plugin/scripts/pandacorp-build.mjs" <cmd> --project <projectDir> …`, `<factory>` = the `Factory:` path in `.pandacorp/guide.md` |

`<projectDir>` is the nearest ancestor of the cwd holding `.pandacorp/status.yaml`. Every fenced call carries
`--epoch <E>`, the epoch returned by `start --run` or `start --resume`. Run `next --wait 60` with a shell timeout of
at least 90 s (Claude Code Bash `timeout: 90000`).

## 2. Step 0: project, label, session facts

1. **Project.** `.pandacorp/status.yaml` missing → stop and say (Spanish) the folder is not a factory project yet
   (`/pandacorp:adopt` or `/pandacorp:spec`). `overlay_version` behind the plugin → `/pandacorp:upgrade` first (DR-048).
2. **Label** (who builds: `claude` or `codex`), precedence: **explicit word in the arguments** > **orchestrate flag**
   > **session runtime**. The flag is `~/.claude/state/orchestrator-mode/$CLAUDE_CODE_SESSION_ID.on` (content
   `claude` or `codex`); it is **read-only** for this skill: never create, write or delete it. Codex has no flag.
   Pass the raw arguments and the session id; the CLI applies the precedence and returns `label` and `label_source`.
   Legacy words `pro|balanced|powerful|deep` are ignored by the CLI with a warning; never translate them into flags.
3. **Coordinator.** Claude Code: `--session-runtime claude`, `--coordinator claude`; label `claude` = Claude agents,
   label `codex` = the CLI launches `codex exec` workers. Codex app: `--session-runtime codex`, `--coordinator codex`: if the owner's raw
   arguments contain the word `claude`, refuse before calling the CLI (the Codex hook denies any command containing
   that word) with the Spanish line below and stop;
   one builder at a time, no Claude anywhere. Label `claude` in the Codex app is refused: tell the owner "Esto se
   construye con Claude: ábrelo en Claude Code y escribe `/pandacorp:implement claude`." and stop.
4. **Session model.** Note your own model (`sonnet`, `opus`, `haiku`, or `sol`/`astra` in Codex); pass it as
   `--session-model`.

## 3. Step 1: the scope card (only when this conversation ordered something)

Write a card **only** if, in THIS conversation, the owner described or accepted a behavior AND gave the order
("impleméntalo"). Otherwise skip to step 2 without a card; never infer scope from other conversations.

1. File `.pandacorp/inbox/changes/<slug>.md` (English kebab slug). Frontmatter (schema
   `plugin/runtime/build/schemas/card-frontmatter.schema.json`): `type` (`bug|feature|change`), `class: standard`,
   `status: ready`, `date`, `frd` (if one), `origin: conversation`, `affected_frds: [...]`, `engine: v2`. Never
   `integration_paths` or `integration_transaction` (v1 fields). Body in Spanish: an H1 title, **Dentro** (one
   bullet per point, each ending with a quote of the owner's message, at most one line, in quotes), **Fuera** (what
   was discussed and dropped, other cards, pending plan WOs), **Dudas** (open questions; empty if none).
2. Conservative defaults: a point whose only source is a post-compaction summary goes to Fuera as
   "por confirmar"; exclude before including.
3. Validate: `pb card check .pandacorp/inbox/changes/<slug>.md`. Exit 6 → fix the listed `errors[]` and re-check.
4. "Anótalo para después" (not "impleméntalo") → write the same card with `status: draft`, `card check` it, tell the
   owner its slug, and stop. No build.

The docs this card needs (FRD delta, WOs, decision-log line) are written by the run's first `docs` unit on
`lane/<run_id>/integration` (commit `Change-Docs: <slug>`), never by the session and never on `main`.

## 4. Step 2: detect

```
pb start --detect --args "<raw arguments>" --session-id <id> --session-runtime claude|codex [--session-card <card path>]
```

Act on `row` (1-7, first match wins; full table in `build-engine-cli.md`):

| Row | Session action |
|---|---|
| 1 lease `live`, no `--resume` | Do not build. The card stays `ready`. Put "¿lo construyo después?" in the first-minute message (default: queda en cola) and stop after it |
| 2 `--resume`, or a stale/absent lease with a non-terminal v2 run, or a v2 `building` card | `pb start --resume --coordinator claude|codex` (step 4.2). With a session card the CLI already returns row 5 with `suspendable_run`: build the card (the first minute asks `conflict.paused_plus_card`, default: primero lo conversado, después el run pausado); `start --run` suspends the paused run, and `pb start --resume --run <id> --coordinator …` resumes it after this run ends |
| 3 target card | `ready` → build it. `draft` → complete Dentro/Fuera from the card itself, `card check`, ask in the first minute (default: se construye como quedó completada) |
| 4 target FRDs | Build their pending WOs. Unmet cross-FRD deps → hand-back; tell the owner which deps, never pull them in |
| 5 session card | Build only what was conversed |
| 6 pending plan WOs | Build them; launched project → everything waits on `lane/<run_id>/integration` for the owner's order |
| 7 nothing | List `cards` (ready/draft) and `cards_half` to the owner in Spanish and stop |

Write the returned `scope` object verbatim to `.pandacorp/run/scope.json` (an input file, not state); it is the
`--scope-json` of steps 3 and 4. Version-scale scope (new PRD, several epics) is not built: say so and stop.

## 5. Step 3: quota reading, then preflight

1. **Claude quota (Claude Code only).** Call the Desktop tool `get_usage` (`mcp__ccd_session_mgmt__get_usage`). From
   its `plan` limits: `pb quota record --provider claude --five-hour <P> --weekly <P> --five-hour-resets-at <ISO>
   --weekly-resets-at <ISO>`. Status `unavailable` or `not_applicable`, or no such tool (terminal Claude Code) →
   `pb quota record --provider claude --status unavailable` (unknown: reactive only; the first message says so). In
   Codex skip this. During a run add `--epoch <E>` so the reading is journaled.
2. **Preflight** (no LLM, CLI target ≤60 s; always pass `--probe-codex`, the CLI probes only when needed):
   ```
   pb start --preflight --row <row> --scope-json .pandacorp/run/scope.json --label <label> --session-model <m> --probe-codex
   ```
   Read `checks[]`, `need_from_owner[]`, `announce{}`, `drive_armable`. It also writes `build/preflight.json`.
3. Build the first-minute message as `autonomy.md` §1 says. Do not send it yet: `start --run` comes first, because
   the message says "Arrancó".

## 6. Step 4: start the run, then the one first-minute message

1. ```
   pb start --run --scope-json .pandacorp/run/scope.json --label <label> --coordinator claude|codex --session-model <m> [--answers <json>]
   ```
   `--answers` carries only answers the owner already gave in this conversation (question id → value); every other
   ask starts on its default. Use BUILD-9 adaptive admission by default; pass `--k`/`--mode` only when the owner explicitly asked for an override. Keep `run_id`, `epoch`,
   `drive{armed, reason}`, `prepush`. Exit 4 → row 1 behavior; exit 5 "re-run preflight" (older than 15 min or another
   scope) → repeat step 3.2 once, then this call; other exit 5 → the scope is not buildable: tell the owner the
   `message` in Spanish and stop; exit 6 → fix the card and retry once.
2. **Resume (row 2):** `pb start --resume --coordinator claude|codex --session-model <m>` (add `--owner-confirmed` only when the CLI
   exits 6 asking for it and the owner confirmed in chat; a run held by drive needs no confirmation). It transfers the lease to this session at once, also from drive. Keep
   `epoch`, `reattached[]`, `requeued[]`, then go to step 5 (no first-minute message beyond a one-line "Retomo
   <run_id>: <N> piezas en marcha.").
3. Claude Code: call `request_keep_awake` (`mcp__ccd_host__request_keep_awake`) with `until: "session_idle"` and
   reason "Build de Pandacorp en curso".
4. **Send the single first-minute message** (`autonomy.md` §1.3), ending with "Puedes irte. Te aviso si algo
   necesita tu firma; el informe estará en Mission Control y aquí."
5. From here on the owner is gone. Ask nothing else; wait for no reply. Continue in the same turn.

## 7. Step 5: the loop

Repeat until a terminal action (`done`, `paused-quota`, `waiting-owner`, `deadlock`, `stop`) or
`handoff`:

```
pb next --epoch <E> --wait 60
```

| `action` | Do |
|---|---|
| `dispatch` | For each unit in `units[]`, print its `dispatch_line` verbatim, then by `via`: `cli` → nothing (the CLI launched the Codex worker and ingests it); `agent` → launch it (below); `session` → do it yourself (below). Launch all `agent` units of one `next` in ONE message, in the background |
| `wait` | Call `next --epoch <E> --wait 60` again (it returns early when a report, a job, a worker, an answer or a handoff appears). For reason `disk`, report the allocation wait and let existing work continue; never bulk-delete state. Never end the turn instead |
| `land` | The batch is complete: `pb land --epoch <E>` (below) |
| `handoff` | `drive.md` §3 |
| `done` | `pb finish --epoch <E>`, then the final report (step 6) |
| `paused-quota`, `waiting-owner`, `deadlock`, `stop` | Already applied by the CLI (state set, lease released, drive standby ended). Do not call `finish`; take the data from `pb summary` and write the final report (step 6) with the reason on top (each company's `resets_at` for quota; the open questions for `waiting-owner`; for `stop`: nothing else can progress), notify, stop |

`notes_es[]` are owner-facing lines: keep them for the final report, never paraphrase them into English.

**Launching an `agent` unit.** Claude Code: `Agent` with `subagent_type` = `agent_type`, `model` = the unit's
`model` (`sonnet|opus|haiku`), `effort` = the unit's `effort`, `run_in_background: true`, prompt exactly: "Read the
brief at `<brief_path>` and follow it. Work only in `<worktree>`. Write your JSON report to `<report_path>` (schema
`<schema_path>`) and print the same JSON as your final message. Unit `<unit>`, token `<token>`." Never
`isolation: "worktree"` (the CLI owns the worktrees), never another model or effort. A `doubt-consult` unit
(`agent_type` `general-purpose`) uses the consult prompt of `autonomy.md` §2 instead, with no unit or token. A
`tests` unit is dispatched like any other: its RED-by-assertion check and hashing are the CLI's. Codex app: Codex
units come `via:"cli"`; a `via:"agent"` unit names a Claude model the app cannot run: `pb handback --epoch <E>
--unit <unit> --reason "Claude unreachable from the Codex app"`.

**A `via:"session"` unit** (a touch the coordinator writes itself): read its brief, edit only inside its
`worktree` and `artifacts`, run the brief's verification commands, never `git commit`, then write the report JSON
(schema at `schema_path`, `authored_by` = your own model) to `report_path` and file it like any report.

**Filing the result** (as each unit returns):
1. If `report_path` does not exist but the agent's final message is the JSON, write that message **verbatim** to
   `report_path` (transport only, no edits). No JSON from a build/review unit → `pb handback --epoch <E> --unit
   <unit> --reason "worker returned no report"`; from a `doubt-consult` unit → `autonomy.md` §2 step 3.
2. `pb report --epoch <E> --unit <unit> --token <token> --file <report_path>` for docs/tests/build/patch
   units; `pb review-record --epoch <E> --unit <unit> --token <token> --file <report_path>` for `review`,
   `deferred-review` and `audit`; `doubt-consult` → `pb doubt answer` (`autonomy.md` §2).
3. `report` outcome: `committed` → safe point; `rejected`, `failed`, `blocked` → nothing to do (the CLI queues the
   next attempt itself, attempt 3 included, or hands back); `doubt` → `autonomy.md` §2; `waiting_gate` → `autonomy.md`
   §4. `review-record` verdict `doubt` → `autonomy.md` §2; `pass|reopen|blocked` → nothing to do. Never re-dispatch a
   unit yourself and never "fix" its files.

**Landing** (only when `next` returns `action: "land"`): `pb land --epoch <E>`. Result `running` (a land job runs
merge-queue; `next` harvests it) or `nothing_to_land` (reasons such as `busy_main`, retried at a later safe point) →
continue the loop; `landed` → safe point; exit 7 `waiting_gate` → production gate (`autonomy.md` §4), continue;
exit 6 `handback` → continue, it goes into the report.

**At every safe point** (a `committed` report, a `review-record`, a `landed` result): Claude Code only, read
`get_usage` again and `pb quota record … --epoch <E>`; then continue with `next`. The CLI applies the 90/95 %
policy; the session never switches models or companies by itself.

**Owner messages mid-run.** An answer to an ask, a parked question or a gate → `autonomy.md` §1.4. "Para" or
"detén el build" → `pb stop --epoch <E>`, then the final report. Anything new (a feature, a bug) → a `draft` card
(step 1.4); it is not added to this run.

## 8. Step 6: the final report

1. Data: `finish` (`report_path`, `summary`) or `pb summary` for a run that stopped itself.
2. Notify (Claude Code: `PushNotification`, one Spanish line: "Build terminado: <N> hechas, <M> aparcadas.").
3. Reply to the owner in Spanish, this order, every heading present even when empty ("ninguna"):
   - **Necesito de ti**: `open_questions[]` (parked questions, gates; "¿aterrizo?" lists degraded reviews not yet
     re-reviewed) and the defaults applied because nobody answered ("apliqué el default X porque no respondiste").
   - **Decidí sin ti (N)**: one line per autonomous decision (question, choice, who advised, how to revert).
   - **Aparcado**: units parked and why; work built on an assumption and its branch.
   - **Hecho**: FRDs/WOs landed on `main`, or waiting on `lane/<run_id>/integration` for the owner's order; the report path.
   - **Revisiones**: cross, degraded and deferred counts, e.g. "3 cruzadas (Codex Sol high), 1 degradada (Opus
     xhigh, mismo modelo)".
   - **Cupo**: each company's last reading and reset.
4. Verify engine close-out with `git -C <projectDir> worktree list --porcelain`: eligible finished unit, assume, G2
   and integration worktrees are removed, branches retained. A `waiting_gate` run keeps its integration worktree
   without build caches. Report any retained dirty, locked, live or process-cwd path; never force removal.
   Follow CONV-21 and `../../worktrees/SKILL.md` §Implementation teardown for session-owned resources: restore
   the actual session cwd, run `session-cleanup.mjs finish`, await its exit and remove only named own scratch
   paths. Never delete `.pandacorp/` or another session's resources. Include cleanup and performance-journal
   warnings from the CLI in the final report; do not promise cleanup that has not completed.
5. Capture lessons of the run in `.pandacorp/run/lessons.md` (one line each, project rule 8).

## 9. Exit codes and observer mode

| Exit | Session reaction |
|---|---|
| 0 | Continue |
| 2 USAGE | Your call was malformed: fix it from `build-engine-cli.md`; never guess flags |
| 3 FENCE | **Observer mode**: the lease moved to another epoch (drive took over, or another session resumed). Stop dispatching; never call a fenced command again with this epoch; never retry with a guessed epoch. Agents still running: let them end, do not file their results (the holder re-runs that work). Use only `pb status` and tell the owner in Spanish who holds the run |
| 4 CONTENDED | A live foreign run holds the lease: row 1 behavior |
| 5 INVALID_STATE | From `start --run` "re-run preflight": step 3.2 again. From `finish`: units still live, back to the loop. Otherwise `pb rebuild-state --epoch <E>`, retry the same call once; fails again → treat as exit 8 |
| 6 INVALID_INPUT_OR_RED | A card: fix it. A `report`: the rejection is recorded, continue. An `answer`: `autonomy.md` §1.4 |
| 7 WAITING_GATE | From `report` (`waiting_gate`), `land` or `finish` (`next` never exits 7): notify (`autonomy.md` §4); after `finish`, write the final report; otherwise continue the loop |
| 8 ENGINE_FAILURE | The CLI stopped at a safe point, wrote `handback/engine.md` and its backlog note, released the lease. For nested projects the note is a draft under `build/handback/`, listed in `need_from_owner`; never create a factory-main backlog item yourself. Notify, final report with that path, stop |
| 9 FAILCLOSED | A signal was unreadable; the conservative path applied. Continue; mention it in the report |
| 10 NOT_A_PROJECT | Step 0.1 message, stop |

## 10. What the session never does

Pick a model, effort or reviewer; queue another attempt (the CLI queues attempt 3 itself); build outside
`scope`; drain other cards; edit state files, frontmatter or `status.yaml`; commit, push or reset anything
(the CLI commits on `lane/<run_id>/integration`); land except on `action: "land"` or the owner's order; set
`PANDACORP_OWNER_RELEASE_OK` without that order; kill a process (BL-0223); spawn or stop `drive` (`drive.md`); ask
the owner anything after the first-minute message except through `autonomy.md` §3 and §4.
