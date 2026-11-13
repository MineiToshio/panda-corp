# `pandacorp-build` CLI: interface reference

> Audience: the engineers (and agents) who implement, test or call the v2 build engine. This file owns the **interfaces**: commands, arguments, exit codes, JSON output shapes, on-disk files, environment test hooks and the worker brief. It owns no policy. Thresholds, routing and review matrices, admission constants, the autonomy ladder, human-gate rules and the failure policy belong to **`factory/standards/build-engine.md`** (rules BUILD-7 to BUILD-15). Session behavior (what the lead agent does between calls) belongs to `plugin/skills/implement/references/{engine-v2.md,autonomy.md,drive.md}`. JSON Schemas live in `plugin/runtime/build/schemas/`. Where this file says "policy", follow the link, do not copy. Where a design is referred to as `D<n>`, the text is the binding design list of the engine build plan (rev 2); this file restates only its interface consequences.

## 1. What the CLI is

One Node program is the build engine's only executor, for both runtimes (Claude Code and Codex). It holds all state, all arithmetic and all judgment that must not depend on a model's mood: detection, preflight, planning, risk zones, routing, quota, adaptive memory/disk admission, fencing, commits, integration, landing, doubts, parking, handback and the drive relay. The lead session (Claude or Codex) only runs it in a loop, dispatches the units it returns, and reports back. The session never edits state, status, work-order frontmatter, the journal or the lease by hand.

- Runtime: Node >= 22, ESM `.mjs`, `node:` builtins only, no npm dependencies.
- Entry point: `plugin/scripts/pandacorp-build.mjs` (dispatcher). Modules live in `plugin/runtime/build/` and self-locate with `import.meta.url`.
- Claude Code call: `node "${CLAUDE_PLUGIN_ROOT}/scripts/pandacorp-build.mjs" <cmd> ...`
- Codex call: `node "<factory>/plugin/scripts/pandacorp-build.mjs" <cmd> ...`, with `<factory>` read from `.pandacorp/guide.md`.
- Policy for everything below: `factory/standards/build-engine.md`.

### 1.1 Module map

| Module (`plugin/runtime/build/`) | Responsibility |
|---|---|
| `paths.mjs` | every on-disk path (project run dir, integration worktree, jobs, host dir, schemas) |
| `fsx.mjs` | atomic JSON/text write (mode 0600), hash-chained JSONL append, schema validator (the keyword set of 2.6), tracked-path check (`git ls-files --error-unmatch`) |
| `journal.mjs` | append, read, verify the journal chain; per-run archive |
| `state.mjs` | `state.json` read/write under the two-phase rule (2.3), `rebuildState()` from the journal and the integration worktree's WO frontmatter |
| `detect.mjs` | signals, 7-row detection, provisional size, label precedence |
| `card.mjs` | card parse/check, writes, `archiveCard`, v2 and v1 `building` card handling; owns every card read and write |
| `risk.mjs` | risk zone `none/floor/r1`, rules, `irreversible`, `audit`; imports `product-floor.mjs`; runs `classify-change.mjs` by `execFile` |
| `routing.mjs` | builder cell, review cell, doubt consult cell; never emits Fable or `max` |
| `quota.mjs` | Codex rollout tail reader, Claude reading record, unified limit detector, effective quota, policy |
| `admission.mjs` | RAM/disk signals, persisted adaptive ladder, heavy-job estimates, B/H decisions, host H slots and unit tokens |
| `perf.mjs` | bounded local samples, host performance records and learned start recommendation |
| `gatefail.mjs` | pure G2/G3 diagnostic parser, canonical-WO attribution and fenced evidence persistence |
| `planner.mjs` | pure self-contained planner (ready set, barrier, chains, deadlock), `lint-plan`; has no retired-engine dependency |
| `next.mjs` | scheduler behind `next` (harvest, integrate, G2, deferred reviews, quota policy, admission, dispatch, terminal actions) |
| `units.mjs` | unit worktrees and branches `lane/<run_id>/<unit>[-a<n>]`, brief generation. Unit ids `integration` and `assume-*` are reserved (they name the integration and assumption branches; `paths.mjs` rejects them) |
| `report.mjs` | ingest worker reports, G1 re-run, own pathspec-limited commit, tests units, diff gate (S8/deploy), idempotent re-ingest (`resumeCommitted`); failures go through `failure.mjs` `applyUnitFailure` |
| `integrate.mjs` | chain to integration branch `lane/<run_id>/integration`, WO `IN_REVIEW`/`PLANNED` transitions and `track.jsonl` lines on the integration branch |
| `jobs.mjs` | detached jobs `g2\|land\|worker`, poll, adoption by the epoch holder, host H slot wrapper |
| `review.mjs` | `review-record`, probe commit and hashes, deferred re-review queueing |
| `deferred.mjs` | `.pandacorp/run/deferred-reviews.json` lifecycle (written only inside a run) |
| `land.mjs` | integration to `main` only: rebase, landing metadata commit, `merge-queue.sh` land job, exit map, card archive |
| `preflight.mjs` | first-minute checks, question set, `preflight.json`, pre-push CHECK only (`start --run` installs it) |
| `summary.mjs` | announce data, final report data, `open_questions` |
| `doubts.mjs` | doubt ladder, decision-log entry (on the integration branch), `decisions.md` entry |
| `park.mjs` | parked propagation through `dependsOn`, root-block rule |
| `answers.mjs` | `answer` kinds `ask\|parked\|gate`, built-on-assumption answers, `applyStartAnswers` |
| `workers.mjs` | Codex workers through `codex-worker.mjs run --direct`; harvest through `read` or the `exit` file |
| `drive.mjs` | standby, triggers, quota re-check, transfer, loop, `paused-quota` |
| `notify.mjs` | `osascript` notification; no-op off macOS or when `PANDACORP_NOTIFY=off` |
| `telemetry.mjs` | events, `track.jsonl` lines on the integration branch; no status projection |
| `failure.mjs` | failure policy (`decideFailure`, `applyUnitFailure`, fenced `failUnit`), hand-back, engine failure (`handback/engine.md`, BL file, lease release) |
| `lifecycle.mjs` | effects of `start --run`, `start --resume`, `stop`, `finish`; metadata archive/suspend/restore and protected worktree reclamation |
| `schemas/*.schema.json` | `state`, `journal-event`, `report`, `review-report`, `doubt`, `doubt-answer`, `handoff`, `deferred-reviews`, `quota`, `card-frontmatter`, `summary`, `gate-failure`, `perf-record` |

The modules `next`, `failure`, `lifecycle`, `planner`, `review`, `doubts`, `answers`, `drive`, `admission`, `integrate`, `land`, `units`, `preflight` and `card` are thin entries; their code lives in the same-named sibling folder (`build/<module>/`). Every module, top-level or in those folders, stays under 500 lines.

Shared infrastructure the CLI reuses and never forks:
- `plugin/runtime/build-state.mjs`: lease, epoch, fenced transitions. v2 imports it as a module (it never shells out to `plugin/scripts/pandacorp-build-state.mjs`). Exports added for v2: `transfer`, `forceRelease`, `transitionWorkOrderAt`, `withUnleasedProject`, and a `projectStatus:false` option on `acquire`, `quiesce` and `renew`. `withUnleasedProject` reserves the lease mutex across maintenance and refuses any existing lease directory (3.24).
- `plugin/scripts/product-floor.mjs`: imported (`productFloor`, `securityDeltaTriggers`).
- `plugin/scripts/classify-change.mjs`: never imported (it has no exports and runs at load); run through `execFile(process.execPath, [...])`.
- `plugin/scripts/codex-worker.mjs`: `run --direct --prompt-file <abs> --codex-model <slug> --output-schema <abs> --dir <unit worktree> --access sandbox --writable-dir <unit dir>` (no `--sum`), `read`; the Codex launcher.
- `plugin/runtime/event-transport.mjs`, `plugin/runtime/model-tiers.json` (version 2), `plugin/templates/shared/.pandacorp/merge-queue.sh`.
- `plugin/scripts/worktree-sweep.mjs`: shared `engineWorktreeOwnershipReason`,
  `runningWorktreePaths` and `worktreeRemovalReason`; retry, lifecycle cleanup and sweep use
  the same ownership, worker-termination and data-safety predicates (5.1).
- Instruction source (DEC-13): `AGENTS.md`; `CLAUDE.md` is the one-line `@AGENTS.md` shim.
  `migrate-instructions.mjs --project <dir> [--dry-run]` performs loss-checked migration, refuses
  `CLAUDE.local.md`, and emits one JSON line. `upgrade` invokes it. Verification:
  `plugin/scripts/test-migrate-instructions.mjs`, `test-block-dangerous.sh`,
  `test-codex-enforcement.mjs` (shim scope, literal writes and fail-closed tool errors);
  `test-block-dangerous.sh` also isolates fixtures from allowed temporary roots.
- Plugin-version coordination follows BUILD-7: after update, restart or close all sessions on that
  project before continuing. This is an operating rule (review-only), not a code guard.

## 2. Conventions

### 2.1 Invocation

```
node <plugin>/scripts/pandacorp-build.mjs <cmd> [sub] [--project <dir>] [flags]
```

- `--project <dir>`: project root. Default: the nearest ancestor of the current directory that contains `.pandacorp/status.yaml`. None found: exit 10.
- Flags are `--name value` or `--name=value`. Booleans are bare (`--dry-run`). Unknown flags: exit 2. A value that starts with `--` is passed as `--name=value` (e.g. `--args=--resume`); `--args` always consumes the next token. There is no `--engine` flag. `--help` exits 0 and prints one JSON line `{ok, cmd:"help", usage, commands[]}` listing only the documented commands. An unknown command, a removed command, an unknown flag, a missing value or a stray positional exits 2 (`USAGE`) with a one-line Spanish `message`. `--label`, `--coordinator` and `--session-runtime` accept `anthropic` as an alias of `claude` (a Codex session must never write that word). `--run <id>` is also a value flag of `start --resume`; `plan` and `lint-plan` accept `--scope-json`.

### 2.2 Output

- Exactly **one JSON line** on stdout: `{"ok":bool,"cmd":"<cmd>",...}`.
- Failures are also one line: `{"ok":false,"cmd":"<cmd>","code":"<ERROR_CODE>","message":"<english text>"}`, with extra keys where a command documents them (a hint such as `"hint":"rebuild-state"`).
- Diagnostics go to stderr, never stdout.
- `drive` is long-lived: it writes nothing to stdout and logs to `build/drive/drive.log`.
- A command that reports an owner-relevant condition (asks exist, gate waiting) still prints its normal JSON; the exit code signals the condition (table 2.5).

### 2.3 Fencing, credentials and the two-phase rule

- **Lease token.** One file `.pandacorp/run/build/lease-token.json` (`{epoch, token}`, mode 0600), written by `acquire` and `transfer`, never printed, never put in an event or a commit. The session never handles it.
- **Fence.** Every fenced command takes `--epoch <n>`, the caller's view of the lease epoch. A mismatch with the token file or with the lease epoch, a foreign token, or a quiesced lease: **exit 3**. The caller must stop acting and become an observer (see `engine-v2.md`).
- **Unit token = admission token.** `next` issues one token per dispatched unit, returns it once, and stores its `sha256` in `state.units[].token_hash` and as the key in `admission.json`. `report`, `review-record` and `doubt answer` (for a `via:"agent"` consult) verify it and then release it. A token that does not match is rejected as exit 6. The unit token is the only token the session ever passes on a command line.
- **Which commands are fenced** is stated per command in section 3 (column "Fenced"). Read-only commands, `start` (the lease is being acquired or transferred), `quota record` (unless `--epoch` is given), `drive` (it authenticates with the token file) are not fenced by `--epoch`.
- **Two-phase mutation.** Every mutating command works in two phases:
  1. *Phase 1, under the lease mutex (seconds):* verify the fence, **renew the lease**, record the intent in state.
  2. *Long work* (verification runs, worker waits, merges) runs outside the mutex, only inside unit or integration worktrees or inside a detached job.
  3. *Phase 2, under the mutex:* re-verify the same epoch, then write state, journal and branch commits. A phase-2 fence failure discards the results (worktree changes are left for the new epoch holder to re-run) and exits 3.
- **Detached jobs.** Work that outlives a command (the landing through `merge-queue.sh`, G2, Codex workers) runs as a detached job recorded in `state.jobs[]` (section 6). The current epoch holder harvests it inside `next`.
- **Transfer never waits.** `transfer` (drive takeover, `start --resume`) never waits for the previous holder: the loser gets exit 3 at its next phase 2 and becomes an observer; the winner adopts running jobs. `drive` never spawns a landing while a land job is alive. `transfer` semantics: the current raw token read from `lease-token.json` proves local access; under the mutex it checks `sha256(token)` against the lease and the run id, mints a new token, sets epoch+1, writes the lease (`renewed_at` now, `ttl_seconds` 1800, runtime, coordinator, no `quiesced_at`), `lease-epoch` and `lease-token.json` atomically, never projects status, never stops workers, and returns `{epoch, token}`; fresh or stale lease; no lease → exit 3.
- **Liveness without a heartbeat process.** The lease `ttl_seconds` is 1800. Every fenced command of the coordinator renews it in phase 1; while any unit, job or worker runs, the session loops `next --wait 300` (never ends its turn waiting) and `drive` renews in its own loop. A lease that has not been renewed for 1800 s means the coordinator is silent (drive trigger (c)). The v2 engine never projects `status.yaml` (`projectStatus:false`). Values: the Constants table of `factory/standards/build-engine.md`.

### 2.4 Coordinator mapping

| `--coordinator` | `state.coordinator` | `lease.coordinator` | `lease.runtime` | Admission shape | Doubt origin |
|---|---|---|---|---|---|
| `claude` | `claude-session` | `session` | `claude` | `R-A` (label `claude`) or `R-C` (label `codex`) | the author's company |
| `codex` | `codex-session` | `session` | `codex` | `R-B` (adaptive BUILD-9) | `codex_app` |
| (drive) | `drive` | `drive` | `codex` | `drive` | `drive` |

### 2.5 Exit codes and the error map

| Exit | Name | Meaning |
|---|---|---|
| 0 | OK | done, including "nothing to do" and "asks exist" |
| 2 | USAGE | bad arguments |
| 3 | FENCE | stale epoch, foreign token or quiesced lease; the caller becomes an observer |
| 4 | CONTENDED | foreign/held lease, active-drive resume timeout, or busy live lock; `gc` refuses any held lease |
| 5 | INVALID_STATE | illegal transition, schema mismatch, corrupt ledger or journal chain (hint: `rebuild-state`) |
| 6 | INVALID_INPUT_OR_RED | card or report invalid, unit token wrong, evidence missing, a gate is red |
| 7 | WAITING_GATE | a human gate was reached (production, money, delete, external) |
| 8 | ENGINE_FAILURE | engine fault; already stopped at a safe point, handback and BL file or nested local draft written, lease released |
| 9 | FAILCLOSED | a signal or classifier was unreadable; the conservative path was applied (reported, not fatal for read commands) |
| 10 | NOT_A_PROJECT | no `.pandacorp/status.yaml` |

Modules throw `Object.assign(new Error(msg), {code})`. Only the dispatcher maps codes to exits:

| Error code | Exit |
|---|---|
| `USAGE` | 2 |
| `FENCE`, `QUIESCED` | 3 |
| `CONTENDED` | 4 |
| `INVALID_STATE`, `LEDGER_CORRUPT`, `JOURNAL_CHAIN` | 5 |
| `INVALID_INPUT`, `EVIDENCE`, `INVALID_PATH`, `GATE_RED` | 6 |
| `WAITING_GATE` | 7 |
| `ROLLBACK_FAILED` and any uncaught error | 8 |
| `FAILCLOSED` | 9 |
| `NOT_A_PROJECT` | 10 |

Exit 9 on a read command still prints a full JSON result: it marks that the result was computed with a conservative fallback (for example `risk` returns `zone:"r1"`).

### 2.6 Schema validator keywords

`fsx.mjs` supports exactly: `type` (string or array), `properties`, `required`, `additionalProperties` (boolean or schema), `items`, `enum` (including `null`), `const`, `oneOf`, `anyOf`, `allOf`, `if`/`then`, `minimum`, `maximum`, `minLength`, `pattern`. It ignores `$schema`, `$id`, `title`, `description`, `default`, `format`. Any other keyword throws. Schemas passed to `codex exec --output-schema` (report, review-report, doubt answer) express nullable objects with `anyOf`, never `oneOf`.

### 2.7 Environment test hooks

All optional. Tests MUST set them; nothing in a test may touch the real `~/.claude`, `~/.codex` or the real host directory.

| Variable | Effect |
|---|---|
| `PANDACORP_HOST_DIR` | host directory; default `~/.pandacorp/host` (heavy-tool slots and performance journal) |
| `PANDACORP_EVENTS_FILE` | events ndjson path; default `~/.claude/dashboard-events.ndjson` |
| `PANDACORP_CODEX_EVENTS_FILE` | events ndjson path for Codex-coordinated runs; the emitter's runtime is the coordinator's company (`event-transport.mjs createRuntimeEventEmitter`) |
| `CODEX_HOME` | Codex home; default `~/.codex` (rollout tail reader, login) |
| `PANDACORP_CODEX_BIN` | Codex binary; default `codex` on `PATH` |
| `PANDACORP_NOW` | ISO-8601 instant that replaces the wall clock everywhere, including the lease timestamps written by `build-state.mjs` (`acquired_at`, `renewed_at`, `quiesced_at`) and the freshness/reclaim checks |
| `PANDACORP_DISK_FREE_GIB` | non-negative project-volume free GiB override for engine disk admission (`test-build-v2-admission.mjs`, `test-build-v2-disk.mjs`) |
| `PANDACORP_DISK_FREE_MB` | shell bootstrap free MiB override; `PANDACORP_MIN_FREE_MB` and `PANDACORP_WT_NEED_MB` override its floor/reservation (`test-worktree-bootstrap.sh`) |
| `PANDACORP_SIGNALS_FILE` | fixture RAM signals: a JSON file `{"sysctl_pressure":"<raw>","vm_stat":"<raw>","swapusage":"<raw>"}` holding the RAW outputs of `sysctl -n kern.memorystatus_vm_pressure_level`, `vm_stat` and `sysctl vm.swapusage`; it goes through the same parsers as the real commands |
| `PANDACORP_FAKE_WORKER` | an executable used instead of `codex-worker.mjs`: same `run`/`read` argv, same `codex-workers/<id>/` layout (`state.json{pid}`, `exit`, `last.md`), same sealed line; results from `PANDACORP_FAKE_WORKER_PLAN` |
| `PANDACORP_FAKE_WORKER_PLAN` | JSON file: unit id → the report object the fake worker returns, or `{"limit":"usage_limit"\|"rate_limit"}`, or `{"hang":true}` |
| `PANDACORP_ORCHESTRATE_DIR` | orchestrate-flag directory; default `~/.claude/state/orchestrator-mode` |
| `PANDACORP_NOTIFY` | `off` disables `osascript` notifications |
| `PANDACORP_DRIVE_POLL_S` | positive number of seconds replacing the `drive_poll_s` threshold for the standby and loop polls (default 30 s; test hook) |
| `PANDACORP_LOCK_REFRESH_SECS` | `merge-queue.sh` only: seconds between refreshes of its lock while `verify.sh` runs (default 60; test hook) |
| `PANDACORP_CODEX_START_HANG_S`, `PANDACORP_CODEX_STALL_S`, `PANDACORP_CODEX_CAP_S` | `codex-worker.mjs` watchdog thresholds in seconds when the matching flag is absent (11.5; test hooks) |

**Test environment notes.** Path comparisons (worktree registrations, G2 snapshot manifests) use `realOrResolved`, which realpaths the deepest existing ancestor and appends the missing tail, so they are symlink-safe (macOS `/var` is `/private/var`) even after the directory is removed; the suites pass with the default `TMPDIR`. `node plugin/scripts/test-build-v2-lock-stress.mjs` (about 12 s) hammers both locks with parallel holders and dead-lock planters; knobs `PANDACORP_LOCK_STRESS_PLUGIN` (runtime copy to test), `PANDACORP_LOCK_STRESS_BUDGET_MS`, `_WORKERS`, `_ITERS`, `_PLANTERS`. G2 runs in its own bootstrapped snapshot worktree (exit 75 = environment failure; 76 = bootstrap disk refusal, 4.1), so a verify run is never read from the integration worktree.

## 3. Subcommands

Legend. **Fenced**: requires `--epoch`. All commands print the common envelope `{"ok","cmd"}` plus the listed keys.

### 3.0 Summary

| Command | Key args | Fenced | Output (beyond `ok`/`cmd`) |
|---|---|---|---|
| `start --detect` | `--args "<raw>"`, `--session-card <path>`, `--session-id <id>`, `--session-runtime claude\|codex` | no | `signals`, `row`, `scope`, `size_provisional`, `label`, `label_source` |
| `start --preflight` | `--row`, `--scope-json <file>`, `--label`, `--session-model`, `--probe-codex` | no | `elapsed_ms`, `checks[]`, `need_from_owner[]`, `announce`, `drive_armable`, `drive_block_reason?` |
| `start --run` | `--scope-json <file>`, `--label`, `--coordinator claude\|codex`, `[--k N] [--mode touch\|feature\|giant] [--session-model m] [--answers <json>]` | acquires the lease | `run_id`, `epoch`, `integration`, `drive`, `prepush` |
| `start --resume` | `--coordinator claude\|codex [--session-model m] [--run <id>] [--owner-confirmed] [--unblock <unit> --reason <text>]` | transfers or acquires | `run_id`, `epoch`, `reattached[]`, `requeued[]`, `drive`, `unblocked?` |
| `card check <path>` | | no | `errors[]`, `warnings[]`, `fields{}` |
| `plan [--explain]`, `lint-plan [--strict]` | | no | `units[]`, `rounds[][]`, `issues[]` |
| `risk` | `--files a,b` or `--range base..head` | no | risk object (3.7) |
| `next` | `--epoch`, `[--wait <=300]` | yes | scheduler result (section 4); exit 0 for every action |
| `report` | `--epoch --unit --token --file <report.json>` | yes (two-phase) | `outcome`, `commit?`, `g1`, `test_hashes?`, `next_attempt?` |
| `review-record` | `--epoch --unit --token --file <review.json>` | yes | `verdict`, `deferred_review_id?`, `probes_committed[]` |
| `land` | `--epoch` | yes (spawns a `land` job) | `result`, `reason`, `mq_exit?`, `sha?` |
| `doubt open\|answer` | `open --epoch --unit --file` / `answer --epoch --id --file [--token]` | yes | `doubt_id`, `step`, `consult?`, `decision?` |
| `answer` | `--epoch --question <id> --value '<json>'` | yes | `question`, `kind`, `applied`, `units[]` |
| `handback` | `--epoch --unit --reason` | yes | `path` |
| `unblock` | `--epoch --unit --reason` | yes | `unit`, `attempt`, `units[]`, `wos_planned[]`, `worktree_changes`, `previous_report`, `commit`, `notice_es` |
| `quota record` | `--provider claude [--five-hour P --weekly P] [--five-hour-resets-at] [--weekly-resets-at] [--status ok\|unavailable] [--epoch]` | only with `--epoch` | stored reading |
| `quota read` | `[--probe]` | no | `claude`, `codex`, `policy` |
| `admit` | `[--class B\|H]` | no (read-only) | admission decision and signals |
| `handoff` | `--epoch --reason quota95\|limit\|manual\|test` | yes | `handoff_path` |
| `drive` | `--standby --run R` or `--run R [--handoff-after N]` | internal | log only |
| `finish` | `--epoch` | yes | `report_path`, `summary` |
| `stop` | `[--epoch]` or `--dead --owner-confirmed` | with `--epoch` | `released` |
| `status` / `summary` | | no | run snapshot / summary object |
| `rebuild-state` | `--epoch` | yes | `units`, `diff_vs_cache` |
| `gc` | `--project <dir>` | no; refuses a held lease | `removed[]`, `kept[]`, sweep details (3.24) |

Removed and never to be added back: `heartbeat`, `escalate`, `calibrate`, `yield-request`, `--budget`, `--takeover` (resume transfers), `--engine`, `land --chain`. Legacy mode words are described in 3.23.

### 3.1 `start --detect`

Read-only. Computes the signals, applies the 7-row detection table (first match wins) and returns the scope, a provisional size and the builder label. The detection policy (what each row means for the owner) is BUILD-7 in `build-engine.md`; this file fixes only the row numbers and the output.

| Row | Condition | Scope |
|---|---|---|
| 1 | foreign live lease (`signals.lease == "live"`) and no `--resume` | none |
| 2 | `--resume`, or lease `stale` or absent with a non-terminal v2 state, or a v2 `building` card of this project | the run's scope |
| 3 | target is a card (`ready` or `draft`) | that card |
| 4 | target is FRDs | their pending WOs (cross-FRD dependencies not `VERIFIED` produce a hand-back, never pulled in) |
| 5 | session card | the conversed scope only |
| 6 | pending WOs > 0, excluding WOs whose `source_change` names an open card | the pending plan |
| 7 | nothing | none (list ready/draft/half cards, stop) |

Arguments:

| Arg | Meaning |
|---|---|
| `--args "<raw>"` | the owner's raw arguments after `/pandacorp:implement`: a card as `change:<id>`, `change=<id>` or the bare slug; FRD ids; `--label`; legacy mode words (ignored) |
| `--session-card <path>` | the card the session just wrote (row 5); validated as `card check` does |
| `--session-id <id>` | the calling session's id (for `card_session` and the orchestrate flag) |
| `--session-runtime claude\|codex` | the calling runtime, last step of label precedence |

Output:

```json
{"ok":true,"cmd":"start","mode":"detect",
 "signals":{"lease":"free|live|stale","lease_coordinator":"session|drive|null","run_status":"active|paused|waiting_owner|waiting_gate|finished|stopped|null",
            "args":{},"card_session":null,"wos_pending":0,"first_impl":false,"phase":"implementation","launched":false,
            "cards":[],"cards_half":[],"suspended":[],"suspendable_run":null},
 "row":6,
 "scope":{"card":null,"frds":["frd-05"],"wos":["wo-05-001","wo-05-002"]},
 "size_provisional":"touch|feature|giant",
 "label":"claude|codex","label_source":"explicit|orchestrate|default",
 "warnings":[]}
```

- `lease`: `free` (no lease), `live` (held and renewed within its ttl), `stale` (held but expired). `lease_coordinator` is the lease's `coordinator` (`null` when `free`); a returning session uses it to see that `drive` coordinates (`drive.md`). `run_status` is `state.status` of the latest run (`null` when none).
- `cards_half` lists `building` cards that have no live run. Detection performs no reconcile and no card write.
- `suspended` lists run ids under `.pandacorp/run/build-suspended/`. When `--session-card` is given and `build/` holds a non-terminal run, detection returns row 5 (the card's scope) with `suspendable_run: <run_id>`, and the preflight asks `conflict.paused_plus_card` (default: the conversed scope first). Row 2 also matches when `build/` holds no non-terminal run and `suspended` is non-empty. The orchestrate flag is read from `$PANDACORP_ORCHESTRATE_DIR/<session id>.on`.
- `scope` is what the session passes back as `--scope-json` (D33).
- `size_provisional` comes from the card or plan (rule in BUILD-9); it can rise during planning, never fall. A version-scale request (new PRD) yields row 7 plus a `warnings` entry; it is not built.
- `label_source`: `explicit` (owner argument), `orchestrate` (the orchestrate flag, read-only, never modified), `default` (the calling session's runtime).
- `--detect` never writes a card. Saving a session card as `ready` (row 1 follow-up) is a session step (`card check` then a file write by the session).
- Exit: 0; 9 if a signal was unreadable (conservative values applied); 10 not a project.

### 3.2 `start --preflight`

Runs the first-minute checks for a detected row and writes `.pandacorp/run/build/preflight.json` (mode 0600). May consume a quota probe or fresh readings; writes no other project state. It only CHECKS: it never installs the pre-push hook (`start --run` does, 3.3); the hook check runs `install-pre-push.mjs --check` and the result feeds `drive_armable`. Target runtime <= 60 s on a Mission-Control-shaped fixture (the LLM card turn is outside this budget).

Arguments: `--row <1..7>`, `--scope-json <file>` (the `scope` object returned by `--detect`), `--label claude|codex`, `--session-model <m>`, `--probe-codex`. The session **always passes** `--probe-codex`; the CLI runs the ~20k-token Codex probe only when `needs_probe` is true (see 8.1).

Output:

```json
{"ok":true,"cmd":"start","mode":"preflight","elapsed_ms":8123,
 "checks":[{"group":"access","id":"access.codex_login","status":"pass|ask|warn|fail",
            "detail_es":"...",
            "question":{"id":"q-access.codex_login","text_es":"...","default_es":"...","default_action":"...",
                        "affects":{"all":true},"reversible":true}}],
 "need_from_owner":["q-..."],
 "announce":{"scope_lines_es":[],"size":"feature","builders":"...","reviewers":"...",
             "risk_zone_provisional":"none|floor|r1","gates_foreseen_es":[],
             "launched_project_line_es":null,"drive_line_es":null,
             "quota":{"claude":{},"codex":{}},"deferred_pending":0},
 "prepush":{"status":"not_needed|current|missing|stale|refused|error","code":null,"verified":true,"will_install":false},
 "drive_armable":true,"drive_block_reason":null}
```

- A `question` is present only on `status:"ask"` checks. Question model: `{id, text_es, default_es, default_action, affects, reversible}`. `affects` is `{"all":true}`, `{"frds":[...]}` or `{"wos":[...]}`: units in `affects` of an open question carry `pending_answer`. Ids: `q-<check id>` for asks, the doubt id for parks, `g-<unit>` for gates.
- `need_from_owner` lists the question ids that the session must put in "Necesito de ti". Every ask carries a default so a silent owner never blocks the build.
- `announce` is data only. The session renders it ("Necesito de ti" numbered with "si no respondes: ...", then the start announcement). Rendering rules: `implement/references/engine-v2.md`. `launched_project_line_es` is set in a launched project (nothing is written on `main`); `drive_line_es` is set when Codex is at or above the quota stop threshold at start.
- Check ids (stable strings):

| Group | Ids |
|---|---|
| scope | `scope.doubts`, `scope.summary_citation`, `scope.giant`, `scope.version` |
| conflict | `conflict.foreign_lease`, `conflict.paused_plus_card`, `conflict.half_cards` (asks about any `building` card without a live run, whether or not it shares an FRD with the scope) |
| phase | `phase.launched`, `phase.prepush_missing` |
| access | `access.codex_login` (`codex login status`), `access.quota_claude`, `access.quota_codex`, `access.test_db`, `access.env_pending` (`.env.local` and `.pandacorp/comms/entrega-entornos.md`), `access.disk`, `access.ram` |
| mac | `mac.power` (`pmset -g batt`), `mac.keep_awake`, `mac.drive_armed` |
| gates | `gates.foreseen` (classify-change reasons over the card text: deploy, money, delete, external, production migration) |
| deferred | `deferred.pending` |

- `drive_armable` is true when the hook is missing or stale but installable (`will_install:true`); `start --run` installs it before arming. `drive_armable` and `drive_block_reason`: see section 9 (arming conditions; Codex quota is not one of them). `phase.prepush_missing` is a pass when the project is not launched or the hook is installed and current, and an ask when `start --run` could not install it (an in-tree `core.hooksPath`, section 12); a hook that is merely missing or stale is installed by `start --run`.
- Exit: 0 (asks exist is still 0); 9 if a check could not be evaluated (that check reports `status:"fail"` or `"ask"` with the conservative default).

### 3.3 `start --run`

Acquires the lease, creates the run and its integration worktree, installs the pre-push hook when needed, arms `drive` and applies the owner's answers.

Arguments: `--scope-json <file>` (the `scope` object of `--detect`; the run builds exactly `scope.wos` plus the WOs created by the card's docs unit), `--label claude|codex`, `--coordinator claude|codex` (table 2.4), optional `--k N` (owner parallelism request, bounded by the admission ceiling), `--mode touch|feature|giant` (sets `state.size`; it can only raise the provisional size), `--session-model <m>`, `--answers <json>` (the owner's answers keyed by question id: an inline JSON object or a path to a JSON file; stored in `state.answers`). There is no `--budget`.

Effects, in order:
1. Reuse `build/preflight.json` when it is at most 15 minutes old and for the same row and scope; otherwise exit 5 with the message "re-run preflight".
2. A previous run in `build/`: `finished` → moved to `.pandacorp/run/build-archive/<run_id>/`; non-terminal and not `active` → moved to `.pandacorp/run/build-suspended/<run_id>/`; `active` → exit 5 ("resume or stop the run first"). `preflight.json` stays in `build/`; eligible worktrees are removed first, with branch refs kept. Any protected registered remainder
   refuses the move. Only metadata is moved (5.1; `test-build-v2-disk.mjs`).
3. Take the lease (`ttl_seconds` 1800), write `lease-token.json`, create `build/`, the integration branch `lane/<run_id>/integration` and its worktree `.pandacorp/run/build/integration`, write `state.json`, queue the planner's `now` units (later rounds are queued by `next`'s planner round; no duplicates, exit 5 on deadlock or an empty plan). Static zones come from `risk.staticZones(wos, root, deps)` (per-WO `computeRisk` over its `artifacts`; classifier failure = `r1`), also used by `plan`/`lint-plan`.
4. Card handling (`card.mjs`): a v2 card (`engine: v2`) of this run is resumed; a v2 card of another terminal run goes back to `status: ready` with a note; a v1 card (it has `integration_transaction`) goes through `build-state.mjs reconcileBuildingChange`. The run's card gets `status: building` and `run_id`.
5. Docs-before: a card with no WOs starts with one `docs` unit on `lane/<run_id>/integration` (3.9).
6. In a launched project: run `install-pre-push.mjs` (section 12; this is the only place the hook is installed, the preflight only checks) before the first run. The lease is acquired with `projectStatus:false` and `lease-token.json` is written.
7. Apply `--answers` (`applyStartAnswers`), journal `run_started` (carries the detect and preflight result), emit `BuildLaunch`, arm drive (section 9).
8. The CLI writes no tracked file in the main checkout and never projects `status.yaml`.

Output:

```json
{"ok":true,"cmd":"start","mode":"run","run_id":"br-2026-11-11-01","epoch":4,
 "integration":{"branch":"lane/br-2026-11-11-01/integration","worktree":"/abs/path/.pandacorp/run/build/integration"},
 "drive":{"armed":true,"pid":12345,"reason":null},
 "prepush":"installed|not_needed|refused"}
```

- `integration.worktree` is the product root inside the integration worktree (`<git worktree>/<prefix>` for a project nested in its repository); `paths.mjs` `integrationWorktree` is the git worktree root. `run_id` format: `br-YYYY-MM-DD-NN`. `drive.armed:false` carries `reason`; not arming is never an error. `prepush:"refused"` means a tracked `core.hooksPath` blocked the install (the run does not start in a launched project; the preflight asked the owner).
- Exit: 0; 4 (CONTENDED) when a live foreign lease exists; 6 when the card fails `card check`; 6 also when an `--answers` id is not a first-minute ask of this preflight or its value does not fit (nothing is left: no lease, no state); 5 when the preflight is stale, the plan has a deadlock or the scope is not buildable (hand-back text in `message`); 6 also when an `--answers` id is not a first-minute ask of this preflight or its value does not fit (nothing is left: no lease, no state).

### 3.4 `start --resume`

Re-enters a non-active run of this project: `state.status` in `paused|waiting_owner|waiting_gate|stopped`; an `active` run whose lease is fresh or stale is also accepted (the lease is transferred, e.g. after a killed drive).

Arguments: `--coordinator claude|codex` (required; table 2.4), optional `--session-model <m>`, `--run <id>` (resume a suspended run: moved back to `build/`; exit 5 when `build/` holds a non-terminal run), `--owner-confirmed`. A lease of the same `run_id` is transferred without confirmation when it is fresh, or stale with `coordinator: drive` or with `runtime` equal to the caller's; `--owner-confirmed` is required only for a stale lease with `coordinator: session` of the other runtime. There is no `--takeover`.

With `--unblock <unit> --reason <text>` (BL-0312) the resume also re-admits that env-infra blocked unit exactly as `unblock` (3.14b) does, and it is the only form that reopens a `finished` run (a plain resume of a finished run stays exit 5); the unblock is validated against the state and journal before the lease is taken (a refusal takes no lease) and applied after the integration worktree is (re)created; the output carries `unblocked`. `--reason` without `--unblock` is exit 2. Effects: `start --resume` installs the pre-push hook like `start --run`, and a failed install fails loud (`INVALID_STATE`, same as `start --run`) before any mutation, so a retry is clean (it never reports `prepush:failed`); creating the integration worktree also fails loud (a fresh `git worktree add`, new or re-checked-out retained branch, runs the project's `.pandacorp/worktree-bootstrap.sh` right away, see 4.1; a failed bootstrap there does not fail `start`, it is re-checked before landing). When a lease is present, `transfer` (same `run_id`, epoch+1, new token file, no quiesce, no Codex-worker kill, no status projection); when absent, `acquire`. The lease-mutation lock (`.pandacorp/run/lease-mutation.lock`) is reclaimed by build-state itself: at once when the judged owner is dead (pid gone or reused by a later-started process); a live
holder is never reclaimed, even after 60 s (`CONTENDED.holder` reports overdue pid/ageMs). Only an
ownerless legacy lock is reclaimed by age. See sections 5/7 and
`plugin/scripts/test-build-v2-lock-stress.mjs`. When the run's drive is still `active` (standby pid alive), the resume waits up to 60 s for it to yield; if it has not, `start --resume` exits 4 (CONTENDED) before any orphan stop, reset or heal, and is simply retried (the lease already names the session); the wait never resets a worktree under a live drive. Each `admitted|running` unit whose recorded pids are dead is classified: **re-attach** when its pid or job is alive; **adopt** when it has a recorded `via:"cli"` worker whose worker directory is sealed, exited or running (the unit and its token are kept, its job is reopened as `running` with a `job_started` journal line, the next `next` harvests it under the dispatch's own token, and an interrupted ingest is completed from the engine commit by `resumeCommitted`; adopted units are listed in `reattached` and in `run_resumed.data.adopted`); **orphan** when a live worker derived from the unit's token hash was launched by a dispatch that never reached phase 2 (it is stopped, then the unit is requeued); otherwise **requeue** at the SAME attempt (no attempt is charged: an attempt is consumed only by the worker's own rejected or failed report). A requeued unit's worktree is restored to its fork point, and its orphan worker is stopped, BEFORE the fenced step (the git resets never run under the 1 s lease mutex; phase 2 only recomputes the verdicts and attaches the precomputed `worktree_reset` to the same `unit_state` event; a crash in between leaves the units running with dead pids, so the next resume repeats the idempotent resets) (`reset --hard` to the merge-base with the integration or assumption branch when the branch is ahead, `reset --hard` plus `clean -fd` when dirty; ignored files kept), so a stale engine commit from the dispatch that lost the run is discarded; the `unit_state` event carries `reason:"resume"`, `worktree_reset {discarded_commits, dirty}` and `orphan_worker`. Before phase 2 the integration worktree is healed (`integrate.healIntegrationWorktree`): when the registered worktree is on `lane/<run_id>/integration` and tracked files differ from `HEAD` (an engine write killed between writing a work-order file and its commit), they are unstaged and restored; untracked and skip-worktree (bootstrap-owned) files are never touched, and a pending merge, cherry-pick or revert in the integration worktree is aborted first (`run_resumed.data.integration_aborted`); a worktree mid-rebase, on another branch, or with a live `land` job is left alone (a `land` job with no recorded pid counts as alive, so the heal is skipped). `prepareIntegration` refuses (`INTEGRATION_DIRTY`) while a merge, cherry-pick or revert is pending. What was discarded is journaled in `run_resumed.data.integration_discarded` (paths). Leftover G2 snapshot worktrees (`build/g2/*`, except the one a `running` G2 job still judges) are removed after phase 2, with their bootstrap manifests. A drive takeover applies the same restore to units it requeues from a Claude agent or session. Admission tokens of units outside `admitted|running` are released. Worker ids are per dispatch (`w-<run>-<unit>[-a<n>][-d<dispatch>]`, 11.5), so a requeued dispatch never re-adopts the sealed result of the dispatch that lost the run. Drive is re-armed. `state.json` is rebuilt (3.22) when missing or invalid. Deferred reviews are served first on the next `next`. An owner who returns while `drive` coordinates gets the lease back immediately: drive gets exit 3 at its next phase 2 and exits. A drive that finds it lost the lease (a fence, or any non-fence error after the lease token stopped naming its epoch) yields cleanly (exit 0, standby `stopped`, never an engine failure), and before marking its standby `stopped` it stops every Codex worker it launched in the fenced round that state.json does not record as running.

Output: `{"ok":true,"cmd":"start","mode":"resume","run_id":"...","epoch":5,"reattached":["u-build-wo-05-001"],"requeued":[],"drive":{"armed":true,"pid":1,"reason":null}}`.

Exit: 0; 4 when the lease is held by a live foreign run; 6 when `--owner-confirmed` is required and missing; 4 when the lease belongs to another `run_id`; 5 when there is nothing to resume.

### 3.5 `card check <path>`

Validates a change card (frontmatter and body). Read-only. Schema: `schemas/card-frontmatter.schema.json`.

- Frontmatter must satisfy Mission Control's enums: `type` in `bug|feature|change`; `status` in `ready|draft|building|closing|done|discarded` (`obsolete` is read as `discarded` and never written). Fields the v2 session writes: `type, class, status, date, frd, origin: conversation, affected_frds, engine: v2` plus the body. The CLI writes `run_id`, `docs_sha` and `shipped_sha`. `integration_paths` and `integration_transaction` are v1-only and are never written by v2. Extra fields are tolerated and passed through in `fields`.
- Body must carry a title (H1), `Dentro` and `Fuera` lists, acceptance criteria with citations to the documents, and the fields the card template requires (`plugin/templates/docs/change-request-template.md`).
- Card references are accepted as `change:<id>`, `change=<id>` or the bare slug.
- Output: `{"ok":true,"cmd":"card","sub":"check","errors":[],"warnings":[],"fields":{}}`.
- Exit: 0 with no errors; 6 when `errors` is non-empty (the JSON is still printed with `"ok":false` and the full lists).

### 3.6 `plan` and `lint-plan`

Read-only planner views over the run scope (the live run's scope, or `--scope-json <file>` without a run).

- Module API (`planner.mjs`, pure): `plan(input, deps)` returns `{units, now, ready, round, rounds, cells, why, meta, held, held_units, integration_paused_by, capacity, floor_waived, progress, deadlock, issues}` where `deadlock` is `null` or `{wos, units, waits, cycles}`; also `lintPlan`, `planView` and `readPlanWorkOrders`. Input keys: `wos`, `scope`, `units`, `label`, `size`, `ceiling`, `reserved`, `capacity`, `floor_frds`, `verified_frds`, `frd_acs`, `card_type`, `questions`. `deps.cellOf(unit, ctx)` receives the unit with its `wos` ids so the chain can be cut per WO.
- `plan [--explain]`: ready = dependencies integrated, not parked and not pending an irreversible answer; greedy by barrier first, then longest downstream path; chains of at most 3 WOs of one FRD on a linear stretch, cut when the routing cell changes; `artifacts` overlap by the literal-prefix rule; barrier paths are constants. `--explain` adds per-unit reasoning (`why`) and the routing cell. Numbers and constants: BUILD-9.
- `lint-plan [--strict]`: dependency cycles, unowned AC lines, `artifacts` overlap between units that could run concurrently, a unit whose `artifacts` is declared empty or missing, deadlock. `--strict` promotes warnings to errors. Rule ids and severities: `cycle`, `dangling_dep`, `duplicate_wo`, `artifacts_empty` (error: `artifacts: []`), `artifacts_overlap`, `deadlock` (error); `artifacts_missing` (warn: key absent = legacy WO, runs serially), `dep_out_of_scope`, `unowned_ac` (warn).
- Output: `{"ok":true,"cmd":"plan","units":[{"id":"u-build-wo-05-001","kind":"build","wos":["wo-05-001","wo-05-002"],"frd":"frd-05","chain":"c-wo-05-001","depends_on":[],"cell":{"runtime":"claude","model":"sonnet","effort":"medium"},"why":null}],"rounds":[["u-build-wo-05-001"]],"issues":[{"rule":"...","wo":"wo-05-002","severity":"error|warn","detail":"..."}]}`. No schema file exists for this shape; this file is its definition.
- Exit: 0; `lint-plan` exits 6 when any issue has `severity:"error"` (or any issue with `--strict`).
- Ids: a `build` unit is one chain of ≤3 WOs: `u-build-<first wo>`, `chain` = `c-<first wo>`; other units `u-<kind>-<first wo|frd|doubt id>`; consult units `u-doubt-consult-<doubt id>-c<n>`; no attempt suffix in ids. Tests units: `u-tests-<first wo>`, emitted before a build unit whose static zone is floor/r1 and whose WOs cite an AC id absent from their FRD at `integration.base_sha`, or for a `type: bug` card.

### 3.7 `risk`

Read-only risk zoning (`risk.mjs` exports `computeRisk(input, deps)`, `input = {root, files|range}` with exactly one of the two). Input: `--files a,b` (changed paths, `linesKnown:false`) or `--range base..head` (the CLI reads `git diff --name-only` and the added lines of `git diff -U0`).

```json
{"zone":"none|floor|r1","rules":["R1","R2"],
 "signals":{"product_floor":[],"classify":[],"security":[],"risk_paths":[]},
 "irreversible":false,"audit":false,"failclosed":false,"unclassified":["src/x.ts"]}
```

- `r1` is true when `productFloor(ctx).floor` (imported from `plugin/scripts/product-floor.mjs`) is true: P1 auth/session, P2 payments, P3 persistence of personal data, P4 secrets/env, P5 destructive data operations. This is the only zone that routes to Astra.
- `floor` is any other case where `classify-change.mjs` returns a `floor_hits` entry with `level:"critical"` whose signal is in `{S5, S6, S7, S8, S9, S17}` or a `risk` glob of `.pandacorp/risk-paths` matches. The classifier runs as `execFile(process.execPath, [classifyChange, "--repo", root, "--range"|"--files", ...], {timeout:60000})` and one JSON line is parsed.
- `none` otherwise. Classifier exit 3, a `FAILCLOSED` signal or a product-floor throw gives `zone:"r1"`, `failclosed:true` and the `risk` command exits 9.
- `.pandacorp/risk-paths` format: one glob per line, an optional leading `risk` or `low` word (`risk <glob>`, `risk: <glob>`, `low <glob>`; a bare glob counts as `risk`), `#` starts a comment, blank lines ignored. `risk` globs raise the zone to `floor`; `low` globs only mark a file as classified.
- Rule names: `R1` = product floor, `R2` = classifier floor signals, `R3` = security delta (audit trigger only), `R11` = risk-paths. `R4` to `R10` are retired.
- `irreversible` is `r1 OR S5 OR S8`; it is the deterministic doubt veto and the session cannot override it. `audit` is `securityDeltaTriggers(ctx).hits.length > 0 OR r1` (one security audit per build).
- The static zone (builder routing, tests-first) is `--files` over the units' `artifacts`; the review zone is the maximum of the static zone and the diff zone. A missing `risk-paths` file: unmatched production files are listed in `unclassified` and do not raise the zone. A `normal`-level floor hit (e.g. S17 "madge is not installed") goes to `signals.classify` and its files to `unclassified`; it never raises the zone.
- Rule meanings and routing consequences: BUILD-10 of `build-engine.md`.

### 3.8 `next`

Fenced. The scheduler: the only way work is handed out. Arguments: `--epoch <n>`, optional `--wait <seconds>` (<= 300; long-poll until something changes or the time passes, so the session needs no `sleep` or `tail` loop). Output shape and order of work: section 4.

Exit: 0 for every `action`; 3 fence; 8 engine failure.

### 3.9 `report`

Fenced, two-phase. Ingests a worker's report for a unit (kinds `docs`, `tests`, `build`, `patch`; `review`, `deferred-review` and `audit` go to `review-record`, `doubt-consult` to `doubt answer`). Arguments: `--epoch`, `--unit <id>`, `--token <opaque>`, `--file <report.json>` (a file the worker wrote at `report_path`). The session CLI `report` and the internal `ingest` accept `openDoubt:true`: a `doubt` status or a diagnosis-only `blocked` report (spec-ambiguous, test-defective) then opens the doubt itself (idempotent; a later `doubt open` returns `applied:false`) and the result carries `doubt_opened`, or a `handback` (reason `worker_blocked`) when the doubt cannot be built or opened.

Procedure:
1. *Phase 1:* verify the fence and the unit token, renew the lease, validate the file against `schemas/report.schema.json`.
2. *Checks* (the report is trusted for nothing; the offender pays, i.e. the rejected attempt counts against the unit): `files` equals the changes of the unit worktree; every file is inside the unit's allowlist (glob literal-prefix match): `build`/`patch` = the union of its WOs' `artifacts`; `docs` = `docs/**`, `README.md`, root `DESIGN.md` (BL-0314: design changes amend it), `.env.example`, plus new WO files under `docs/frds/*/work-orders/` whose frontmatter has `implementation_status: PLANNED`; `tests` = `**/_tests/**`, `**/*.test.*`, `**/*.spec.*`, `e2e/**`, `src/test/**` only; no `**/*-snapshots/**`; no change to the frontmatter of an existing WO (the body of the unit's own WO only if that file is in `artifacts`); no change to any path in the run's hashed set (the union of every unit's `test_hashes` and `probe_hashes`); schema and migration paths are allowed (G3 gates them).
3. *G1*, outside the mutex: `bash .pandacorp/verify.sh --light --tests=<test files among report.files>` in the unit worktree. No e2e in G1.
4. *Commit* with the CLI's own pathspec-limited `git commit` of the validated files, trailers `Unit: <unit>` and one `WO: <wo id>` per WO, never `Change:`. The commit path is self-contained.
5. *Phase 2:* re-verify the epoch, write state (unit `committed`), journal `report_received` and `wo_committed`, emit the legacy event `wo_commit {frd, wo, unit, state:"committed"}`, release the unit token.

Special cases:
- **Tests units** (`kind:"tests"`, tests-first, D16): G1 must be RED on the new test files by assertion (not import or syntax errors) and green on everything else; outcome `committed`. The CLI hashes the test files into the tests unit's own `state.units[].test_hashes` and into `report_received.data.test_hashes`; the worker never reports hashes. The tests unit is integrated before the dependent build unit branches; that build unit's `report` rejects any change to a hashed file; `land` re-hashes. In v2 this replaces the `drift-proof.mjs` differential for bug cards.
- **Docs unit** (a card with no WOs): commit trailer `Change-Docs: <slug>` on the unit's own branch (it reaches `lane/<run_id>/integration` through the normal chain integration); the CLI writes `docs_sha` into the gitignored card; on its `committed` report the planner re-runs on the integration worktree and queues the new units (size may rise, never fall).
- **`gate`**: a report with a non-null `gate`, or S8 or deploy reasons on the unit diff, puts the unit in `waiting_gate`, opens question `g-<unit>` and emits `WaitingGate`. The diff gate is on by default for every kind: after the checks, G1 and the unit commit, `risk.computeRisk` classifies `<unit base>..<commit>`; an `S8` hit opens the gate (the deploy pattern `vercel|wrangler|fly|netlify deploy|publish` gives kind `external`, otherwise `delete`; a failclosed classifier gives `delete` with detail "el clasificador no pudo revisar el diff"). The commit stays on the unit branch, the unit is `waiting_gate` at the same attempt, the token is released, the journal gets `waiting_gate` (no `wo_committed`) and the output carries `gate:{kind, detail, source:"diff"}`, `commit` and `question:"g-<unit>"`. The check is skipped when `state.answers["g-<unit>"]` is `true`; after the owner's OK the unit is re-dispatched on the same worktree and the same report resumes from that commit to `committed`.
- **Idempotent re-ingest** (`resumeCommitted`): when a crash left exactly one unit commit ahead of base (`Unit:` trailer equal to the unit, committed files equal to `report.files`, clean worktree), a retried `report` completes phase 2 from that commit without re-running G1 and returns `resumed:true`; anything else is a rejection.
- **Doubt**: `status:"doubt"` leaves the unit `reported` with `doubt_id` (a `doubt open` follows); no attempt is consumed and the token is released; `decided` re-queues the unit at the same attempt with the decision in its brief; `parked` parks it.
- **Attempts**: at most 3 per unit (counted per WO as the max attempt of its build and patch units); a rejected or failed report re-queues the same unit at attempt+1 (the failure policy is `failure.mjs` `applyUnitFailure`, shared by `report` and `next`); a worker that ends without a valid report (crash, watchdog, unreadable or invalid `report.json`) is a failed execution of the same kind (`failUnit`, source `worker_failed`, not a public command); `status:"blocked"` never retries: it routes by diagnosis (`spec-ambiguous` to the doubt ladder, `test-defective` to the dispute, `dependency` to an immediate hand-back) and otherwise hands back with reason code `worker_blocked` (cause = the diagnosis cause, else `owner`); a failed or rejected attempt 2 with a `diagnosis` makes the CLI queue attempt 3 automatically (`next_attempt:3`); evidence identical to attempt 2 means hand-back. There is no public escalation command; the policy is BUILD-15.

Output: `{"ok":true,"cmd":"report","outcome":"committed|rejected|doubt|blocked|failed|waiting_gate","commit":"<sha>","g1":{"exit":0,"tail":"..."},"test_hashes":{"path":"<sha256>"},"next_attempt":null}`.

| `outcome` | Cause | Exit |
|---|---|---|
| `committed` | valid, in scope, G1 as required | 0 |
| `rejected` | token, schema or scope violation, or G1 red | 6 |
| `doubt` | worker returned `status:"doubt"` | 0 |
| `blocked` | worker returned `status:"blocked"`: hand-back (unit and dependents `blocked`), see Attempts | 0 |
| `failed` | worker returned `status:"failed"` | 0 |
| `waiting_gate` | `gate` set or S8/deploy reasons on the unit diff | 7 |

### 3.10 `review-record`

Fenced. Records a reviewer's verdict for `review`, `deferred-review` and `audit` units. Arguments: `--epoch`, `--unit`, `--token`, `--file <review.json>` (valid against `schemas/review-report.schema.json`).

Effects: verify the token; compute the sha256 of each probe file; commit the probe files that have `failed_first:true` onto `lane/<run_id>/integration` with trailer `Unit: <review unit>` and store them in the review unit's `probe_hashes` (the patch unit's brief lists them as read-only RED tests; `land` re-hashes; the probe budget is in BUILD-10); append `review_recorded` (its `data.verdict` carries the verdict); update the unit (`review.verdict`, `reviewer`, `degraded`). The recorded reviewer is the unit's dispatch cell; `degraded` is inferred by replaying routing `reviewCell` over the availabilities, and the call exits 6 when the report's `reviewer` differs from the dispatch cell or when the reviewer model authored part of the diff and the replay is not `same_model` (N7). `deferred-reviews.json` is written only inside a run. By verdict:
- `pass`: the reviewed units become `verified` (they reach `main` with the landing).
- `reopen`: a `patch` unit is queued; the WO goes `IN_REVIEW -> PLANNED -> IN_PROGRESS` through `transitionWorkOrderAt` (bumps `reopen_count`). (`u-patch-<first wo>`, attempt = max attempt of the reviewed units + 1)
- `blocked`: the reviewed units are handed back (3.14) with the finding as reason.
- `doubt`: a `doubt open` follows.
A review that fell back to another company is queued in `deferred-reviews.json` for a re-review (the matrix and the rules are BUILD-10): one pending entry per review unit and kind, and a newer degraded review of the same unit refreshes it (its `sha_range` covers the older one). `review-record` never queues an `audit`: the audit runs only on Claude opus high, and `next`/`drive` queue it when Claude is out.

Output: `{"ok":true,"cmd":"review-record","verdict":"pass|reopen|blocked|doubt","deferred_review_id":null,"probes_committed":["tests/probe-a.test.ts"]}`.

Exit: 0; 6 (`INVALID_INPUT`) when the review file is invalid JSON or schema, the token or unit does not match, `doubt` is set when the verdict is not `doubt` (or missing when it is), a `reopen` or `blocked` verdict carries no finding, a `pass` carries a critical or high finding or a failing traceability entry, a probe path is not an allowed test path, is listed twice, or is named by a finding but absent from `probes[]`, a probe file is missing or changed (hash mismatch) or would overwrite an existing file on the integration branch, the report's `reviewer` differs from the dispatch cell, or an author reviews its own unit outside N7; 5 on an invalid state; 3 on fence. `deferred_review_id` is non-null for a `deferred-review` unit (the ledger entry it serves: the optional `deferredId` input, else matched from the unit id, then by FRD) and for a degraded review that queued an entry; otherwise `null`. Output extras: `reviewer`, `degraded`, `reviewed_units`, `patch_unit`, `handed_back`, `bug_card`, `doubt_file`, `probes_skipped`, `last_safe_point`.

### 3.11 `land`

Fenced. Lands the integration branch through merge-queue and harvests its result. Chains reach the integration branch inside `next` (4.1). The session calls `land` when `next` returns `action:"land"` (the batch is complete: all non-parked units of the run, or of the tranche for a giant run). Argument: `--epoch`. There is no `--chain`. `land` returns `{exit, output}`: the exit travels beside the JSON for the result-bearing non-zero exits 6 and 7.

Phases:
1. *Phase 1:* verify the fence, renew; if a land job is alive return `result:"running"`; if a land job already finished, harvest it (step 5).
2. *Rebase, outside the mutex:* rebase `lane/<run_id>/integration` onto the current `main` in the integration worktree (a conflict → `handback` reason `rebase_conflict`, exit 6). *Phase 2:* re-verify the epoch and that the integration tip is the rebased one, re-hash the run's hashed set, then commit on it the landing metadata commit: WO `VERIFIED` for every review-verified unit (with rollups), `status.yaml` `last_green_sha: <sha of the code tip just below this commit>`, `safe_to_test: true`, `phase: implementation` if it was `architecture`, and the trailer `Change: <slug>` only if this landing completes the card.
3. Before the job is spawned, `next` (not `land`) checks that the integration worktree is bootstrapped (4.1); `land` itself runs no bootstrap. Spawn the `land` job (a detached job with no H slot of its own; `merge-queue.sh` takes the host H slot around its `verify.sh`): `merge-queue.sh` run from the integration worktree. Return `result:"running"`.
4. `merge-queue.sh`'s G3 judges that tree; red means nothing reaches `main`.
5. *Harvest* (by `land` or by `next`): map the exit code (table below); after exit 0 archive the card idempotently (it is in `inbox/changes/` → `status: done`, `shipped_sha`, moved to `done/`; already in `done/` because merge-queue's DR-147 reconciler moved it → add `shipped_sha` if missing; in neither → journal a note; never an error) and journal `batch_landed {sha}`; if `last_green_sha` is not an ancestor of the new `main` (merge-queue re-rebased because `main` moved) journal `pin_stale` (the next landing rewrites it; a documented race). `landed` sets the units' state to `landed`.

`merge-queue.sh` exit map:

| mq exit | `result` | `reason` | `land` exit |
|---|---|---|---|
| 0 | `landed` | `null` | 0 |
| 10 | `handback` | `rebase_conflict` | 6 |
| 11 | `handback` | `g3_red` (evidence-scoped patch; see below) | 6 |
| 12 | `nothing_to_land` | `busy_main` (retried at the next safe point) | 0 |
| 14 | `nothing_to_land` | `port_busy` (retried at the next safe point) | 0 |
| 13 | `landed` | `null`, `notes_es` says "push falló"; only possible with the owner's order | 0 |
| 20 | `nothing_to_land` | `mq_precondition` (retried at the next safe point; a second consecutive 20 in the run is an engine failure, exit 8) | 0 |
| 21 | `waiting_gate` | `null`; `waiting_gate:"production"` is stored on the units; the CLI never sets `PANDACORP_OWNER_RELEASE_OK` | 7 |

Other reasons: `handback` `rebase_conflict` from the pre-job rebase (exit 6); `handback` `oracle_changed` (a hashed test or probe file changed since it was recorded, exit 6); `nothing_to_land` (exit 0, nothing is written or journaled): `batch_incomplete` (called before the batch is complete), `no_verified_work`, `land_job_dead` (the job is gone and `main` lacks the branch; retried). The output may also carry `patch_unit` and `notes_es`; the landing metadata commit carries the trailer `Landing-Metadata: <run_id>`. Units are landable when `verified`, or `integrated` for `docs` and `tests` units (they are never reviewed); a unit with any `parked` value is outside the batch, so pending assumption work never blocks landing the independent batch. A retry is idempotent: the run's own landing metadata commit at the tip is dropped and rewritten (no intent is persisted). A G3 red (mq exit 11) follows selective repair below; it never reopens the entire batch by default.

**Selective G2/G3 repair.** `gatefail.mjs` parses failed Vitest/Playwright blocks, tsc, Biome,
Next build and doc-lint diagnostics (including bullet paths). PASS output and command echoes do
not implicate files. Canonical WOs are read from the integration commit; diagnostic paths match
WO `artifacts` or unit `test_hashes`. Only implicated build/patch units enter `patching`, and
only those WOs reopen at dispatch. The patch's WOs/allowlist are exactly the implicated WOs.
Healthy units remain settled. The reviewer brief pins `Diff range: <base>..<tip>` to the latest
integrated patch execution, excluding earlier FRD work/attempts. Verification:
`plugin/scripts/test-build-v2-gate-patch.mjs`, `test-build-v2-next.mjs`,
`test-build-v2-review.mjs`, `test-build-v2-land.mjs`.

`build/units/<patch>/gate-failure.json` (`schemas/gate-failure.schema.json`) is:
`{schema:1, gate:"G2|G3", job, checks[], tests[], paths[], tail, attributed, wos[], allowlist_wos[], fixes[]}`.
`tail` is at most 40 lines / 12000 characters. The patch brief includes those checks/test ids and
paths and the instruction to fix only red checks without rewriting the WO/FRD. Evidence is
persisted only after fence and job/state checks: G2 inside its mutation, G3 after an outside-mutex
attribution prepared against a pinned integration tip and checked again at harvest.
Verification: `test-build-v2-gate-patch.mjs`, `test-build-v2-land.mjs` under `plugin/scripts/`.

With no attribution, `u-patch-g3` or `u-patch-g2-<frd>` has `attributed:false`, empty `wos` in
evidence, and the candidate union in `allowlist_wos` (also the patch unit's `wos`). These WOs are
permission boundaries only: no WO reopens or spends an attempt. The fallback has its own three
executions, independent of prior WO attempts; hand-back blocks the fallback/dependents without
changing healthy WO frontmatter. Attributed work counts the maximum build/patch attempt per WO;
tests/docs/reviews/audits/consults never charge that budget (N16). Verification:
`plugin/scripts/test-build-v2-failure.mjs`, `test-build-v2-gate-patch.mjs`,
`test-build-v2-next.mjs`, `test-build-v2-land.mjs`.

Output: `{"ok":true,"cmd":"land","result":"landed|waiting_gate|handback|nothing_to_land|running","reason":null,"mq_exit":0,"sha":"<sha>"}` (`mq_exit` and `sha` are `null` when not applicable).

The owner's production order for a launched project is only `PANDACORP_OWNER_RELEASE_OK=1 ... land --epoch <E>`, set on that one command by the owner's chat order (BUILD-13).

### 3.12 `doubt open|answer`

Fenced. The doubt ladder (sources, consult 1, consult 2, decide or park; caps and the never-decide list are BUILD-12). The CLI never asks the owner. The state of one doubt is the record `build/doubts/<id>.json` (`schemas/doubt.schema.json`): `step` in `sources|consult1|consult2|decided|parked`; `consults[]` (`{runtime, model, effort, via, brief_path, answer}` where `answer` is the parsed answer object or `null`); `decision` (`null` or `{value, why, decided_by}` with `decided_by` in `sources|consult1|consult2|engine|owner`); `assumption` (`null` or `{option, branch}`, set when a root block is built on assumption). While its doubt is open the unit is `reported` with `doubt_id`.

**`doubt open --epoch <E> --unit <id> --file <doubt.json>`.** `doubt.json` is the worker's or reviewer's own `doubt` object copied verbatim from its report (`{question, options[{id,text}], preferred, why}`; not the stored record). Creates the record at `step:"sources"`. Under `drive` or the Codex app (R-B) the sources step is skipped: `doubt open` returns `step:"consult1"` and the consult brief tells the consultant to check the sources first.

**`doubt answer --epoch <E> --id <doubt_id> --file <answer.json> [--token <t>]`.** Feeds one step of the ladder. Files: the worker's doubt object at `build/units/<unit>/doubt.json`; a consult answer at `build/units/<consult unit>/answer.json`; a sources answer at `build/doubts/<doubt_id>.sources.json`. Validation by step: sources = `{decision: string|null, rationale: string, consulted: null}` (other keys ignored); consult = `schemas/doubt-answer.schema.json`. Consult `answer.json`:

```json
{"decision":"<option id>|null","rationale":"<text>","consulted":{"runtime":"claude","model":"opus","effort":"high"},
 "confidence":"high|medium|low","reversible":true}
```

- `decision`: an option id of the doubt, or `null` ("nobody answers").
- `rationale`: for the sources step a `path:line` citation of the explicit statement, or the text `no source answers`.
- `consulted`: the consultant's cell `{runtime, model, effort}` (model names are catalog keys), or `null` on the sources step.
- `confidence` and `reversible`: required on a consult step (schema), absent on the sources step.
- The sources step with no source answering: `{"decision": null, "rationale": "no source answers", "consulted": null}`. It moves the doubt to `consult1` (or to `parked` when the cap or the irreversibility veto applies). The same file with a non-null `decision` and `consulted:null` is a sources hit: the doubt goes to `decided` with `decided_by:"sources"`.
- A consult unit that returned no JSON: the session files `{"decision": null, "rationale": "consultant returned no answer", "consulted": <cell>, "confidence": "low", "reversible": false}`. It counts toward the cap and advances the ladder.
- `--token` is the consult unit's token (D4: `doubt answer` verifies and releases it). It is required when the consult was served `via:"agent"`; the CLI files `via:"cli"` consults itself.

**The consult channel (one only).** A consult is dispatched through `next`, as a unit of `kind:"doubt-consult"` (section 4), and nowhere else. The `consult` object that `doubt open` and `doubt answer` return is the same consult announced in advance, for logging; the session MUST NOT dispatch it from this output. The CLI writes the consult brief at `consult.brief_path`; the `doubt-consult` unit that `next` serves carries the same `brief_path`, `model`, `effort` and `via`, and the unit's `report_path` is where the consultant writes its JSON answer. A consult is therefore dispatched exactly once:
- `via:"cli"` (Codex consultant: the origin is Claude, or a drive or Codex-app coordinator): the CLI launches it from `next`, ingests the result and advances the ladder. The session does nothing.
- `via:"agent"` (Claude consultant): `next` returns the unit; the session launches it as an agent call, and when it returns writes `answer.json` (the consultant's `{decision, rationale, confidence, reversible}` plus `consulted`) and calls `doubt answer` with the unit token.

**Output:**

```json
{"ok":true,"cmd":"doubt","doubt_id":"d-...","step":"sources|consult1|consult2|decided|parked",
 "consult":{"unit":"u-doubt-consult-d-0003-c1","runtime":"codex","model":"sol","effort":"high","brief_path":"/abs","via":"agent|cli"},
 "decision":{"value":"a","why":"...","decided_by":"sources|consult1|consult2|engine|owner"}}
```

- `consult` is present only when the next step is an external consult. Its `runtime`, `model` and `effort` come from `routing.mjs` (doubt consult routing, BUILD-10). `decision` is `null` until `decided`.
- `decided`: writes the autonomous decision to the project's `docs/decision-log.md` ("Decidido sin el owner") on the integration branch, appends it to `.pandacorp/inbox/decisions.md` (written in the integration worktree when that file is tracked), journals `autonomous_decision` and emits `AutonomousDecision`; the unit resumes. `parked`: the unit becomes `parked:"owner_question"` with `pending_answer` set to the doubt id (answerable through `answer`, 3.13), the question is written to `decisions.md` (with the untracked mirror below when tracked), `parked` is journaled and `UnitParked` emitted.
- The ladder asks at most 2 consults: with no 2-of-3 winner after consult 2 the doubt parks `no_consensus` (the hard cap of 3 calls per doubt stays in `queueConsult`). With a winner, the doubt parks `consult_irreversible` when any voter, or any answered non-voting consult that chose the winning option, says `reversible:false`. Doubt ids continue after the highest of the record files and the `doubt_opened` events of the journal (a `kill -9` inside `doubt open` never reuses an id).
- `isRepeatDoubt`: a doubt the engine synthesizes (`doubts.SYNTHESIZED_OPTION_IDS`: dispute `fix-test`/`keep-test`, ambiguity `conservative`/`ask-owner`) repeats a decided one only when the normalized question (accents removed, lowercase, punctuation collapsed) is equal; a distinct second ambiguity goes up the ladder; a worker-authored doubt keeps the rule of equal option ids plus equal preferred. A reworded repeat is stopped only by the 8-consulted-doubts cap.
- The doubt file-risk veto fails closed: a missing or unreadable `docs/frds`, an unreadable work-order file, or a WO id not found makes the risk `{zone:"r1", irreversible:true, failclosed:true}` and the doubt parks at once; `artifacts:` is read in block and inline (`[a, b]`) form.
- When the doubted unit is missing or terminal (`blocked`, `landed`), `advance`, `decide` and `park` change nothing (no log entry, no inbox entry, no commit, no new consult); `doubt answer` still files the consult answer and returns `applied:false, reason:"unit_settled"`. A hand-back (3.14) also blocks and settles the open `doubt-consult` units of the handed-back units' doubts (token released, running workers stopped).
- Engine commits on the integration branch use `git -c commit.gpgsign=false commit --no-verify` (doubts, hand-backs, owner-answered inbox), so a user hook or a gpg agent never runs inside the 1 s mutex window. The decision-log entry names the branch `lane/<run_id>/integration`.
- A doubt on a unit whose risk output has `irreversible:true` never reaches `decided`; it parks (deterministic veto). Also never decided autonomously: widening, reducing or reinterpreting Dentro, product scope, DRs with `requiere_humano`, human gates, money (BUILD-12).
- Exit: 0 (also when the cap is exhausted: the JSON carries `step:"parked"`); 6 invalid file or wrong token.

**Tracked inbox mirror (DEC-14/DEC-16).** `writeInbox` writes canonical tracked
`.pandacorp/inbox/decisions.md` on integration and also prepends the entry to main-checkout
`.pandacorp/inbox/decisions.pending.md`, after `assertNotTracked`. `answer` resolves the entry in
both copies; the mirror is an owner-visible projection, not another source of answers. Standalone
untracked inbox behavior stays unchanged. Verification: `plugin/scripts/test-build-v2-nested.mjs`,
`test-build-v2-answer.mjs`, `test-build-v2-doubts.mjs`.

### 3.13 `answer`

`answer --epoch <E> --question <id> --value '<json>'`. Fenced. Records an owner answer that arrives after the first-minute message, in a run that is alive. Three kinds of question can be answered:

| `kind` | Question id | What the answer is | Effect |
|---|---|---|---|
| `ask` | `q-<check id>` from `start --preflight` (the run's question set is `run_started.data.preflight` of the journal; `build/preflight.json`, which belongs to the latest `--preflight`, is read only when the journal has no preflight object, e.g. before `run_started`) | the owner's choice for a first-minute ask: a boolean, an option id string or an object, as the ask's `default_action` implies | stored in `state.answers[<id>]`; applied to the units with `pending_answer == <id>` |
| `parked` | the doubt id of a unit parked as `owner_question` (also the id written to `.pandacorp/inbox/decisions.md`) | an option id of the doubt (a JSON string) | the doubt record gets `decision:{value, why:"owner answer", decided_by:"owner"}` and `step:"decided"`; the parked unit and its dependents leave `parked`. A built-on-assumption park (the doubt has `assumption{option, branch}`): value equal to the option means `assumption_accepted`, anything else `assumption_discarded`. A unit that already carries an assumption (`parked:"built_on_assumption"`) never roots a second one: when it raises another doubt it parks on that doubt (`parked:"owner_question"`, `pending_answer` = the second doubt) and keeps `assumed_on:<first doubt>`; answering the second doubt restores `parked:"built_on_assumption"` from `assumed_on`, and rejecting the first discards every unit carrying it, even one parked on another question (DEC-7: it is re-queued at attempt+1, the second doubt stays open in the inbox and answering it releases nothing; DEC-8). Units built on assumption (`parked:"built_on_assumption"`) are dispatched from and integrated into `lane/<run_id>/assume-<doubt>` (worktree `build/wt/assume-<doubt>`); G2, review and G3 of that work run after acceptance on the integration branch |
| `gate` | `g-<unit>` of a unit at a `money`, `delete` or `external` `waiting_gate` (listed in `status` and `finish` `open_questions`) | `true` (OK) or `false` (refused) | recorded as the owner's explicit OK; `true`: the unit leaves `waiting_gate`; `false`: the unit is handed back (reason "owner refused gate") |

A question of the `production` gate is not answerable here: landing on the default branch of a launched project is ordered only through `PANDACORP_OWNER_RELEASE_OK=1 ... land --epoch <E>` (BUILD-13); `answer` for it exits 6 with a `message` saying so. An answer given through `/pandacorp:decide` during a live run is also recorded with `answer` (the decide skill routes ids in `open_questions` through this command).

Effects, in order: validate id and value; write `state.answers[<id>] = <value>`; journal `answer_recorded` (`data:{question, kind, value, units}`); update every affected unit (table below). `--wait` of a waiting `next` returns early on `answer_recorded`.

Rejecting an assumption stops the live workers of the units it discards (after the fenced phase, through `workers.stopWorkers`; the output carries `stopped_workers: [ids]` when non-empty, and a stop failure is only a warning). "Already built" is judged from the unit's state, not from its branch or worker: a unit outside `queued|admitted|parked` was built, and a `queued|admitted|parked` one only when its `doubt_id` is a later doubt than the question; the assumed root that was never rebuilt is re-queued at the SAME attempt (no attempt charged).

Per affected unit, `effect` is one of:

| `effect` | When |
|---|---|
| `unblocked` | the unit had `pending_answer == <id>` and had not been dispatched yet: `pending_answer` cleared, brief regenerated with the answer, eligible in `next` |
| `none_default_matches` | the unit already ran on the default and the answer equals it: nothing changes |
| `rework_queued` | the unit already ran on the default, the answer differs and the change is reversible: a `patch` unit is queued (attempt = the unit's attempt + 1, `depends_on` the unit); at attempt 3 the unit is handed back instead (`handed_back`) |
| `handed_back` | the owner's answer differs from the default a unit already used at attempt 3 (DEC-6), or a rejected assumption's unit already spent its 3 executions (reason code `answer_rework_budget`): the unit and its dependents are `blocked` (R4) |
| `released` | the unit was `parked:"owner_question"` or at a `waiting_gate` for this id: it returns to `queued` with `pending_answer`, `parked` and `waiting_gate` cleared |
| `assumption_accepted` | the root block built on assumption (`lane/<run_id>/assume-<doubt>`) is accepted: `integrate.mjs` merges its branch into `lane/<run_id>/integration` (`--no-ff`, trailer `Doubt: <doubt>`) at the first integration pass after `answer_recorded`; a conflict hands the doubting unit back with reason `rebase_conflict`. A discarded branch is never merged and never deleted (deletion is the owner's call) |
| `assumption_discarded` | the assumption branch is discarded (DEC-7): the affected units are re-queued at attempt+1 on a fresh branch (they never reuse the branch holding the rejected code) with the answer in the brief; at attempt 3 they are handed back (`answer_rework_budget`) |
| `refused` | a gate answered `false`: the unit is handed back (reason code `owner_refused_gate`) |

What `next` does afterwards: the next `next --epoch <E>` already sees the cleared `pending_answer` / `parked` / `waiting_gate`, so previously deferred units are eligible again, scheduled by the normal order (units that still carry another open `pending_answer` remain last). A released gate unit is served with its brief carrying the owner's OK (question id and value) so it may perform the gated step; the CLI itself never performs a gated action without that recorded OK. Units that were reached without an answer have already followed the default when the question was `reversible` and were parked `owner_question` when it was not.

Output: `{"ok":true,"cmd":"answer","question":"q-...","kind":"ask|parked|gate","applied":true,"units":[{"unit":"u-build-wo-05-002","effect":"unblocked"}],"reason":null}`.

- Idempotent: the same question answered again with the same value returns `applied:false, reason:"already_answered"` (exit 0). A different value for a question whose units already acted on the first answer is `applied:false, reason:"superseded_by_earlier_answer"` (exit 0, nothing changes; the owner's change of mind becomes a card). Units "already acted" means: previous effects `none_default_matches`, `rework_queued`, `handed_back`, `refused` or `assumption_discarded` always; `assumption_accepted` once its branch is merged; `unblocked` or `released` once the unit left `queued|parked|waiting_gate`. Otherwise the different value replaces the first answer and is re-applied (a new `answer_recorded`).
- Exit: 0; 2 when `--question` or `--value` is missing or `--value` is not valid JSON; 3 fence; 6 when the id is unknown to this run, the value does not fit the question, or the question is the production gate.

### 3.14 `handback`

Fenced. Writes `build/handback/<unit>.md` (format defined in BUILD-15), writes the pending entry into `.pandacorp/inbox/decisions.md`, and sets the WO `BLOCKED` with `blocked_reason` (a commit on the integration branch). The unit, its `dependsOn` dependents and the non-terminal `doubt-consult` units of any of their doubts become `blocked` (never `parked`, which is reserved for owner questions and assumptions; R4) and their WOs `BLOCKED`; independent units continue. Reason codes (`reason_code` in the hand-back file and the journal): `rebase_conflict`, `g3_red`, `budget_exhausted`, `no_diagnosis`, `oracle_changed`, `owner_refused_gate`, `answer_rework_budget`, `worker_blocked`, `worker_failed`. Arguments: `--epoch --unit --reason "<text>"`. Output: `{"ok":true,"cmd":"handback","path":"/abs/.pandacorp/run/build/handback/<unit>.md"}`. On a `doubt-consult` unit, `handback` exits 6 (a consult with no answer is filed with `doubt answer`, 3.12). Engine faults use `handback/engine.md` instead and exit 8 from whichever command hit them.

### 3.14b `unblock` (BL-0312)

`unblock --epoch <E> --unit <unit> --reason "<what was fixed>"`. Fenced. The one way back for a unit handed back for an **environment** failure (cause `env-infra`: the sandbox could not reach a service, a tool or disk failed) once the coordinator has fixed the environment. Accepted only when the unit is `blocked`, of kind `docs|tests|build|patch`, and the LATEST `handback` journal event that blocked it names it as the root (`data.unit`) with `cause:"env-infra"`; otherwise exit 6 (`INVALID_INPUT`): a dependent names its root (`unblock` the root instead), any other cause stays the owner's decision (`/pandacorp:decide`), a non-blocked unit has nothing to unblock. A missing `--reason` is exit 2. Effects, in one phase 2: the unit and the dependents that same hand-back blocked (a dependent re-blocked later by a hand-back of its own stays blocked; `doubt-consult` units stay settled) return to `queued` at the **same attempt** (no execution of the per-WO budget is spent; `token_hash`, `worker`, `parked`, `pending_answer`, `waiting_gate` cleared), `handbacks_in_a_row` resets to 0, their WOs go `BLOCKED -> PLANNED` (`blocked_reason` removed) and the pending decisions entry of the hand-back is marked `RESUELTO` (one integration commit `chore(build): unblock <unit> after an environment fix` with `Unit:`/`WO:` trailers), `report.json` is kept as `build/units/<unit>/report-a<n>-blocked.json`, and `build/units/<unit>/unblocked.json` `{attempt, at, reason, previous_report, worktree, worktree_changes}` makes the next brief of THAT attempt say it resumes after the fix and name the previous report (a later attempt never sees it). The unit's registered worktree, uncommitted work included, is reused untouched by the next dispatch (`prepareUnitWorktree` re-adopts an existing worktree of the same attempt). Journal: `unblocked {unit, cause, attempt, reason, units, handback_seq}` then `unit_state blocked->queued` with `reason:"unblock"` (replayed by `rebuild-state`). Output: `{"ok":true,"cmd":"unblock","unit":"u-docs-x","attempt":1,"units":["u-docs-x"],"wos_planned":[],"worktree":"/abs/.../wt/u-docs-x","worktree_changes":13,"previous_report":"/abs/.../report-a1-blocked.json","commit":"<sha>|null","notice_es":"Unidad reanudada: ..."}`. A run that already ended (`next` returned `done` and `finish` closed it as `finished`, or it stopped on `env_infra_handbacks`) has no lease to fence against: use `start --resume --coordinator <C> --unblock <unit> --reason "<text>"` (3.4), which validates the same rules BEFORE it takes the lease and then applies the same effects.

### 3.15 `quota record` and `quota read`

- `quota record --provider claude [--five-hour <P> --weekly <P>] [--five-hour-resets-at <iso>] [--weekly-resets-at <iso>] [--status ok|unavailable] [--epoch <E>]`: the session calls this at safe points with the percentages it read from `get_usage`. `--status` defaults to `ok`. With `--status ok`, `--five-hour` and `--weekly` are required (missing: exit 2). With `--status unavailable` they are **not** required: the reading is stored with `five_hour_pct:null` and `weekly_pct:null` (and any resets given) and `effective()` reports `state:"unknown"` (reactive-only policy). It writes `build/quota.json` only; it journals `quota_reading` and emits `QuotaReading` only when `--epoch` is given (then it is fenced). Output: `{"ok":true,"cmd":"quota","sub":"record","reading":{"provider":"claude","five_hour_pct":36,"weekly_pct":12,"five_hour_resets_at":"<iso>|null","weekly_resets_at":"<iso>|null","status":"ok|unavailable","observed_at":"<iso>"}}`.
- `quota read [--probe]`: reads both providers and the derived policy. `--probe` allows the minimal `codex exec` probe (~20k input tokens, preflight use only). Output: `{"ok":true,"cmd":"quota","sub":"read","claude":{...},"codex":{...},"policy":{...}}`. Shapes: section 8.1.

### 3.16 `admit`

`admit [--class B|H]`. Read-only (a dry run is implied; `--dry-run` is accepted and ignored). Reports the RAM signals and the persisted-step decision a `next` would take for a unit of class B (builder, default) or H (heavy tool run). Tokens are issued only by `next`. Output: `{"ok":true,"cmd":"admit","decision":"grant|wait","class":"B|H","motivo_limite":"ancho","techo":5,"suelo":1,"A_ef":6.1,"P":3.1,"signals":{"L":1,"swapouts":0,"swap_used_mb":0,"A_gib":9.2,"A_cons_gib":7.4}}`. `motivo_limite` is the closed enum of 8.2. A `SignalError` returns exit 9 with `"safe_mode":true` (B=1, H=1, `motivo_limite:"senal_fallida"`).

### 3.17 `handoff`

`handoff --epoch <n> --reason quota95|limit|manual|test`. Fenced. The Claude session asks drive to take over: writes `build/handoff.json` only (`{run_id, from_epoch, reason, requested_at}`, valid against `schemas/handoff.schema.json`; no secret), journals `handoff_requested`, emits `BuildHandoff`. Drive performs the transfer. Output: `{"ok":true,"cmd":"handoff","handoff_path":"/abs/build/handoff.json"}`. Whether a handoff is appropriate is enforced in `next` (section 4), not here; `handoff` records the request for any of the listed reasons.

### 3.18 `drive`

Long-lived process; stdout is not used. `drive --standby --run R`: the detached relay waiting to take over (section 9). `drive --run R [--handoff-after N]`: run the active loop for run `R` directly (test and takeover entry). `--handoff-after N` is test-only: the session hands off after N committed WOs. Drive renews the lease itself; there is no separate heartbeat process.

### 3.19 `finish`

Fenced. `--epoch` is required. When no lease exists (a non-active run whose lease a terminal action released), `finish` accepts only `--epoch` equal to `state.epoch` (else exit 3) and writes without the lease. Closes a run whose status is not `active` or whose units are all terminal. On a lease that is already quiesced (a terminal action, or an earlier `finish`, died between quiesce and release) it still closes the state: `--epoch` must equal `lease.epoch` and `state.run_id` must equal `lease.run_id` (else exit 3, before any write); it then journals `run_finished` and writes `status: finished` (or, for the waiting case, journals `paused {reason:"waiting_gate"}` once and writes `waiting_gate`) and only then releases, so a retry never leaves `state.json` at `stopped` while the report says finished. After closing, eligible run worktrees and G2 snapshots are reclaimed; a waiting run keeps the
integration checkout (without `.next` when safe) and any copy still protected by a running job.
Branches and metadata survive. The performance helper attempts one host record outside the mutex.
Verification: `plugin/scripts/test-build-v2-disk.mjs`, `test-build-v2-cli.mjs`,
`test-build-v2-perf.mjs`. Writes the final report data, sets `status: finished`, always releases the lease, also when `next` already returned the terminal action for a finished run (the CLI never projects `status.yaml`) and emits `BuildComplete`. Output: `{"ok":true,"cmd":"finish","report_path":"/abs/.pandacorp/comms/informe-build-<run_id>.md","summary":{...}}` where `summary` is the `schemas/summary.schema.json` object (3.21). Exit: 0; 5 when the run is `active` with non-terminal units (go back to the loop); 7 when only `waiting_gate` units remain: the lease is released and `status` becomes `waiting_gate` (the run is finished as "waiting", not complete). `finish` on a non-active run closes it for good (`finished` is not resumable); the session protocol never calls `finish` after a terminal action, only after `done`.

### 3.20 `stop`

`stop [--epoch <n>]` or `stop --dead --owner-confirmed`. Stops a run at a safe point and releases the lease; emits `BuildStopped`, sets `status: stopped`, journals `run_stopped`. With `--epoch`, fenced. With `--dead --owner-confirmed` and no epoch, `forceRelease` releases a lease whose owner is dead (the lease must be reclaimable, i.e. expired). Output: `{"ok":true,"cmd":"stop","released":true}`. Exit: 0; 6 when `--dead` is passed without `--owner-confirmed` or the lease is live; 3 fence. After release, eligible unit/assumption/integration/G2 copies are reclaimed through the shared
predicate, including `stop --dead`; protected copies survive. Terminal `next` cleanup uses the
same lifecycle path. Verification: `plugin/scripts/test-build-v2-disk.mjs`,
`test-build-v2-next.mjs`. Running Codex workers are stopped by the quiesce (DR-142); reports of running Claude agents arriving later get exit 3.

### 3.21 `status` and `summary`

Read-only, no epoch.

- `status`: run snapshot `{"run_id","epoch","coordinator":"claude-session|codex-session|drive","status":"active|paused|waiting_owner|waiting_gate|finished|stopped","status_reason":null,"label","size","units_by_state":{},"lease":{"renewed_at","ttl_seconds","live":true},"quota":{"claude":{},"codex":{}},"drive":{"armed":false,"state":"standby|active|stopped"},"deferred_pending":0,"open_questions":[...],"admission":{"step":5,"motivo":"techo"}}`. `lease` is always an object; with no lease `{"renewed_at":null,"ttl_seconds":null,"live":false}`. Without any run every field is null, `units_by_state:{}`, exit 0. An optional `gaps[]` lists unreadable signals. Exit 9 when a signal was unreadable (snapshot printed with the gap marked). No schema file exists for the snapshot; this file is its definition.
- `summary`: the owner-report data, the `schemas/summary.schema.json` object, computed from the current journal and state without finishing the run (also what `finish` returns): `{"run_id","status","need_from_owner":[],"decided_without_owner":[],"parked":[],"reviews":{"cross":0,"degraded":[]},"deferred_pending":0,"open_questions":[{"id","kind":"ask|parked|gate","text_es","default_es","affects","reversible"}]}`. `open_questions[].id` are the ids that `answer` accepts. `admission` is null before any adaptive
  state exists, otherwise `{step,motivo}` (disk waiting overrides motivo to `disco`); `status` exposes
  the same object. Engine-failure `backlog_draft` event paths also appear in `need_from_owner`, so a
  nested project's local draft is visible in the Spanish report. Verification:
  `plugin/scripts/test-build-v2-cli.mjs`, `test-build-v2-nested.mjs`.

### 3.22 `rebuild-state`

Fenced. Regenerates `state.json` by replaying the journal and reading the WO frontmatter of the integration worktree, and writes it when different. Frontmatter wins on every conflict. Output: `{"ok":true,"cmd":"rebuild-state","units":14,"diff_vs_cache":{"changed":["u-build-wo-05-002"],"added":[],"removed":[]}}`. Exit 5 when the frontmatter cannot be read or the journal chain is broken (the engine cannot invent state).

### 3.23 Legacy mode words

`pro`, `balanced`, `powerful`, `deep` appearing in `--args` are accepted and ignored; the result carries `"warnings":["legacy mode word ignored"]`. This is compatibility parsing only; the current entry is `implement` with its target. No engine selector or opt-in keyword is required.

### 3.24 `gc`

`gc [--project <dir>]`. Idempotent worktree reclamation; no epoch and no tracked writes.
It reserves `withUnleasedProject` on the same mutex used by acquire/transfer/reclaim for both
cleanup passes. Any lease directory, including unreadable, stale or quiesced ownership, gives
`CONTENDED` (exit 4). Recorded running paths and every first-pass refusal remain excluded from
the sweep; all branches survive. `clearBuildDir` uses the same reservation through reclamation
and the archive/suspend metadata move. Output includes `removed[]`, `kept[]` and sweep details;
a second call with no eligible copies removes nothing. See 5.1 for holds. Verification:
`plugin/scripts/test-build-v2-disk.mjs`, `test-build-v2-cli.mjs`.

## 4. `next` output

Order of work inside one call (phase 1 renews the lease; phase 2 writes):
1. Harvest finished jobs and workers: ingest `via:"cli"` reports through the `report` logic with `openDoubt:true` (a doubt, or a doubt/dispute policy action, is opened by the engine, or the unit is handed back; a review verdict `doubt` of a `via:"cli"` reviewer is opened through `failure.openUnitDoubt`), G2 results, land results.
2. Integrate committed chains into `lane/<run_id>/integration` (4.1) and any accepted assumption branch not yet merged. While a `land` job is running nothing is integrated or dispatched (the land job owns the integration branch): `next` returns `wait` with reason `jobs_running`. A G2 job for every FRD whose units are all integrated (and none built on an unmerged assumption) is spawned in the admission round (step 6), right after integration, so a heavy job never starts in a RAM-denied pass.
3. Quota policy (BUILD-11): `next` calls `quota.policy({claude, codex, coordinator, driveAlive})` once and applies its verdict without re-deriving it (8.1): `handoff` if Claude is at the handoff threshold, the coordinator is `claude-session` and the drive standby is alive (`build/drive/standby.json` pid alive, `state: standby`), else `paused-quota`; the terminal `paused-quota` when both companies are at the stop threshold. A unit with `parked:"built_on_assumption"` is dispatchable (base = its assumption branch).
4. Deferred reviews first, when the other company is below the stop threshold.
5. Planner round over `queued` units: tests units before their build units; one `audit` unit when `risk.audit` is true and none ran; units with `pending_answer` last on the default when the question is reversible, parked when not.
6. Admission per candidate (8.2) and one token per unit.
7. Dispatch.

```json
{"ok":true,"cmd":"next","epoch":4,
 "action":"dispatch|wait|handoff|land|done|paused-quota|waiting-owner|deadlock|stop",
 "units":[{"unit":"u-build-wo-05-002","kind":"docs|tests|build|patch|review|audit|doubt-consult|deferred-review","attempt":1,
   "token":"<opaque, returned once>","runtime":"claude|codex","model":"sonnet|opus|sol|astra (session units: the session model)","model_slug":null,"effort":"low|medium|high|xhigh|null",
   "budget_calls":null,"worktree":"<abs>","brief_path":"<abs>","report_path":"<abs>","schema_path":"<abs>",
   "agent_type":"pandacorp:implementer|pandacorp:reviewer|pandacorp:test-writer|pandacorp:security-auditor|general-purpose",
   "via":"agent|cli|session","dispatch_line":"→ Codex gpt-6.1-sol · high · revisa FRD-05"}],
 "wait":{"reason":"disk|ram|cpu_H|workers_running|jobs_running|gate|quota","retry_after_s":30},
 "admit":{"decision":"grant|wait","motivo_limite":"ancho"},
 "quota":{"claude":{"pct":36,"state":"known"},"codex":{"pct":98,"state":"known"}},
 "notes_es":[]}
```

Field notes:
- `units` is non-empty only for `action:"dispatch"`; `wait` only for `action:"wait"`. `notes_es` carries owner-facing Spanish lines for the session to relay when relevant.
- Unit kinds are exactly `docs`, `tests`, `build`, `patch`, `review`, `audit`, `doubt-consult`, `deferred-review`. The planning unit is `docs` with size feature or giant; an escalation is `build` or `patch` with `attempt:3`.
- `token` is the unit's admission token, returned once; the session passes it back verbatim in `report`, `review-record` and (for `via:"agent"` consults) `doubt answer`. `state.units[].token_hash` stores its `sha256`.
- `model` is the **resolved** routing cell as a catalog key (`haiku`, `sonnet`, `opus`, `luna`, `sol`, `astra`; `terra` and `fable` are never emitted, nor `max` effort; the routing table test asserts it over all inputs). The session passes `model` and `effort` as-is to the agent call. `model_slug` (for example `gpt-6.1-sol`) is set only for `via:"cli"` units, where the CLI passes it to `codex-worker --codex-model`. Routing data lives in `plugin/runtime/model-tiers.json` (version 2) and policy in BUILD-10; this file does not restate them.
- `via:"agent"`: the session dispatches the unit with its own agent tool. `via:"cli"`: the CLI already launched the unit (a Codex worker through `codex-worker.mjs run --direct`, or the `PANDACORP_FAKE_WORKER`); the session only waits and calls `next` again. `via:"session"`: the coordinator writes the touch unit itself in the unit worktree and files it with `report`.
- `via:"session"` is emitted iff size `touch`, kind `build`, attempt 1, static zone `none`, and the label's company equals the coordinator's company; its cell is `{runtime: coordinator runtime, model: --session-model, effort: null}` (routing treats a null session effort as `high`). `budget_calls` is 10 for a touch `review`, otherwise `null`.
- For a `doubt-consult` unit with `via:"agent"`, `agent_type` is `general-purpose` and its `schema_path` is the empty string (the answer keys are the ones of 3.12, not a JSON Schema file). A `doubt-consult` unit is the one and only dispatch channel of a doubt consult (3.12).
- `dispatch_line` is the one-line Spanish announcement the session prints.
- `action:"handoff"` is returned only when the coordinator is `claude-session` and the Claude reading is at or above the handoff threshold (BUILD-11); enforced here, not in prose.
- `action:"land"`: the batch is complete; the session calls `land` (3.11).
- Terminal actions are returned only when no unit, job or worker of the run is running (otherwise `wait`). Selection, first match: both companies at the stop threshold → `paused-quota`; 3 consecutive `env-infra` hand-backs → `stop`; every unit `landed`, `blocked` or (review-type) `verified` → `done` (the session calls `finish`); nothing can progress and every blocked unit waits on an owner answer or a gate → `waiting-owner` (`state.status` `waiting_gate` when all blockers are gates, else `waiting_owner`); queued units but no planner progress → `deadlock`; any other no-progress state → `stop`. Non-`done` terminal actions arrive already applied: status and reason set, journaled, quiesced and released with `projectStatus:false` (nothing runs, so no worker is stopped); the drive standby exits.
- `next` never returns a unit outside the run scope (test-asserted).
- `--wait` returns early when a report or review file appears, a job or worker `exit` appears, an `answer_recorded` is journaled, or `handoff.json` appears.
- `wait.reason`: `disk` (new-worktree admission or bootstrap exit 4; retry after 30 s), `ram` (admission denied), `cpu_H` (heavy slots taken), `workers_running` (CLI-launched workers pending), `jobs_running` (G2 or land job pending), `gate`, `quota`.

### 4.1 Integration inside `next`

`integrate.mjs` integrates every committed chain into `lane/<run_id>/integration`: rebase the unit branch onto the integration tip, fast-forward, journal `integrated` (an already-integrated unit returns `outcome: already`; a chain that conflicts returns outcome `conflict`, reason `rebase_conflict`, stays `committed` and `next` hands it back), commit WO `IN_REVIEW` on the integration branch (`transitionWorkOrderAt`) and append `track.jsonl` lines there. When all units of an FRD are integrated, a G2 job is spawned: G2 (a detached job in its own snapshot worktree `build/g2/<frd>-<sha>`, created with `git worktree add --detach` at the integration tip `<sha>`; `.pandacorp/worktree-bootstrap.sh` runs inside the job under the H slot, and bootstrap exit 4 maps to reserved job exit 76 (`wait disk`, no verdict, patch or attempt), while other bootstrap failures map to exit 75: an `env-infra` hand-back of the FRD's first integrated unit, no verdict and no patch; it runs `bash .pandacorp/verify.sh --since <integration base sha>`; the `gate` event carries `sha`; the verdict is stale, journaled `stale:true`, re-run at the tip and queuing no patch, only when an integrated unit of that FRD has an `integrated` sha that is not an ancestor of `<sha>`, merges of other FRDs never invalidate it; the snapshot is removed at harvest; nested projects use the product root `<snapshot>/<prefix>`); a red G2 uses the selective attribution and fallback contract of 3.11; a green G2 schedules the FRD's review unit. A patch after a review moves the WO `IN_REVIEW -> PLANNED -> IN_PROGRESS` (bumps `reopen_count`). Integration never touches `main`.

**Integration worktree bootstrap.** `integrate.bootstrapIntegrationWorktree` runs `bash .pandacorp/worktree-bootstrap.sh` in the product root of the integration worktree (10 min timeout, `PANDACORP_OWNER_RELEASE_OK` removed from the child env; no script means `ran:false`). It is called after every `git worktree add` of `createIntegrationWorktree` (never fails `start`), at the beginning of each active `next` before harvesting or integration, and again when landing is considered. Each call resolves the nested product root through the repository prefix; a successful marker makes later calls no-ops. An early exit 4 returns `wait disk` before harvesting. A success writes the untracked marker `build/integration-bootstrap.json` `{run_id, root, ok, exit, at, tail}`; the same run and root are not bootstrapped again. A non-zero exit, timeout or spawn failure never throws and writes the marker with `ok:false`. Exit 4 is a disk wait: no hand-back, attempt or gate verdict, retry when capacity returns. Other
failures in `next` mean: no `land` action, no land job, no G3 verdict, no patch; the first ready unit of the batch (an FRD work unit by preference) is handed back with cause `env-infra` (it and its dependents `blocked`, R4), `next` returns `wait` with reason `gate`, `retry_after_s` 60, and the next landing attempt re-runs the bootstrap; the 3rd consecutive `env-infra` hand-back stops the run (`env_infra_handbacks`). The non-disk contract matches the G2 snapshot (exit 75; disk uses 76): an environment failure is never a code verdict. A G2 snapshot's manifest in `<main checkout>/.pandacorp/run/worktrees/` is dropped with the snapshot (`integrate.dropBootstrapManifests`, also on `removeWorktree`). Eligible snapshots are removed at harvest, after a failed spawn, on terminal actions, `stop`, `finish` and `resume` (`next.removeAllG2Snapshots`); protected copies remain (5.1). `parkIrreversiblePending` journals `parked` followed by `unit_state queued -> parked`, so `rebuild-state` keeps those units parked.

## 5. On-disk state

Everything below is under the gitignored `.pandacorp/run/` of the project unless it says host or integration worktree.

| File | Writer | Notes |
|---|---|---|
| `build.lease/lease.json` (existing) | `build-state.mjs` only | mkdir lease + born-with-owner mutex `lease-mutation.lock` (`owner.json` is written in a private `.new-*` dir that is renamed into place, so the lock never exists without its owner; reclaimed at once when the owner is dead (pid gone or reused after the lock); live holders are never reclaimed and overdue holders are reported in `CONTENDED.holder {pid,ageMs}` after 60 s; only ownerless legacy locks use the 60 s age rule; one reclaimer per judged owner record via `.stale-<hash>` (first 32 sha256 hex characters), with stable-inode identity only for ownerless locks, so a second reclaimer's rename fails; `.new-/.done-/.stale-` litter older than 10 min is removed by the next holder); atomic JSON; v2: `ttl_seconds` 1800, optional `coordinator: session\|drive`, never projects `status.yaml` |
| `lease-epoch` (existing) | `build-state.mjs` | monotonic epoch |
| `build/lease-token.json` | `acquire`, `transfer` | `{epoch, token}`, mode 0600, never printed |
| `build/state.json` | CLI (two-phase) | section 6; honest cache, frontmatter wins |
| `build/journal.jsonl` | the epoch holder (actor `cli` or `drive`) | section 7; a terminal run's `build/` moves to `build-archive/<run_id>/` at the next `start --run` |
| `build/preflight.json` | `start --preflight` | mode 0600; reused by `start --run` when at most 15 minutes old |
| `build/wt/<unit id>[-a<n>]`, `build/wt/assume-<doubt>` | `units.mjs`, `integrate.mjs` | unit worktrees and assumption-branch worktrees (registered git worktrees; the unit id `assume-*` is reserved so the names cannot collide) |
| `.pandacorp/run/scope.json` | session | verbatim `scope` of `start --detect`; input of `--preflight`/`--run` |
| `build/units/<unit>/{doubt.json,answer.json}`, `build/doubts/<id>.sources.json` | session | doubt transport (3.12) |
| `.pandacorp/run/build-archive/<run_id>/`, `.pandacorp/run/build-suspended/<run_id>/` | `lifecycle.mjs` | terminal / suspended run metadata only (3.3, 3.4); worktrees reclaimed, never moved |
| `build/units/<unit>/{brief.md,report.json,review.json}` | brief: CLI; report and review: worker or session (file) | read-only after ingest; validated against schema; token must match |
| `build/g2/<frd>-<sha>/` | `next` | detached G2 snapshot worktrees (one per G2 job), removed at harvest and by `removeAllG2Snapshots` (4.1) |
| `build/integration-bootstrap.json` | `integrate.mjs` | untracked marker `{run_id, root, ok, exit, at, tail}` of the integration worktree bootstrap (4.1) |
| `build/jobs/<job_id>/{cmd.json,out.log,exit}` | `jobs.mjs` and its Node wrapper (`node jobs.mjs --wrap <jobDir>`) | detached `g2` and `land` jobs; `worker` jobs have no directory here (their dir is `codex-workers/<worker_id>/`) |
| `.pandacorp/run/codex-workers/<worker_id>/` | `codex-worker.mjs` (layout unchanged) | linked from `state.units[].worker.worker_id`; its result is the sealed JSON line printed by `codex-worker.mjs run`/`read`, not the process exit code |
| `build/handoff.json` | `handoff`; consumed by drive | atomic; consumed by rename to `handoff.consumed-<epoch>.json`; `schemas/handoff.schema.json` |
| `build/drive/{standby.json,drive.log,caffeinate.pid}` | drive / `start` | `standby.json {pid,armed_at,run_id,state:standby\|active\|stopped}`; log rotates at 5 MB |
| `build/quota.json` | `quota record/read` | `schemas/quota.schema.json` (8.1) |
| `build/admission.json` | `start` initializes, `next` samples/issues tokens; ingest releases | `{tokens{<sha256>:{unit,class,reserved_gib,at}},history[3],ladder{step,start_step,allow8,changed_at,entry_swap_mb,entry_A_gib,history,motivo,scale_event?},disk_waiting?}`; no `l4_since` |
| `build/perf-samples.jsonl`, `build/perf-meta.json` | `perf.mjs`, called by `next` | last 2000 readings plus whole-run extrema/time totals (8.4) |
| host `perf/journal.jsonl` | `perf.mjs`, lifecycle/terminal/failure callers | schema `perf-record`, one append per run identity; outside every repository (8.4) |
| `build/units/<patch>/gate-failure.json` | fenced G2/G3 harvest | schema `gate-failure`; diagnostic evidence and selective attribution (3.11) |
| `build/handback/engine-backlog-<run>.md` | `failure/engineBacklog.mjs` | untracked nested/factory-root failure draft, never an automatic factory BL write (5.2) |
| `.pandacorp/inbox/decisions.pending.md` (main checkout) | `doubts/integrationLog.mjs`, `answers/io.mjs` | checked-untracked projection of a tracked canonical inbox; entries and resolutions mirrored |
| `build/doubts/<id>.json` | `doubts.mjs`, `answers.mjs` | `schemas/doubt.schema.json` |
| `build/handback/<unit>.md`, `build/handback/engine.md` | `failure.mjs`, `handback` | handback format (BUILD-15) |
| `deferred-reviews.json` (outlives runs) | `review.mjs`, `deferred.mjs`; written only inside a run | `schemas/deferred-reviews.schema.json` |
| integration worktree `.pandacorp/run/build/integration` on `lane/<run_id>/integration` | CLI commits | every tracked write of the engine |
| host `~/.pandacorp/host/h-slots/slot-<i>/owner.json` | the `g2` job wrapper, `merge-queue.sh` | mkdir + pid + dead-owner reclaim (a stale or released slot is removed by an atomic `rename` to a unique tomb, then `rm`: only one racer wins, so a slot a faster waiter just re-took is never deleted); host-wide heavy-tool semaphore, max `max(1, min(2, floor(ncpu/4)))`; protocol: `mkdir slot-<i>` in index order, `owner.json {pid, kind: g2\|merge-queue, project, at}`, reclaim when the pid fails `kill -0` or `owner.json` is missing and the dir is older than 60 s, release = `rm -rf`, waiters poll every 5 s |

Host paths resolve through `PANDACORP_HOST_DIR`.

**One path to `main`, one writer.** In the main checkout the v2 engine never writes a git-tracked file. It writes only gitignored paths (`.pandacorp/run/**`, `.pandacorp/inbox/**`, `.pandacorp/comms/**`) and git refs/worktrees. Before writing any path there it checks `git ls-files --error-unmatch <path>`: a tracked path (for example Mission Control's force-tracked `.pandacorp/inbox/decisions.md`) is written in the integration worktree instead and committed there. Every tracked write is a CLI commit on `lane/<run_id>/integration`:
- docs-before (`Change-Docs: <slug>`) and project `docs/decision-log.md` "Decidido sin el owner" entries;
- WO frontmatter transitions: `IN_PROGRESS` at dispatch, `IN_REVIEW` after integration, `PLANNED` (patch path `IN_REVIEW -> PLANNED -> IN_PROGRESS`), `BLOCKED` with `blocked_reason`; and FRD/blueprint/status rollups;
- `track.jsonl` lines (section 10);
- the landing metadata commit (3.11): WO `VERIFIED`, `status.yaml` `last_green_sha`, `safe_to_test`, `phase`, trailer `Change:`.
The only path to `main` is `land` running `merge-queue.sh` from the integration worktree. In a launched project `merge-queue.sh` stops at exit 21 and `main` waits for the owner's order. Consequence: Mission Control sees a v2 run through the lease and the events; WO columns, `phase` and `last_green_sha` change on `main` at landing (BUILD-7, BUILD-13).

### 5.1 Worktree lifecycle and safety (BUILD-5/BUILD-15)

- At landing reclaim eligible unit/assumption checkouts; at attempt n+1 reclaim eligible older
  attempts. At finish, stop, engine failure or blocked cleanup, reclaim eligible integration,
  unit/assumption and G2 copies. Branch refs, journal/reports and pending owner data survive.
  `waiting_gate` retains integration; `.next` is removed only after the shared safety check.
- Resume recreates absent checkouts from retained branches, then applies the existing
  same-attempt resets in 3.4. Metadata archive/suspend first reclaims checkouts, refuses protected
  registered leftovers and never moves worktrees. Start rollback keeps its integration branch.
- `integrate/worktrees.mjs removeWorktree` first calls the shared `engineWorktreeOwnershipReason`:
  the run id, branch and exact canonical checkout path must agree. Detached unit/integration
  checkouts remain protected; a detached G2 checkout requires a matching path/HEAD pin reachable
  from this run's integration ref. It then calls `worktreeRemovalReason`; force cannot bypass
  either predicate. Holds include main/self, symlink paths, locks, live process cwd, dirty/hidden
  changes and owner state. Shared `runningWorktreePaths` protects running/admitted units and
  running jobs until a positive recorded PID is proven dead, independently of coordinator status;
  an absent/null PID is not proof of termination.
  Hidden bootstrap differences need path/worktree-identity-bound generated-file hashes, not just
  skip-worktree or assume-unchanged flags; later edits invalidate provenance. Legitimate missing
  cone-sparse files are recognized. Unreadable safety checks preserve the checkout.
- Session cleanup/sweep only reclaim eligible engine roots in `build/{wt,g2,integration}` and
  `build-archive/<run>/...` (plus the legacy registered lane/gate roots). Any held lease or live
  build protects them; suspended/`waiting_gate` runs remain protected. Retry, lifecycle cleanup
  and sweep share the same run/branch/exact-path ownership predicate and worker protections.
  Sweep also protects deployed checkouts. Missing-target bootstrap manifests are pruned,
  without deleting protected state directories.

Verification: `plugin/scripts/test-build-v2-disk.mjs`, `test-build-v2-land.mjs`,
`test-build-v2-integrate.mjs`, `test-build-v2-cli.mjs`, `test-worktree-sweep.mjs`,
`test-session-cleanup.mjs`, `test-session-cleanup-adversarial.mjs`.

**Sparse docs (DEC-17).** Only build/patch/tests unit checkouts qualify. Cone mode keeps all source
and the unit FRD folders, `docs/rules`, `docs/design` and `docs/product` root files. Existing brief
context (including FRD/FDD/blueprint, WO, tokens, architecture and DESIGN) is checked before/after
sparsifying; `verify.sh --light` must succeed. Any error disables sparse checkout; restoration
failure refuses dispatch. Integration, G2/G3, docs, review and audit stay full. The accepted
repo config is `extensions.worktreeConfig=true`; sparse settings stay per worktree.
Verification: `plugin/scripts/test-build-v2-disk.mjs`.

**Bootstrap and G3 caches.** An unchanged installed lock hash skips installation. Otherwise
bootstrap checks target-volume capacity (shell constants in BUILD-15; exit 4), tries
`pnpm install --offline --frozen-lockfile`, then `--prefer-offline --frozen-lockfile`, then plain
install only if the lock differs from main. `node_modules` stays local, using shared-store APFS
clones rather than a symlink; `.next` stays local. A volume delta above 15% of `du node_modules`
warns of copying. After full G3, the queue releases its H slot before deleting `.next`,
`.next-fidelity` and `test-results`, on green and red. Verification:
`plugin/scripts/test-worktree-bootstrap.sh`, `test-merge-queue-lock-refresh.sh`,
`test-merge-queue-certified-tree.sh`, `test-merge-queue-release-gate.sh`.

### 5.2 Engine-failure drafts for nested projects (DEC-14/DEC-16)

`fileBacklogNote` detects a project root below repository top or a factory root equal to repo top.
It checks `.pandacorp/run/build/handback/engine-backlog-<run>.md` untracked and writes a local draft,
returning `{draft:true,id:null,file,reason}`. No `factory/backlog` main-checkout file is written.
The `engine_failure` event carries `backlog_draft`; `summary.need_from_owner` and the Spanish
report list it for later factory triage. Standalone projects keep the normal numbered BL behavior;
an unavailable factory returns `{id:null,file:null,reason}`. Performance closure happens outside
the lease mutex. Verification: `plugin/scripts/test-build-v2-nested.mjs`,
`test-build-v2-failure.mjs`, `test-build-v2-perf.mjs`.

## 6. `state.json` (schema `schemas/state.schema.json`, `schema: 2`)

```
{schema:2, engine:"v2", run_id, epoch,
 coordinator:"claude-session|codex-session|drive",
 label:"claude|codex", size:"touch|feature|giant",
 status:"active|paused|waiting_owner|waiting_gate|finished|stopped", status_reason:string|null,
 tranche:{index,of}|null,
 scope:{card|null, frds[], wos[], out_of_scope[]},   // with card set the run builds wos plus the WOs whose source_change names the card; frds is descriptive; the FRD-wide rule (empty wos, listed frds) applies only when card is null

 integration:{branch, worktree, base_sha},
 last_safe_point:{sha, kind:"wo-commit|integration-land|review-record|batch-landed", at}|null,
 units:[{id, kind:"docs|tests|build|patch|review|audit|doubt-consult|deferred-review",
         wos[], frd, chain, doubt_id|null,
         zone:"none|floor|r1", risk_rules[],
         state:"queued|admitted|running|reported|committed|integrated|reviewing|patching|verified|landed|parked|waiting_gate|blocked",
         attempt:1..3, token_hash|null,
         test_hashes:{<path>:<sha256>}, probe_hashes:{<path>:<sha256>},
         worker:{runtime, model, effort|null, via:"agent|cli|session", pid|null, worker_id|null}|null,
         worktree|null, branch|null, depends_on[],
         pending_answer:<question_id>|null,
         assumed_on?:<doubt id>,   // optional, absent when unused (never null): the unit was built on this open assumption and then parked on a SECOND doubt
         parked:"owner_question|built_on_assumption|no_reviewer"|null,
         waiting_gate:"production|money|delete|external"|null,
         evidence_hash|null,
         review:{verdict:"pass|reopen|blocked|doubt", reviewer{runtime,model,effort}, degraded|null, deferred_id|null}|null}],
 jobs:[{id, kind:"g2|land|worker", unit|null, frd|null, pid|null, cwd, h_slot, started_at, state:"running|done|dead", exit|null, worker_id|null}],
 handbacks_in_a_row, doubts_consulted,
 answers:{<question_id>: <value>},
 quota_at_unit:{<unit>:{start:{}, end:{}}}}
```

- Model names in `worker`, `reviewer` and every author field are **catalog keys** (`haiku|sonnet|opus|fable|luna|terra|sol|astra`); only `next` units with `via:"cli"` and `codex-worker --codex-model` carry a slug.
- `last_safe_point`, `worker`, `worktree`, `branch`, `token_hash`, `review`, `doubt_id` are `null` until set (worker, worktree and branch at dispatch).
- `jobs[]`: `unit` for worker jobs, `frd` for `g2` jobs; job dir = `build/jobs/<id>/` (`g2`, `land`) or `codex-workers/<worker_id>/` (`worker`); `h_slot` is true only for `g2`. There is no `budget` field (deferred). `handbacks_in_a_row` counts consecutive `env-infra` hand-backs (reset by any other hand-back or a committed unit). Unit states and transitions: build plan §3.16 A13 (owning modules enforce them; `state.mjs` validates enums only).
- `state.json` is an honest cache. On any disagreement the WO frontmatter wins; `rebuild-state` (3.22) regenerates it. A schema-version mismatch is exit 5 with `"hint":"rebuild-state"`.
- The author of a unit is its dispatch cell (`unit_dispatched.data.cell`); a report's `authored_by` is informational.

## 7. Journal (`build/journal.jsonl`, schema `schemas/journal-event.schema.json`)

One journal per run. Line: `{"v":1,"seq":n,"at":"<iso>","run_id":"...","epoch":n,"actor":"cli|drive","type":"...","data":{},"prev":"<hex>"|null}`. The first line has `seq:1` and `prev:null`; `prev` is the lowercase hex sha256 of the previous line's UTF-8 bytes without its trailing `\n`. `seq` is gap-free; `journal.mjs` verifies the chain on read (a broken chain is exit 5).

Types: `run_started` (carries the detect and preflight result), `run_resumed {from}`, `unblocked {unit,cause,attempt,reason,units}` (3.14b; resets `handbacks_in_a_row`), `run_stopped {reason}`, `run_finished`, `unit_queued`, `unit_state {unit,from,to}`, `admit`, `unit_dispatched {cell}`, `job_started`, `job_finished`, `report_received {test_hashes?}`, `wo_committed`, `gate {tier,exit,unit|frd}`, `integrated`, `review_recorded`, `patch`, `escalated`, `handback`, `safe_point {kind,sha}`, `batch_landed {sha}`, `pin_stale`, `quota_reading`, `doubt_opened`, `doubt_consulted`, `autonomous_decision`, `answer_recorded`, `parked`, `waiting_gate`, `handoff_requested`, `drive_armed`, `drive_takeover`, `deferred_review_queued`, `deferred_review_done`, `engine_failure`, `paused {reason}`. (`escalated` is written by the CLI's automatic attempt 3; there is no command behind it.)

Event data needed by `rebuild-state`: `run_started.data = {detect, preflight, state}` (initial state, `units: []`); `unit_queued.data` = the full state unit; `unit_state.data = {unit, from, to}`; `unit_dispatched.data = {unit, cell, via, worktree, branch, token_hash, worker_id, pid}`; `job_started.data` = the `jobs[]` item; `job_finished.data = {id, state, exit}`; `report_received.data = {unit, outcome, commit, test_hashes}`; `integrated.data = {unit, sha}`; `parked.data = {unit, reason, question}`; `waiting_gate.data = {unit, kind}`. `rebuild-state` folds them in order, then applies the integration worktree's WO frontmatter (frontmatter wins). `admit` events are written by `next` only.

`review_recorded.data = {unit, frd, verdict:"pass|reopen|blocked|doubt", reviewer{runtime,model,effort}, authors[{runtime,model,effort}], cross:bool, degraded:"quota_90|unreachable|at_capacity|same_model"|null, findings{critical,high,medium,low}, pair_id|null}`.

**Journal append lock (FIX-MUTEX3).** `journal.mjs` appends under `<journal>.lock`, born with
its `owner` file (pid/nonce) through a private `.new-*` rename and released by renaming away.
Dead means pid gone or reused by a process started after the judged lock; live holders are never
reclaimed. After 30 s an overdue live holder appears in `CONTENDED.holder {pid,ageMs}`. Only an
ownerless legacy lock is age-reclaimed after 30 s (lease mutex: 60 s). A single reclaimer wins via
`<journal>.lock.dead-<hash>` (lease: `.stale-<hash>`), the first 32 hex characters of sha256 of the
exact judged owner text. Ownerless identity uses a stable inode before/after reading. The liveness
stat follows the owner read; process start checks have a one-second margin. A reclaimer stalled
past the age bound re-judges. Litter older than 10 min is swept by the next holder. A hung live
holder blocks until it exits; mixed plugin versions and legacy empty locks remain unsupported
race boundaries. Verification: `plugin/scripts/test-build-v2-lock-stress.mjs`,
`test-build-state.mjs`, `test-build-state-handoff.mjs`.

`answer_recorded.data = {question, kind:"ask|parked|gate", value, units[{unit, effect}]}`. `admit` events carry the admission fields (signals, decision, `motivo_limite`, `techo`, `suelo`, `A_ef`, `P`, `unit`; never the token); `admit` goes to the journal and the events ndjson, not to `track.jsonl`.

## 8. Module APIs referenced by the commands

Internal contracts (modules call each other; the CLI exposes them through section 3). Constants and thresholds are defined in the Constants table of `factory/standards/build-engine.md` and in `model-tiers.json` (version 2); this file names the parameters only.

### 8.1 Quota (`quota.mjs`)

```
readCodexQuota({codexHome, now})
  -> {provider:"codex", used_percent, window_minutes, resets_at, credits, observed_at, file, state:"known", source}
   | {provider:"codex", state:"unknown", reason}
  newest rollout by mtime under sessions/YYYY/MM/DD (newest dirs first, <= 3 days), tail read <= 256 KiB,
  last event_msg/token_count.rate_limits;
  used_percent = max(primary, secondary when present), window_minutes = that window's,
  resets_at converted from epoch seconds to an ISO-8601 string; never scan the whole sessions tree
recordClaude({five_hour_pct, weekly_pct, five_hour_resets_at, weekly_resets_at, status}, {now, file}) -> reading
  (persists quota.json at `file`; journals quota_reading only with an epoch)
effective(reading, now) -> {pct|null, state:"known|unknown", needs_probe:bool}
  claude: known iff age <= claude_reading_max_age_s; codex: known until resets_at;
  needs_probe iff age > codex_probe_age_s and pct >= codex_probe_min_pct
probeCodex({exec}) -> minimal codex exec (~20k input tokens), preflight only, then readCodexQuota
classifyLimitText(text) -> "usage_limit" | "rate_limit" | null
  the single detector; limit patterns are self-contained and aligned with codex-worker.mjs LIMIT_RE
policy({claude, codex, coordinator, driveAlive = false, now?, thresholds?}, deps?)
  -> {claude_new_units, codex_new_units, handoff, paused, degrade_reviews_of:{claude_authored, codex_authored}}
  the ONLY owner of the pause/handoff priority (A11): both providers >= quota_stop -> paused, never handoff;
  Claude known and >= quota_handoff with a claude-session coordinator -> handoff only when driveAlive, else paused;
  codex-session and drive coordinators never hand off. driveAlive = build/drive/standby.json pid alive and state "standby"
```

Limit handling (BUILD-11): a `usage_limit` consumes no attempt and is recorded as a 100 % reading for that provider (`source:"limit"`); a Claude limit with a Claude coordinator means `handoff`; a Codex limit means new units take the Claude column; both at or above the stop threshold means `paused-quota`. A `rate_limit` (429) consumes no attempt: retry once after 60 s, then reduce the reactive parallelism by one. The lease is released only by `finish`, `stop`, an engine failure and `next`'s terminal pauses, never by a single-provider limit or a handoff.

`quota.json` uses `schemas/quota.schema.json`: `{schema:1, claude: null | {provider:"claude", five_hour_pct|null, weekly_pct|null, five_hour_resets_at|null, weekly_resets_at|null, status:"ok|unavailable", observed_at}, codex: null | {provider:"codex", used_percent, window_minutes, resets_at, credits, observed_at, file, state:"known", source:"rollout|probe|limit"} | {provider:"codex", state:"unknown", reason}}`. `quota read` prints the same `claude` and `codex` objects plus the derived `policy` (never stored). Thresholds (stop, handoff, probe age, probe minimum, reading max age, lease ttl, drive silent seconds, drive trigger (c) minimum percent, drive poll seconds) are the `thresholds` object of `model-tiers.json` version 2; their meaning is BUILD-11 and BUILD-14.

### 8.2 Admission (`admission.mjs`)

```text
readSignals({exec, signalsFile, readFile})
  -> {L:1|2|4, swapouts, swap_used_mb, A_gib, A_cons_gib}; invalid parse throws SignalError
initializeAdmission({step, allow8}, {file,...}) -> ladder
recordReading(signals, {file,...}) -> ladder plus history (once per next call)
readAdaptive({file}) -> persisted ladder, or initialLadder()
readHistory({file}) -> latest three readings
admission/ladder.mjs initialLadder({step?, allow8?, at?}) -> adaptive state
admission/ladder.mjs advanceLadder(previous, signals, at) -> {step,start_step,allow8,changed_at,entry_swap_mb,
  entry_A_gib,history,motivo,scale_event:{from,to,reason,at}|null}
decide({signals, reservations, live:{B,H,R?}, heavyQueued, readyWidth, step,
  caps:{kOwner,kReactive,kReactiveReason,colchonGib}, want?,candidate?,nowMs?,ncpu?})
  -> {grant:"B"|"H"|null,motivo_limite,step,techo,suelo,A_ef,P,veto:null,h_max,safe_mode}
readDiskFreeGib(project, deps?) -> project-volume free GiB (statfsSync)
diskDecision({project,freeGib?,needsWorktree:true}, deps?)
  -> {ok,disk_free_gib,motivo_limite:null|"disco"}
recordDiskWait(blocked, {file,...}) -> true only for a new blocked episode's notification
countHostSlots({dir}).held -> live.H
acquireHostSlot({dir,max}) -> {slot,release()}; waitHostSlot({...timeoutMs})
issueToken(unit,class) / verifyToken(unit,token) / releaseToken(unit)
```

Step policy, learned start, cooldowns and disk thresholds live in BUILD-9. There is no zero-ceiling
critical-pressure mode or memory-pressure terminal pause (DEC-15). `runtimeShape` labels dispatch transport;
it no longer imposes a special serial B ceiling on Codex. RAM reservations estimate H only; B uses
the persisted step, ready width, owner cap and reactive cap. Disk admission applies to new unit/G2
copies, with per-round reservation; bootstrap disk refusal also returns `wait/disk` (4.1).
Verification: `plugin/scripts/test-build-v2-admission.mjs`, `test-build-v2-next.mjs`,
`test-build-v2-disk.mjs`, `test-build-v2-cli.mjs`.

`motivo_limite` remains the closed interface enum `ancho`, `ram`, `ram_reservada_H`,
`veto_presion`, `veto_swap`, `cpu_H`, `techo`, `owner_k`, `reactivo_contencion`, `reactivo_codex`,
`cupo_limite`, `senal_fallida`, `disco`, `sin_token`; legacy veto names are accepted interface values,
not a separate builder veto. Ladder `motivo` is separate: `techo`, `senal_fallida`,
`presion_critica`, `swapouts`, `swap_growth` or `estable`. No calibration file or `calibrate`
command exists. Host slots resolve under `PANDACORP_HOST_DIR` or `~/.pandacorp/host/h-slots`.
Verification: `plugin/scripts/test-build-v2-admission.mjs`, `test-build-v2-perf.mjs`.

### 8.3 Routing (`routing.mjs`)

Pure functions over `model-tiers.json` version 2 (builder rows match on `kind` plus `size`, `zone`, `reopen_count_min`, `attempt`, `bounded`). Signatures:

```
builderCell(unit, {label, zone, reopen_count, attempt, previousCell, quota, shape, coordinator, sessionModel})
  -> {runtime, model, effort, via, row, switched, bumped}      // reopen_count = max over the chain's WOs
   | {deferred:{runtime,model,effort}, degraded, row} | {paused:"quota", row}
reviewCell({authors[], kind, zone, availability{claude, codex: ok|quota|unreachable|at_capacity}, shape})
  -> {primary{runtime,model,effort}, used{runtime,model,effort}|null,
      degraded:null|"quota_90|unreachable|at_capacity|same_model",
      deferred:{needed:"claude|codex", reviewer{}}|null, parked:null|"no_reviewer", row}
consultCell({origin, consultNo, consulted?[], availability?}) -> {runtime, model, effort} | null   // null = no consult left, the doubt parks
```

`routing.mjs` exports `MODEL_STRENGTH` (frozen: `haiku 1, luna 1, sonnet 2, sol 2, terra 2, opus 3, astra 3, fable 4`), the single strength table: `review/degradation.mjs` (the "strongest author" helper behind the review matrix) and `drive/audit.mjs` (the audit deferral) import it; no module keeps a private copy. A repeated execution raises effort one step (cap `xhigh`) and never switches company; only the quota switch of BUILD-11 (or an unreachable label company) changes company (the other company's column of the same builder row). The cells, the 16-row review matrix and the unreachable and same-model rules are policy (BUILD-10) and are generated from the data file; a table test pins them. `start` checks Codex slugs against `codex debug models` and fails loud when a catalog slug is retired.

### 8.4 Performance (`perf.mjs`, DEC-18)

`startRecommendation()` reads the last five host records and returns `{step,allow8}`. Start policy
is BUILD-9; invalid recommendation data fails loud. `initializePerformance` writes run metadata,
`recordSample` writes capped readings, and `finishPerformance({project,state,outcome?})` attempts
a serialized, schema-validated host append outside the lease mutex. It deduplicates by
`run_id + project + start`; telemetry errors return `{ok:false,error}` without failing lifecycle.
Verification: `plugin/scripts/test-build-v2-perf.mjs`, `test-build-v2-cli.mjs`.

Files and exact shapes:

- `build/perf-samples.jsonl`: `{t,step,live_b,live_h,L,swap_used_mb,A_gib,disk_free_gib,motivo}`;
  last 2000 samples. `build/perf-meta.json` retains whole-run extrema, step seconds/counts and
  scale events even after older samples leave the file.
- `<host>/perf/journal.jsonl` (`schemas/perf-record.schema.json`):
  `{run_id,project,plugin_version,start,end,outcome,units_by_kind,workers_over_time,ram_gib,
  swap_mb,scale_events,start_step,sustained_step,recommended_start,disk_free_gib}`.
  `project` is basename only; `units_by_kind[kind]={count,p50_s,p90_s}`;
  `workers_over_time` has at most 200 `{t,step,live_b,live_h}` points;
  `ram_gib={min,max}`, `swap_mb={start,peak,end}`, `disk_free_gib={start,end}`;
  `scale_events[]` are `{at,from,to,reason}`. Measurements may be null when unavailable.

Lifecycle/terminal/failure callers close performance at finish, stop, engine failure and
`waiting_gate`. `status`/`summary` expose `{step,motivo}`, and `build.scaled` publishes
`{from,to,reason}`. Machine-specific hardware descriptions belong in personal configuration. Verification:
`plugin/scripts/test-build-v2-perf.mjs`, `test-build-v2-nested.mjs`,
`test-build-v2-telemetry.mjs`.

## 9. `drive` relay

Behavior and its limits are BUILD-14; the contract:

| Aspect | Contract |
|---|---|
| Arm | `start --run` (and `start --resume`) arms drive whenever `codex login status` is OK and, in a launched project, the pre-push hook is verified (`install-pre-push.mjs --check` exit 0). Codex quota is not checked at arming. It spawns `node pandacorp-build.mjs drive --standby --run R` with `spawn(execPath, args, {detached:true, stdio:["ignore",log,log]}).unref()` (no `setsid` on macOS); drive starts `caffeinate -i -w <own pid>` |
| Never armed when | launched project without a verified pre-push hook; `codex login status` fails |
| Standby poll (30 s) | (a) `build/handoff.json` present; (b) Claude's usage-limit text only (DEC-3): `classifyLimitText` = `usage_limit` in `build/units/<id>/report.json` of a unit in `admitted|running` dispatched to Claude (`via: agent|session`), or Claude's envelope (`usage limit reached|<epoch>`) in `codex-workers/<id>/last.md` of a worker of the current run (`state.units[].worker.worker_id` / `state.jobs[].worker_id`), or the optional `--transcript <path>`; Codex's own limit text never fires (b) (`quota.policy` owns that, R3); (c) no lease renewal for `drive_silent_s` AND pending work AND last Claude reading at or above the trigger percent or unknown. Standby exits when `state.status != "active"` |
| Takeover | at a trigger drive re-reads Codex quota. At or above the stop threshold: `transfer`, then stop at `paused-quota` with both `resets_at` (the lease is released). Otherwise `transfer({token: <current token from lease-token.json>, toRuntime:"codex", coordinator:"drive"})` (semantics in 2.3): epoch+1 on the same `run_id`, new token file, lease `coordinator:"drive"`; journal `drive_takeover`; notification. It does not quiesce, does not stop running Codex workers and never calls Claude. It is not a `--takeover` (no owner confirmation) |
| Loop | in-process `next` with coordinator `drive` (all builders Codex, reviews per the drive rule of BUILD-10) then `workers.mjs` launch, poll `exit` files every 30 s, then `report`/`review-record`/`land`; drive renews the lease in its own loop. Drive never spawns a landing while a land job is alive |
| Stops | Codex at or above the stop threshold: `paused-quota` at a safe point; engine failure: exit 8 path; all done: `finish` |
| Return | the owner's `start --resume` transfers the run back immediately (epoch+1); drive gets exit 3 at its next phase 2 and exits. There is no yield file |
| Security audit | not run under drive; queued in `deferred-reviews.json` for Claude opus high (an audit unit that reaches drive is deferred and set `verified` so the run can finish; author = the strongest recorded worker cell, else `{codex, sol, high}`; DEC-4) |
| Doubts | the sources step is skipped; consult Astra high; then park |
| Human gates | `waiting_gate`; `osascript` notification (`notify.mjs`); never sets `PANDACORP_OWNER_RELEASE_OK` |
| Log | `build/drive/drive.log` (rotating at 5 MB) |
| Test-only | `--handoff-after N` |

Fenced helpers in `plugin/runtime/build-state.mjs` for this relay and for resume: `transfer(project, {token, toRuntime, coordinator})` (fresh or stale lease, same `run_id`, epoch+1, new token file, no quiesce, no Codex-worker kill, no status projection), `forceRelease(project, {ownerConfirmed:true})` (for `stop --dead`, requires `isReclaimable`), `transitionWorkOrderAt(root, {file, to, reason})` (the pure file transform plus rollups of `transitionWorkOrder`, rooted in the integration worktree, the caller fences), and the `projectStatus:false` option on `acquire`, `quiesce` and `renew`. There is no `arm-handoff` and no handoff secret. `transfer` and `force-release` are in `fenced_cli.fenced_commands` of `plugin/runtime/enforcement-policy.json`.

## 10. Telemetry to Mission Control

- `status.yaml` is never written on `main` by the v2 engine. `last_green_sha`, `safe_to_test` and `phase` arrive with the landing metadata commit (3.11). Liveness is the lease (`ttl_seconds` 1800, renewed per coordinator command); Mission Control must see a valid lease JSON (`renewed_at` ISO, `ttl_seconds` > 0) or none.
- Events, through `event-transport.mjs createRuntimeEventEmitter`, always with `project = basename(project root)` (the emitter's runtime is the coordinator's company):
  - existing: `BuildLaunch`, `AgentWorking`, `AgentDone` (`role, model, unit, result: green|red`), `wo_commit` (legacy name; emitted by `report.mjs`), `GateVerdict{frd, verdict: PASS|FAIL}`, `BuildComplete`, `BuildStopped`, `worker_started`, `worker_stopped` (from `codex-worker`). There is no `build_usable`;
  - new vocabulary (registered in `plugin/runtime/event-vocabulary.json`): `review.recorded` (`ReviewRecorded`), `quota.reading` (`QuotaReading`), `engine.failure` (`EngineFailure`), `autonomous.decision` (`AutonomousDecision`), `build.handoff` (`BuildHandoff`), `build.waiting-gate` (`WaitingGate`), `unit.parked` (`UnitParked`), `admit.decision` (`AdmitDecision`), `build.scaled` (`BuildScaled`, `{from,to,reason}`).
- `track.jsonl` (written only on the integration branch, one writer, committed with integration commits). Line shapes read by Mission Control:
  - `{"kind":"wo_start","frd":"...","wo":"...","at":"<iso>"}`
  - `{"kind":"wo_end","frd":"...","wo":"...","at":"<iso>","state":"in_review|verified|failed"}`
  - `{"kind":"review_start","frd":"...","at":"<iso>"}`
  - `{"kind":"review_end","frd":"...","at":"<iso>","verdict":"pass|reject"}`
  - `{"kind":"frd_end","frd":"...","at":"<iso>"}`
- Branches: integration `lane/<run_id>/integration`, units `lane/<run_id>/<unit>[-a<n>]`, assumption `lane/<run_id>/assume-<doubt>` (Mission Control classifies `lane/` as engine-origin). Work orders keep the existing `implementation_status` values only (`PLANNED`, `IN_PROGRESS`, `IN_REVIEW`, `VERIFIED`, `BLOCKED`); card statuses keep the existing enum (no new token such as `parked`).
- Contract with Mission Control and the verification suites: `build-engine.md` ("Mission Control telemetry contract").

## 11. Worker contract

The same brief text is used for a Claude `Agent` dispatch and for `codex-worker --direct`; only the transport differs. Workers never commit: the CLI commits with the trailers of 3.9.

### 11.1 Brief template (`units/<unit>/brief.md`, written by `units.mjs`)

```markdown
# Unit <unit>: <kind>

## 1. Role
Act as `<agent_type>` (read `<factory>/plugin/agents/<name>.md` for the role rules). Runtime: <runtime>, model <model>, effort <effort>.

## 2. Unit
- id: <unit>
- kind: <docs|tests|build|patch|review|audit|doubt-consult|deferred-review>
- work orders: <wo ids>
- FRD: <frd id>
- attempt: <1..3>
- risk zone: <none|floor|r1> (rules: <R..>)

## 3. Scope
Dentro (verbatim from the card):
<card Dentro lines>

Fuera (verbatim from the card):
<card Fuera lines>

Owned acceptance criteria (verbatim):
<AC lines owned by this unit>

Write allowlist (`artifacts`): <paths / globs>

Forbidden paths (never touch): `**/*-snapshots/**`, the frontmatter of every work order, hashed test files, anything listed in Fuera.

## 4. Context pack
<absolute paths to the FRD, blueprint, work order(s), design tokens, rules, prior review findings, probe files (read-only)>

## 5. Working directory and git
Work only in: <absolute worktree path>
Never run `git commit`, `git push`, `git reset`, `git checkout`, `git stash` or `git add -A`. The engine commits.
Never set `PANDACORP_OWNER_RELEASE_OK`.

## 6. Verification
Run, in this order, one heavy tool at a time, at most 3 fix cycles:
<static commands>
<vitest related command for the changed files>
Record each command's exit code and the output tail in the report.

## 7. Doubts
Never ask the owner. If a decision needed to proceed is not answered by the documents, stop and return `status:"doubt"` with `question`, `options`, `preferred` and `why`.

## 8. Output
Write a JSON object valid against `<schema_path>` to `<report_path>`, and print the same JSON as your final message.

## 9. Identity
unit: <unit>
token: <token>
(copy both verbatim into the report)
```

Variants:
- A `review`, `deferred-review` or `audit` brief replaces sections 5 to 8 with the review inputs (diff range, worktree for probes, scope lens: a `scope` finding when the diff touches Fuera, report path `review.json`, schema `review-report.schema.json`).
- A `tests` brief adds "RED-first acceptance tests: each new test must fail by assertion, never by an import or syntax error; touch no production code". The report carries no hashes; the CLI computes them.
- A `doubt-consult` brief carries the doubt object and asks for `{decision, rationale, confidence, reversible}` (3.12); it says to check the sources first when the sources step was skipped.
- The brief never contains the lease token, only the unit token.

### 11.2 Report out (`schemas/report.schema.json`; all keys required, for Codex `--output-schema` strictness)

```json
{"schema":1,"unit":"u-build-wo-05-002","token":"<verbatim>","status":"done|blocked|doubt|failed",
 "summary":"...","files":["src/a.ts"],
 "verification":[{"command":"pnpm tsc","exit_code":0,"tail":"..."}],
 "pending":[],
 "doubt":{"question":"...","options":[{"id":"a","text":"..."}],"preferred":"a","why":"..."},
 "diagnosis":{"cause":"code|test-defective|spec-ambiguous|env-infra|dependency","detail":"..."},
 "gate":{"kind":"money|delete|external","detail":"..."},
 "authored_by":{"runtime":"claude","model":"sonnet","effort":"medium"}}
```

`doubt`, `diagnosis` and `gate` are `null` when not applicable (keys are still present). `authored_by.runtime` is `claude|codex` and `model` is a catalog key; it is informational (the author of record is the dispatch cell). The CLI trusts nothing in the report (3.9).

### 11.3 Review out (`schemas/review-report.schema.json`)

```json
{"schema":1,"unit":"u-review-frd-05","token":"<verbatim>",
 "reviewer":{"runtime":"codex","model":"sol","effort":"high"},
 "verdict":"pass|reopen|blocked|doubt",
 "findings":[{"id":"F1","severity":"critical|high|medium|low",
              "lens":"correctness|security|quality|runtime|scope",
              "file":"src/a.ts","line":42,"summary":"...","probe":"tests/probe-a.test.ts"}],
 "probes":[{"path":"tests/probe-a.test.ts","failed_first":true}],
 "traceability":[{"contract":"AC-05-002.1","contract_class":"acceptance-criterion","status":"pass","tests":["tests/a.test.ts"]}],
 "doubt":null}
```

`line` and `probe` may be `null`. The CLI hashes probe files itself; the review report carries no hashes. `traceability` items are `{contract, contract_class: requirement|acceptance-criterion|invariant|edge-case|limit|error|exclusion, status: pass|fail|not-applicable, tests[]}`. A finding with `lens:"scope"` means the diff touches Fuera. `probes[].failed_first` records that the probe failed against the pre-fix code; `verdict:"blocked"` hands the reviewed units back with the finding as reason.

### 11.4 Doubt consult answer

A `doubt-consult` worker writes the keys of the `answer.json` of 3.12 (`decision`, `rationale`, `confidence`, `reversible`) to its `report_path`; the session (or the CLI for `via:"cli"`) completes it with `consulted` and files it with `doubt answer`.

### 11.5 Codex worker (`codex-worker.mjs run --direct`)

Direct mode prints one sealed JSON line `{status:'done', ok, kind, answer|text, detail, limit, model, effort}`; the process exit code is never the result. A detached `watch` watchdog ends a hung worker: `--start-hang-s N` (no Codex output within N s, default 120), `--stall-s N` (no output for N s, default 1200) and `--cap-s N` (wall-clock cap, default 7200); each also reads `PANDACORP_CODEX_START_HANG_S`, `PANDACORP_CODEX_STALL_S`, `PANDACORP_CODEX_CAP_S` when the flag is absent. A watchdog stop writes `watchdog.json` and the result `kind` is `start-hang`, `stall` or `cap`. Other error kinds: `limit` (carries `limit: "usage_limit"|"rate_limit"`), `error`, `bad-answer` (final message is not one JSON object), `prompt-mismatch` (the prompt file differs from the sealed copy). `next` treats `worker_error` and watchdog ends as `env-infra`. The prompt copies (`prompt.md`, `full-prompt.md`) are written with mode 0600 (a pre-existing relay-copied one is chmodded), since a prompt may carry a lease token. Every worker process the engine spawns (`workers.mjs` `workerEnv`, `codex-worker.mjs` child and watcher, the detached `drive` CLI) has `PANDACORP_OWNER_RELEASE_OK` removed from its environment, like `units.mjs`, `integrate.mjs` and `land.mjs` do for their children.

`workers.mjs` launches it as `run --direct --project <dir> --id <worker id> --unit <unit id> --prompt-file <abs> --codex-model <slug> --effort <low|medium|high|xhigh> [--output-schema <abs>] --dir <unit worktree> --access sandbox --writable-dir <build/units/<unit>/> --max <seconds>`. `--writable-dir` (repeatable, sandbox access only, absolute, existing, never containing the project or the work dir, never inside `.git`) becomes `codex exec --add-dir`: the unit's own directory holds `report_path`, outside the worktree, so the workspace-write sandbox must be allowed to write it (BL-0313); `.git` stays read-only. Worker id: `w-<run id>-<unit id>[-a<n>][-d<dispatch>]` (`-a<n>` from attempt 2; `-d<dispatch>` is the first 8 hex digits of the dispatch's admission token hash (`dispatchOf`), so two dispatches of one attempt never share a sealed result; at most 120 characters). `pollWorker` returns `{state:"running"|"done"|"error", workerId, ...}`; when `done`, `outcome` is one of `report` (valid report), `bad_report` (kinds `bad_answer`, `no_answer`, `schema`), `text`, `limit` (`usage_limit`/`rate_limit`), `watchdog`, `worker_error`, `failed`; `state:"error"` covers unreadable or unsealed reads (`read_timeout`, `read_failed`, `bad_seal_*`).

## 12. Pre-push hook and installer

- Template: `plugin/templates/shared/.pandacorp/hooks/pre-push` (POSIX `sh`, `set -u`). The installed hook is **untracked by design** (one path to `main`: the engine commits nothing on `main`): `install-pre-push.mjs` writes a configured copy of the template, carrying the marker `# pandacorp-pre-push v2`, into `git rev-parse --git-path hooks` (which honors worktrees and `core.hooksPath`). There is no tracked `.pandacorp/hooks/pre-push` copy in a project. An existing foreign `pre-push` is renamed `pre-push.pandacorp-chained` and called by the installed hook.
- Logic: read stdin lines `<local_ref> <local_sha> <remote_ref> <remote_sha>`. The default branch is `git symbolic-ref --short refs/remotes/<remote>/HEAD` with the remote prefix stripped, falling back to `main`. A project is *launched* when `phase: release` AND NOT `deploy_target: internal` (same expression as `merge-queue.sh:157-158`). If launched and any `remote_ref == refs/heads/<default>` (push or delete) and `PANDACORP_OWNER_RELEASE_OK` is not `1`: print an English reason plus a Spanish line on stderr and exit 1. An unreadable `status.yaml` with a push to the default branch: exit 1 (fail closed). Everything else exits 0.
- Nested projects: the shared hook retains each registered repository-relative project root. Only default-branch updates touching that subtree apply its status/gate; incoming commits (including reverts/merge parents), new-ref history, deletion trees and rewinds are checked. State is resolved under the default-branch worktree, falling back to the pushing worktree. Unavailable history fails closed. Factory-only changes need no factory-root status. Exact contract and overlay tracking inventory: [nested-projects.md](nested-projects.md).
- The flag `PANDACORP_OWNER_RELEASE_OK=1` is not a secret: it stops an unprompted push, not a deliberate bypass. Briefs forbid setting it; only the owner's chat order sets it.
- Installer: `node plugin/scripts/install-pre-push.mjs --project <dir> [--check]`. If `core.hooksPath` points inside the work tree (a tracked directory, for example husky) the installer refuses (exit 3; ANY `core.hooksPath` inside the work tree is refused, not only a tracked one) and the preflight asks the owner. Idempotent. Exit codes: 0 installed or current, 1 missing or stale (`--check` only), 2 not a git repository, 3 in-tree `core.hooksPath`, 4 the hooks directory is not writable (install mode only), 64 bad arguments. Exits 1 to 4 mean the hook is not verified, so `drive` is not armed. A project without `.pandacorp/` is not a Pandacorp project: the push is allowed; with `.pandacorp/` present and an unreadable `status.yaml` the hook fails closed.
- Who installs (the preflight only checks): `start --run` in a launched project before its first v2 run; `/pandacorp:upgrade` in every project from 10.0.0 (it is a no-op until the project is launched). `drive` is never armed in a launched project without a verified hook. Rule: BUILD-13 and DR-138 (`main` is the only production branch).

## 13. Files the CLI depends on, outside `plugin/runtime/build/`

| Path | Role |
|---|---|
| `plugin/scripts/codex-worker.mjs` | gains `--direct` (CLI-written prompt, no transcript recovery), `--codex-model <catalog slug>`, `--output-schema <path>`, watchdogs (start-hang, stall, wall-clock cap); its layout `.pandacorp/run/codex-workers/<worker_id>/` and the v1 relay path are unchanged. `run` waits up to `--max` and then prints `CODEX-RUNNING`; the CLI polls with `read` or the `exit` file |
| `plugin/templates/shared/.pandacorp/merge-queue.sh` | refreshes `$LOCK` mtime every 60 s while the gate runs; takes a host H slot around `verify.sh`; exit codes unchanged (map in 3.11) |
| `plugin/runtime/build-state.mjs`, `plugin/scripts/pandacorp-build-state.mjs`, `plugin/runtime/build-state.schema.json`, `plugin/runtime/build-state-contract.md` | the exports of section 9; the lease gains an optional `coordinator`; v1 behavior unchanged |
| `plugin/runtime/enforcement-policy.json` | `transfer` and `force-release` listed as fenced commands |
| `plugin/runtime/event-vocabulary.json` | event names of section 10 |
| `plugin/scripts/product-floor.mjs`, `plugin/scripts/classify-change.mjs` | risk inputs (import and `execFile` respectively) |
| `plugin/runtime/event-transport.mjs`, `plugin/runtime/model-tiers.json` | events and routing data |

## 14. How to read the rest of the contract

| Question | Where |
|---|---|
| What counts as done, the gates G0 to G4, routing matrices, autonomy ladder, human gates, failure policy | `factory/standards/build-engine.md` |
| Every numeric constant (quota, admission, caps, lease ttl, poll, sizes) | the Constants table of `factory/standards/build-engine.md` |
| What the session does between calls | `plugin/skills/implement/references/{engine-v2.md,autonomy.md,drive.md}` |
| JSON shapes in machine form | `plugin/runtime/build/schemas/*.schema.json` |
| Routing data | `plugin/runtime/model-tiers.json` (version 2) |
| Lease and fencing semantics (v1 base) | `plugin/runtime/build-state-contract.md` |
| Runtime portability of the CLI and `drive` | `factory/standards/agent-portability.md` (PORT-1, PORT-5) |
