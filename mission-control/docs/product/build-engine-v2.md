# Build engine v2: Mission Control read contract

Effective with plugin 10.0.0, 2026-11-12. This is the shared input contract for FRD-02, 04, 05, 06, 08, 11, 12 and 21. It specifies the Mission Control changes to implement; it is not evidence that those changes have shipped. Existing `implementation_status` stamps record earlier deliveries and do not certify these new criteria.

## Evidence boundary

Producer facts below were inspected at factory commit **540afa2c**. Paths in this table are relative to the factory repository. Consumer presentation and reconciliation rules are requirements of the amended FRDs, not additional fields emitted by the engine.

| Producer at 540afa2c | Observed contract |
|---|---|
| `plugin/runtime/build/detect.mjs`, `preflight/scope.mjs` | Seven-row scope detection; explicit FRD/card targets; `--resume`; ignored legacy mode words; no work-order-id target parser. |
| `plugin/runtime/build/paths.mjs` | Per-project build files, host performance journal, event transports and `lane/<run_id>/…` branches. |
| `plugin/runtime/build/schemas/state.schema.json` | State schema 2, run status, scope, integration branch, units and jobs. |
| `plugin/runtime/build/lifecycle/status.mjs`, `summary.mjs` | Lease-based live status, units by state, open questions, admission step/reason, parked units and waiting gates. |
| `plugin/runtime/build/admission/{tokens,ladder,disk,constants}.mjs`, `next/step.mjs` | Persisted ladder, disk wait, resource sampling and `build.scaled` emission. |
| `plugin/runtime/build/doubts/integrationLog.mjs`, `answers/io.mjs` | Tracked decisions written on integration; untracked pending mirror on main; answers mark both copies. |
| `plugin/runtime/build/perf.mjs`, `schemas/perf-record.schema.json` | Machine-local run performance records and their exact fields. |
| `plugin/runtime/build/telemetry.mjs`, `plugin/runtime/event-vocabulary.json` | Runtime event transport, registered semantic names and integration-only track writes. |
| `plugin/runtime/build/failure/engineBacklog.mjs` | Nested engine-failure draft in the project's untracked handback directory. |
| `plugin/scripts/{session-cleanup,worktree-sweep}.mjs`, `plugin/runtime/build/lifecycle/{terminate,buildDir}.mjs` | Safe finished-run sweep; lifecycle at this commit still retains/moves registered worktrees. |

Two Day 1 dependencies are intentionally distinguished from that snapshot: immediate worktree removal at landing/close is DENG's pending change; adding the nested engine-failure draft to `summary.need_from_owner` is PATCH2's pending change. The reader must tolerate both retained and removed worktrees, and must not assume the missing summary entry already exists at 540afa2c.

## Copy-only entry and scope

| Owner intent | Command copied by Mission Control |
|---|---|
| Build the pending plan / let the session detect context | `/pandacorp:implement` |
| Resume the existing run | `/pandacorp:implement --resume` |
| Build a named FRD's pending work | `/pandacorp:implement FRD-04` |
| Build a named card | `/pandacorp:implement change:<id>` |

The UI labels are **Construir**, **Reanudar**, **Objetivo: FRD o tarjeta**. No mode, power meter, subscription-plan promise, `v2` opt-in word or automatic queue-drain promise is generated. `change:<id>` is a card-reference syntax, not a separate command. A draft must be completed/validated by the session; a stale-suspect card is routed to reconciliation, not offered as pending construction. A building v2 card resumes its run; closing/done/discarded cards are not new build targets. A work-order detail links to its FRD target, explaining that the FRD's pending scope is selected; it must not invent `/pandacorp:implement WO-…` support.

“Anótalo” means a draft in `.pandacorp/inbox/changes/` plus `node <plugin>/scripts/pandacorp-build.mjs card check <path>` by the session. Mission Control does not create, validate, dispatch or drain cards. Internal bug/iteration/version planning engines are not advertised as alternative product-build entry points. Other lifecycle commands, including release and decide, retain their own gates.

## Read-only run model

Read under the selected project's root, never under a client-supplied arbitrary path:

| Input | Public fields used |
|---|---|
| `.pandacorp/run/build.lease/lease.json` | `run_id`, `epoch`, `renewed_at`, `ttl_seconds`, and release/quiescence state according to the lease library. |
| `.pandacorp/run/build/state.json` | `schema: 2`, `engine: v2`, `run_id`, `epoch`, `coordinator`, `label`, `size`, `status`, `status_reason`, `tranche`, `scope`, `integration.branch`, `last_safe_point`; `units[].{id,kind,wos,frd,state,attempt,worker,branch,depends_on,pending_answer,parked,waiting_gate}`; public job state. |
| `.pandacorp/run/build/admission.json` | `ladder.{step,motivo,changed_at}`, `disk_waiting`; resource history only as needed for freshness. No token data is sent to the browser. |
| `.pandacorp/inbox/decisions.md` and `decisions.pending.md` | Pending/resolved decision text and explicit engine `Id` when present. The mirror is needed when the canonical inbox is tracked. |

The run statuses are `active`, `paused`, `waiting_owner`, `waiting_gate`, `finished`, `stopped`. Unit states are `queued`, `admitted`, `running`, `reported`, `committed`, `integrated`, `reviewing`, `patching`, `verified`, `landed`, `parked`, `waiting_gate`, `blocked`. Keep unit states distinct from the five work-order frontmatter statuses. Do not turn a parked question or production gate into a crash or completed task.

All consumers (board activity dot, portfolio, Inicio, Resumen, snapshot, Fragua and work-order views) use one shared run/liveness resolver. A valid, unreleased, unquiesced lease renewed within its `ttl_seconds` is the execution signal; the current default is 1800 seconds. A v2 run may be live with `running` absent or false on main. A fresh matching lease with `status: active` enables live cues; terminal, paused or waiting run status is shown explicitly. An expired active lease shows **Sin señal**, not a busy animation. A crashed coordinator can look live until its lease expires. Legacy flag/heartbeat/event fallback applies only where no v2 run/lease is present, never to revive a terminal or malformed v2 run.

Tracked phase, work-order files, `last_green_sha`, `safe_to_test` and `track.jsonl` on main advance at landing. `state.json` is an engine-owned cache of in-flight work, not a replacement for durable frontmatter. During a matching active run the shared display model overlays only WOs named by build/patch units, labels the result **En el build**, and retains the durable value separately. Running/admitted work displays in progress; reported/committed/integrated/reviewing/verified work displays as review pending landing; queued/patching work displays planned; blocked work displays blocked; landed work displays verified. For repeated work, the latest relevant patch/attempt supersedes the earlier build. Parked/waiting-gate states keep their last durable column with an explicit reason. A unit with several WOs affects each named WO once; reviews, jobs and consultations never manufacture WOs. `verified` on a branch must not imply delivered on main or a safe-to-test snapshot. Unaffected verified WOs stay verified. FRD bars, station tokens and counts consume this same model.

The **Build en curso** panel shows run id/status, units grouped by state, live LLM unit count, current concurrency step/reason, disk wait, open questions and waiting-gate kind. Display public worker model/runtime only if present. Step is a ceiling, not the count of running agents: the ladder is 1/2/3/5/8, starts at 5 without history, decreases under pressure and can recover; critical pressure chooses 1, never 0. Disk wait does not stop existing work. Use `disk_waiting` to display **disco** as the effective admission reason; otherwise use `ladder.motivo`. Machine constants are generic; the owner's machine specification is not product copy.

Merge decisions by explicit engine `Id`, preserving it verbatim in `/pandacorp:decide <id>`; legacy entries retain FRD-24's shared heading-id derivation. Deduplicate a canonical/mirror copy before computing pending badges. A resolved mirror must suppress its stale pending counterpart until landing. A missing mirror is normal; a malformed/unreadable present file is a visible source error. The local nested draft `.pandacorp/run/build/handback/engine-backlog-<run>.md` is an engine-failure handback, not an already-filed factory BL item.

Refresh when run/admission/decision files change, even with no newer event, including backwards transitions; retain FRD-25 navigation-safe coalescing. Missing optional files produce **Sin build** / **Sin datos aún**, not an exception. Invalid schema, contradictory run/epoch, unreadable or malformed present inputs produce a path-and-reason notice; valid siblings and durable documents remain usable. Do not overlay a mismatched run. State/admission freshness is shown separately from event time; `state.json` has no `updated_at` field, so use its observed mtime. Admission freshness can use `ladder.changed_at` only as the step-change time, not as a periodic heartbeat. Never expose lease secrets, admission token hashes, `lease-token.json` or arbitrary file contents.

## Performance

Read `~/.pandacorp/host/perf/journal.jsonl` server-side (or the configured `PANDACORP_HOST_DIR/perf/journal.jsonl`). This is separate from the project's hash-chained build journal. Select records by the producer's project **basename**, then run id/start; the schema carries no absolute project identity, so two same-basename projects cannot be distinguished reliably. State that limitation rather than attributing one project's samples to another with certainty.

Use the schema fields verbatim: `run_id`, `project`, `plugin_version`, `start`, `end`, `outcome`, `units_by_kind` (`count`, `p50_s`, `p90_s`), `workers_over_time` (`t`, `step`, `live_b`, `live_h`), `ram_gib` (`min`, `max`), `swap_mb` (`start`, `peak`, `end`), `scale_events` (`at`, `from`, `to`, `reason`), `start_step`, `sustained_step`, `recommended_start`, `disk_free_gib` (`start`, `end`). `ram_gib` measures **available** memory; `live_b` counts admitted/running LLM units, not only builders. Null metrics are **Sin datos**, never zero. This mini-view is retrospective; an unfinished run need not have a journal record. Sampled worker points are not a full trace. Missing journal is empty history; malformed lines are reported and valid lines retained. Read a bounded tail, keep machine readings outside git and never write or calibrate from the dashboard.

## Events and branches

Read the coordinator's transport (`~/.claude/dashboard-events.ndjson` or `~/.codex/dashboard-events.ndjson`, honoring configured paths) through the shared event vocabulary, with project filtering before the tail cap. `build.scaled` carries `{from,to,reason}` and has `BuildScaled` / `build_scaled` aliases. Also recognize `review.recorded`, `quota.reading`, `engine.failure`, `autonomous.decision`, `build.handoff`, `build.waiting-gate`, `unit.parked`, `admit.decision` and the `wo_commit` alias of `wo.commit`. Events are best-effort observations, not state authority. Missing `build_usable` is normal: v2 does not emit it. The outer event envelope belongs to the shared transport, not a second MC-specific schema.

Integration is `lane/<run_id>/integration`; unit attempts are `lane/<run_id>/<unit>` then `…/<unit>-a<n>` for attempts 2/3; assumptions are `lane/<run_id>/assume-<doubt>`. Classify all as engine-origin independently of whether a worktree exists. Pending work comes from commits outside main; leftover worktree count comes separately from `git worktree list`, excluding locked worktrees. Neither a missing worktree nor a retained branch proves a merge. With Day 1 cleanup, finished run directories can disappear while their branch refs remain. Protect live, suspended, waiting-gate, dirty, locked and process-cwd worktrees; the dashboard only copies `/pandacorp:worktrees` and performs no removal.

## Manual ownership

The Manual explains the CLI as the common executor, local runtime coordination, the drive relay and its observed automation limits; one writer and epoch fencing; scope-first building without queue drain; cross-company review; the three build/patch-execution budget; selective red-gate repair; parked questions; human gates and the one path to main. No default old executor, static build modes, machine model, heartbeat process or automatic production approval is promised. Retired agents must disappear from derived catalogs and the authored team roster. `AGENTS.md` is the instructions source; `CLAUDE.md` is the one-line import shim. Bespoke pages keep their Markdown index stubs (FRD-08 REQ-08-018); other pages own their prose. Update both authored TSX and Markdown-only pages, diagrams and command examples, with reference catalogs still derived from canonical files. Workflows retained for factory backlog must be explicitly scoped to that separate executor.


## Integration handoff for PLAN-E2

| Batch | Owning requirements / checks |
|---|---|
| MC-CMD | FRD-02 REQ-02-017, FRD-04 REQ-04-006/019 and FRD-11 REQ-11-007 to -010. Exact commands, draft/stale/building targets, no individual-WO parser, old mode preference ignored. |
| MC-STATE-A | FRD-04 REQ-04-017/018/021/022, FRD-05 REQ-05-009, FRD-06 REQ-06-021, FRD-12 REQ-12-007/008, FRD-21 REQ-21-009; explicit engine IDs also amend FRD-24. |
| MC-STATE-B | FRD-04 REQ-04-020/023, shared live/durable scene, waiting-gate/parked questions and retrospective performance mini-view. |
| MC-MAN-TSX / MC-MAN-MD | FRD-08 REQ-08-013/014/019/021. Full content/diagram truth, one authored owner per page, current roster and catalogs. |
| DENG / PATCH2 | Verify immediate cleanup before claiming removal shipped; wire nested handback draft into need_from_owner. Neither was complete at 540afa2c. |
| RX2 | Record the Day 1 MC contract change in the area decision log; no log, registry, machine profile or version is written by MCD. |

Suggested decision-log entry for the integrator (English): **2026-11-12 — Specify Mission Control's Day 1 build surface.** Replace power modes with build/resume/FRD-or-card commands; define a shared lease/run reader, live-versus-landed progress, tracked-inbox mirroring, local performance history, engine branch visibility and full Manual truth. Source evidence is engine 540afa2c; the documents distinguish pending cleanup and nested-handback wiring from observed producer behavior. Canonical changes: this contract, the PRD/architecture and FRD-02/03/04/05/06/08/11/12/18/21/24. Existing VERIFIED metadata remains historical and does not self-certify the amended criteria.
