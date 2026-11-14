# Shared capacity policy — phase 3

The build engine, direct/alias worker launcher and image launcher use the shared allocator.
`build/quota.mjs` preserves its public API as a compatibility adapter; local quota files are projections.
Role and deterministic risk choose a cell, independent of author and attempt. One exhausted tool means
use the other qualified tool; only neither fitting parks capacity, persisting `resumeAt` in run state and journal.
Never ask the owner about quota. Review independence is a fresh context, including on the same model.

## Independent review fixes on phase-3 HEAD (2026-11-14)

Reviewed baseline: `2b92b55e` (`feat/capacity-allocator`), including phase 3; comparison main: `bc923770`.
All seven blockers in `review-p2.md` remained reproducible on that HEAD. Phase 3 had already fixed
post-launch suspension, token/session/dirty-tree retention and reset/wake fencing (the existing
`test-capacity-resume.mjs` passes), but had not removed the pre-candidate veto, consultation conversion,
prelaunch-result loss, transport watchdog, quota takeover, standalone risk default or normative drift.
No commit, provider inference or real subscription query is part of this correction.

| Finding | State on HEAD → correction | Regression (`test-capacity-review.mjs`) |
|---|---|---|
| H1 global implementation veto | Reproduced → quota is observation only; schedule and wake actual eligible role/risk tasks; takeover cannot veto model-free closing | `H1: next dispatches design…`, `H1: explicit takeover…`, `H1 phase3: wake evaluates actual design…` |
| H2 consultation becomes an owner question/assumption | Reproduced → persist `capacity_wait` in the doubt without consuming a consult, retain it through scheduler retries and allocate the available alternative | `H2: capacity wait retains pending consult…` checks no inbox, park, assumption or budget charge, then successful scheduling |
| H3 prelaunch wait becomes worker death | Reproduced → private harvestable `capacity_wait` receipt; dispatch returns queued, releases admission, preserves attempt and emits no false account limit; restart harvest follows the same path | Both `H3` cases exercise real launch/read and dispatcher/harvest, including an audit unit |
| H4 active Claude worker killed | Reproduced → stream-json with partial messages; tee stdout into heartbeat/final stream; preserve provider exit code and parse only terminal result; monitor both transport files | `H4: Claude stdout progress…` runs beyond start-hang/stall thresholds with a fake provider |
| H5 quota handoff invalidates healthy native work | Reproduced → retire trigger b and reject stale direct b requests; authorized coordinator transfer preserves live/suspended cells, tokens, attempts and dirty trees | `H5: Claude quota never hands off…`; e2e B checks no quota transfer before a deliberate handoff |
| H6 security audit silently becomes Sol low | Reproduced → missing standalone risk stays fail-closed critical; security-auditor enforces critical even with normal input; incompatible legacy flags fail before provider launch | `H6: standalone security audit…` also checks unknown risk and explicit low-risk/model refusal |
| H7 conflicting policy and missing safeguards | Reproduced → restore Probes, Tests-first and Other safeguards verbatim from bc923770; preserve worker/session/recording contracts; update BUILD-12/14, terminal policy, constants, verification, registry and Manual | `H7: canonical non-routing safeguards…` plus independent document review |

The final regression file was also run unchanged against an archived `2b92b55e` snapshot, with the
original code, to verify RED evidence. All ten named cases fail there and pass with these fixes.

### Expectation migrations (no security, oracle, fencing or production weakening)

| Suite/fixture | Change and reason |
|---|---|
| `test-codex-worker.mjs` | Explicit fixture `--risk normal`; ordinary implementation requests/asserts Sol low under DR-162, replacing inherited medium effort. Mechanical fixtures declare `tier-mech` to retain Luna low: a legacy Haiku alias alone is no task classification. Tier-mapping helper checks remain unchanged. |
| `test-codex-worker-direct.mjs` | Explicit fixture risk; slug cases supply task type/risk (Astra: critical, Luna: mechanical, Sol: ordinary implementation). The existing unchanged slug assertions still prove actual argv. Catalog choice cannot silently lower security risk. |
| `test-build-v2-hardening.mjs` | The ordinary fake direct worker declares normal risk; its 0600 files and release-variable exclusion checks remain unchanged. Infra hand-back priority is enforced before terminal completion, preserving the pre-existing safety assertion. |
| `test-capacity.mjs` | Fallback fixture declares normal risk and emits the actual Claude stream-json result envelope; it still checks isolated fallback tool/model/effort and its two audit records. |
| `test-build-v2-{quota,conserve,next}.mjs` | Quota projection never globally pauses. Actual candidates are planned before waiting; no token is issued when no task fits. A healthy running worker stays active and is reported as workers_running. Lease, resumeAt, token and gate assertions remain. |
| `test-build-v2-routing.mjs` | Exhausted consultation returns an explicit wait and valid resumeAt instead of null. All 364 named cases, capability, purity, invalid-input and risk controls remain. |
| `test-build-v2-drive.mjs`, e2e B | Quota reports/transcripts cannot transfer a live lead; takeover leaves capacity to actual candidates. E2e finishes its fake native executions on their original cells/tokens before the explicit handoff, and retains crash/resume/fencing/landing checks. |

Standalone legacy `--codex-model`/`--effort` describe the task's qualified nominal Codex cell and are
validated, never silently substituted. A capacity fallback may execute the corresponding qualified
Claude cell. Engine callers use a validated `--capacity-task` pin; new standalone callers should supply
explicit task type/risk. Unknown risk and a security role never default to normal.

### Final verification and comparison

The table below is generated from observed per-suite logs for this correction, rather than the older
phase-2/phase-3 historical evidence later in this file. Every fixture/account/temp root is under the
owner's `scratchpad/tmp-p3fix/`; each suite has isolated `TMPDIR`, `PANDACORP_TEST_TMP`,
`PANDACORP_TEST_SCRATCH`, `PANDACORP_CAPACITY_DIR`, empty `CODEX_HOME` and host state. Two fixture
processes run concurrently. Main is an archived snapshot, not the mutable shared checkout.

Final worktree: **42 suites, 1628 passed, 0 failed**, all processes exit 0. Main: **39 suites, 1368 passed, 1 failed**. No new failure against main.

| Command (`node plugin/scripts/…`) | Fixed branch passed/failed | Main passed/failed |
|---|---:|---:|---:|
| `test-build-liveness.mjs` | 5/0 | 5/0 |
| `test-build-state-handoff.mjs` | 25/0 | 25/0 |
| `test-build-state.mjs` | 33/0 | 33/0 |
| `test-build-v2-admission.mjs` | 29/0 | 29/0 |
| `test-build-v2-answer.mjs` | 32/0 | 32/0 |
| `test-build-v2-cli.mjs` | 36/0 | 36/0 |
| `test-build-v2-conserve.mjs` | 13/0 | 12/0 |
| `test-build-v2-detect.mjs` | 46/0 | 46/0 |
| `test-build-v2-disk.mjs` | 26/0 | 26/0 |
| `test-build-v2-doubts.mjs` | 38/0 | 38/0 |
| `test-build-v2-drive.mjs` | 45/0 | 45/0 |
| `test-build-v2-e2e.mjs` | 107/0 | 111/1 |
| `test-build-v2-failure.mjs` | 32/0 | 32/0 |
| `test-build-v2-g2-leftover.mjs` | 5/0 | 5/0 |
| `test-build-v2-gate-patch.mjs` | 7/0 | 7/0 |
| `test-build-v2-hardening.mjs` | 38/0 | 38/0 |
| `test-build-v2-integrate.mjs` | 23/0 | 23/0 |
| `test-build-v2-jobs.mjs` | 13/0 | 13/0 |
| `test-build-v2-land.mjs` | 50/0 | 50/0 |
| `test-build-v2-lock-stress.mjs` | 3/0 | 3/0 |
| `test-build-v2-nested.mjs` | 9/0 | 9/0 |
| `test-build-v2-next.mjs` | 68/0 | 67/0 |
| `test-build-v2-perf.mjs` | 10/0 | 10/0 |
| `test-build-v2-planner.mjs` | 30/0 | 30/0 |
| `test-build-v2-preflight.mjs` | 26/0 | 26/0 |
| `test-build-v2-quota.mjs` | 35/0 | 35/0 |
| `test-build-v2-report.mjs` | 46/0 | 46/0 |
| `test-build-v2-review-pin.mjs` | 3/0 | 3/0 |
| `test-build-v2-review-r1.mjs` | 23/0 | 23/0 |
| `test-build-v2-review.mjs` | 59/0 | 57/0 |
| `test-build-v2-risk-backtest.mjs` | 28/0 | 28/0 |
| `test-build-v2-risk.mjs` | 30/0 | 30/0 |
| `test-build-v2-routing.mjs` | 364/0 | 174/0 |
| `test-build-v2-state.mjs` | 76/0 | 76/0 |
| `test-build-v2-telemetry.mjs` | 23/0 | 23/0 |
| `test-build-v2-unblock.mjs` | 13/0 | 13/0 |
| `test-build-v2-workers.mjs` | 16/0 | 16/0 |
| `test-capacity-resume.mjs` | 10/0 | absent |
| `test-capacity-review.mjs` | 10/0 | absent |
| `test-capacity.mjs` | 50/0 | absent |
| `test-codex-worker-direct.mjs` | 67/0 | 67/0 |
| `test-codex-worker.mjs` | 26/0 | 26/0 |

The owner-supplied main failure counts (CLI 1, disk 10, G2-leftover 5, hardening 2, integrate 2, land 2, next 1, report 1) did not reproduce under this isolated physical temp-root environment: those suites were green in both snapshots. The measured main-only e2e failure was scenario B, `kill -9 drive: process gone`; the fixed branch passed all 107 e2e assertions. These are observed results, not replacement allowances.

| Additional command/evidence | Result |
|---|---|
| Same final `test-capacity-review.mjs` on archived original HEAD | 0 passed / 10 failed (RED for every named case) |
| Original HEAD `test-codex-worker.mjs` / `test-codex-worker-direct.mjs` | 24/2 and 65/2 reproduced; fixed branch and main 26/0 and 67/0 |
| `node plugin/scripts/generate-plugin-manifests.mjs` | exit 0, source and both manifests 10.11.1 |
| `node --check` on changed `.mjs` plus new regression file | 25 files, exit 0 |
| `bash plugin/scripts/check-derived-drift.sh "$PWD"` | exit 0; only linked-worktree personal ledger existence is skipped by the existing gate |
| `git diff --check` | exit 0 |
| Independent document review | H7 approved; original non-routing safeguards retained, retired policy absent |

Limits: no real provider/authentication, native Agent timer, machine sleep or actual subscription-reset canary was run. Those are phase-4 qualification, outside this correction. No application runtime changed in Mission Control; only Manual explanatory text was aligned. No commit or installation update was made. The supplied worktree/branch is retained for the orchestrator.

### Files changed in this correction

- `factory/decision-log.md`
- `factory/decisions/registry.yaml`
- `factory/memory/_inbox.md` (gitignored; append-only lesson)
- `factory/standards/build-engine.md`
- `mission-control/content/manual/concepts/construccion-desatendida.md`
- `mission-control/content/manual/concepts/multi-runtime.md`
- `mission-control/docs/decision-log.md`
- `mission-control/src/app/manual/_components/DesatendidaDetail.tsx`
- `mission-control/src/app/manual/manualPages.tsx`
- `plugin/.claude-plugin/plugin.json`
- `plugin/.codex-plugin/plugin.json`
- `plugin/docs/capacity.md`
- `plugin/docs/decision-log.md`
- `plugin/runtime/build/doubts/advance.mjs`
- `plugin/runtime/build/doubts/consult.mjs`
- `plugin/runtime/build/drive/takeover.mjs`
- `plugin/runtime/build/drive/triggers.mjs`
- `plugin/runtime/build/next/candidates.mjs`
- `plugin/runtime/build/next/dispatch.mjs`
- `plugin/runtime/build/next/harvest.mjs`
- `plugin/runtime/build/next/step.mjs`
- `plugin/runtime/build/next/terminal.mjs`
- `plugin/runtime/build/quota.mjs`
- `plugin/runtime/build/routing.mjs`
- `plugin/runtime/build/schemas/doubt.schema.json`
- `plugin/runtime/build/workers.mjs`
- `plugin/runtime/capacity/scheduler.mjs`
- `plugin/runtime/plugin-metadata.json`
- `plugin/scripts/codex-worker.mjs`
- `plugin/scripts/test-build-v2-conserve.mjs`
- `plugin/scripts/test-build-v2-drive.mjs`
- `plugin/scripts/test-build-v2-e2e.mjs`
- `plugin/scripts/test-build-v2-hardening.mjs`
- `plugin/scripts/test-build-v2-next.mjs`
- `plugin/scripts/test-build-v2-quota.mjs`
- `plugin/scripts/test-build-v2-routing.mjs`
- `plugin/scripts/test-capacity-review.mjs`
- `plugin/scripts/test-capacity.mjs`
- `plugin/scripts/test-codex-worker-direct.mjs`
- `plugin/scripts/test-codex-worker.mjs`
- `plugin/skills/implement/references/drive.md`

## Account ingestion and audit

The account state lives in `~/.pandacorp/host/capacity/` (`PANDACORP_CAPACITY_DIR` in tests).
`ingest-claude` reads Desktop get_usage JSON from stdin, retaining/adding `observedAt`, and atomically
replaces `claude.json` using a unique exclusive temp, rename and mode 0600. Readers see complete snapshots
without a lock. `decide` reads that snapshot when `--claude-usage-stdin` is absent. Codex is read from rollouts;
legacy recordCodex observations and real limit receipts are reconciled by observation time. Limit receipts
retain known blocks until reset; after reset they remain unknown/pending until a newer observation,
without refreshing the recorded timestamp or exposing an older healthy balance.

Every dispatcher records JSONL with task, decision, reason and readings_used. Engine run path:
`.pandacorp/run/build/capacity-decisions.jsonl`; otherwise `<capacity-dir>/decisions.jsonl`.
The CLI accepts `--log` and launchers accept `PANDACORP_CAPACITY_LOG` for an explicit audit destination.
`type:image` is an alias of `images`. `codex-image.sh` exits 75 with the wait JSON including resumeAt.
Worker launches consult once before starting; repeated run/read calls retain their existing execution cell.
The launcher can execute an allocated Claude cell through the authenticated Claude CLI; engine-assigned
cells are passed as pins, preserving the execution's tool/model. Real CLI authentication and provider resets
are not certified by fixture tests. Phase 3 adds in-place continuation and fenced wake-up; concurrent-account reservations remain later work.

## Inputs and readings

Core exports have JSDoc contracts. The normalizers and `decide` require an injected `now` (ISO instant,
epoch milliseconds or Date); `decide()` remains pure; account helpers and rollout readers perform filesystem IO.

Claude accepts Desktop `get_usage` JSON: `{status?, observedAt?, plan:{windows:[{label,percentUsed,resetsAt}]}}`.
Labels are `5-hour limit`, `Weekly · all models`, and `Weekly · <model>` (also `5-hour limit · <model>`). A live handoff without `observedAt`
is dated at ingestion; cached callers must preserve the original timestamp. Node never calls get_usage.
Every model window restricts its matching cell, together with `all` windows. Fable never restricts other models.
Candidate freshness also considers only its applicable windows, so an expired Fable window cannot demote Opus.

Codex accepts the real rollout envelope: `{timestamp,type:"event_msg",payload:{type:"token_count",rate_limits}}`.
`primary` and `secondary` use `used_percent`, `window_minutes` and epoch-seconds `resets_at`. Duration 10080
is weekly and 300 is five-hour, independently of their position. An absent five-hour window is explicitly
`not_applicable` for this owner's confirmed weekly-only account, with null percentage/reset; this is not
a general inference from `plan_type:prolite`. Additional reported windows constrain admission too; optional
`scope:"model:<model>"` (or `model`) applies only to that cell.

Normalized schema 1 has `tool`, `source`, `state`, `reason`, `observedAt`, `ageSeconds` and `windows` with
`id`, `scope`, `applicability`, `percentUsed`, `resetsAt`, `state`, `reason` (except not-applicable windows).
The file reader adds `file`. String instants require calendar-valid ISO dates and an explicit `Z` or offset;
normalization emits UTC and ordering uses parsed milliseconds, never lexicographic strings.
Missing/malformed/contradictory data, an expired reset, or age over 600s (Claude) / 3600s (Codex) gives
`unknown`. Exact TTL boundaries are fresh; clock skew up to 30s in the future is tolerated. Reusing a
normalized reading never refreshes its timestamp. An elapsed reset marks only that window unknown with
`reset_pending_confirmation`, retaining its last percentage, never inventing 0%. Independent current windows
still constrain admission even when the aggregate reading is unknown. Absent/stale readings remain a last resort.
`readings_used` contains both readings, revalidated at dispatch.

The rollout reader scans the last 256 KiB of **every** recursively discovered `rollout-*.jsonl` file,
choosing the greatest valid event timestamp across the examined files and lines. One preceding byte
distinguishes a complete boundary record from a cut fragment; a complete record at the tail boundary is retained. It never uses mtime as
observation time or launches a model. Partial JSON and invalid/far-future timestamps are skipped; differing
windows at the same latest timestamp produce unknown. Symlinks are not followed. This bounded historical
reader can miss events outside those tails and returns unknown if no usable event is found. A read error
also gives unknown, with its error code. It is not a server refresh or a subscription identity check.

## Selection contract

`decide({task:{id,type,risk,override,pin,imageDemandPp},readings,now,costs})` accepts types `plan`, `design`,
`judgment`, `implement`, `review`, `mechanical`, `images`; risk is `normal`, `delicate` or `critical`.
Missing risk defaults to normal for images and critical otherwise. Invalid tasks/overrides/costs throw
TypeError, rather than inventing a quota wait.

| Task | Preferred cell | Other tool's cell |
|---|---|---|
| Plan/design/judgment | Claude opus/high | Codex sol/high |
| Implementation | Codex sol/low | Claude sonnet/medium |
| Ordinary review | Codex sol/low | Claude opus/low |
| Mechanical | Codex luna/low | Claude haiku/low |
| Images | Codex sol/low | None |

Delicate work has the transversal floor Codex sol/medium or Claude sonnet/medium; planning/judgment keeps
its higher cell. Critical work always uses Codex astra/high or Claude opus/high. Image requests must use
normal risk; separate any sensitive assessment into its own task. Fable is disabled, including in pins/overrides.
Model names are catalog keys, as in the existing router; dispatchers resolve executable slugs from the existing catalog.

Every new candidate must fit all its applicable windows after 2 pp emergency reserve per window. Ordinary
Codex work additionally protects `min(8,max(2,imageDemandPp))` weekly pp for pending images; only images
can use that reserve. No extra rollout penalty or 90% stop is added. These are estimated admission margins,
not a guarantee against external account consumption or real cost error.

Preference never causes a wait. Among candidates that fit, known applicable windows precede unknown readings.
If both are unknown, use the preferred cell; an unknown tool is still usable if the healthy other tool
cannot fit. With both healthy and fitting, any applicable preferred window **strictly over 85%** reverses
tool order, including design. Exactly 85% preserves preference. No effort degradation is performed.

`override` is `"claude"`, `"codex"` or `{tool,model?,effort?}` and fixes the tool. Optional model/effort must
match the qualified task cell; an override cannot lower its risk floor or send images to Claude.
`pin:{tool,model,effort}` preserves an already dispatched cell even under pressure/unknown readings.
A pin is not charged a fresh task estimate, but preserves the 2 pp emergency and applicable weekly image reserve.
If reserves no longer fit, only this pinned task waits with resumeAt; its tool never changes mid-execution.
Pins below the current risk floor or conflicting with an explicit override (tool/model/effort) are rejected. The caller
must retain task identity/scope and persist the returned pin; no concurrent-account grant ledger is claimed.

Run returns `{action:"run",tool,model,effort,pin,reason,readings_used}`. Wait retains the fixed cell if any,
includes `resumeAt = min(eligible cells.map(c => max(c.blocking resets)))`, and never changes a pin's tool.
This is the first instant at which some eligible cell could fit after all of its blocking windows reset,
not the earliest isolated reset. Waiting applies to this task only. A wake requires another observation/decision;
it grants no launch and never fabricates a zero balance. `explain(decision)` produces one Spanish line for logs.

Image tasks with omitted risk default to `normal`; other tasks default to `critical`. Explicit sensitive
image risk requires a separate assessment task. Empty or malformed Claude telemetry on `decide` stdin is
unknown (`missing_usage` / `invalid_usage_json`), while invalid task JSON and options remain input errors.

## Initial cost estimates

These are the FINAL §2 / SIMPLE-v2 simulation priors for one medium task, not measured subscription prices.
`costs` optionally overrides any key with `{five_hour,weekly}` nonnegative finite pp. `images` is a task cost
override (default 4× Sol low); other keys identify cells. Task-size scaling/calibration is deferred.

| Cost key | Five-hour pp | Weekly pp |
|---|---:|---:|
| luna/low | 0.4 | 0.10 |
| haiku/low | 0.6 | 0.15 |
| sol/low | 1 | 0.25 |
| sonnet/medium, sol/medium | 1.6 | 0.40 |
| sol/high | 2.4 | 0.60 |
| astra/high, opus/high | 4 | 1 |
| opus/low | 2 | 0.50 |
| opus/medium | 3 | 0.75 |
| images | 4 | 1 |

Uncalibrated additional window durations cost 100 pp and therefore cannot fit the protected emergency margin.

## CLI and verification

```sh
cat /path/to/get-usage.json | node plugin/runtime/capacity-cli.mjs ingest-claude
node plugin/runtime/capacity-cli.mjs codex-reading
node plugin/runtime/capacity-cli.mjs decide --task '{"id":"t1","type":"design","risk":"normal"}' --claude-usage-stdin
node plugin/runtime/capacity-cli.mjs decide --task '{"id":"t2","type":"implement","risk":"normal"}' --only codex --log decisions.jsonl
node plugin/scripts/test-capacity.mjs
```

The CLI reads `$CODEX_HOME/sessions` or `~/.codex/sessions`. `PANDACORP_NOW` injects the clock for reproducible
checks. `--log` appends one JSONL record with date, task routing fields, decision, reason and readings/ages;
it excludes task prompts and raw tool payloads. The parent directory is created when needed. Logs use 0600.
CLI errors go to stderr and exit nonzero; successful stdout contains exactly one JSON object.

The redacted fixture in `plugin/scripts/fixtures/capacity-rollout.jsonl` follows the complete rate_limits
object observed on 2026-11-14 (weekly 30%, secondary null). It deliberately omits unrelated token counters.
Acceptance includes quota/routing regressions and real local rollout reading, without provider calls.

## Historical phase-2 review corrections and restored coverage (2026-11-14)

Compared against `68487c7a` and the phase-2a HEAD `aaf893ee`. No commit is made by this correction.
Capacity had 31 cases at HEAD; it now has 50, including 19 named review cases (regressions and controls). Before the fixes,
14 of the first 15 added regressions failed (the offset-ordering control already passed). The later
account-limit, CLI conflict, model-scope and partial-tail cases also cover the integration boundaries.

| Finding | Correction | Regression in `test-capacity.mjs` |
|---|---|---|
| R1: pin bypassed safety floor | Reject pinned model/effort below delicate or critical risk, retaining the tool | `R1: pins cannot lower either risk floor` |
| R2: pin ignored explicit override | Reject conflicting tool, model or effort, including CLI `--only` | `R2: a pin cannot silently ignore…`; `R2 CLI` |
| R3: pin spent protected reserves | Charge no second task estimate, but preserve emergency and weekly image reserves; wait only this pin | `R3a` implementation and `R3b` images |
| R4: expired window erased current blocks | Assess each window; keep live weekly blocks; mark elapsed resets unknown/pending without zeroing | `R4a`, `R4b`, `R4 account` (newer expired receipt cannot reveal older balance) |
| R5: missing Claude stdin crashed CLI | Empty/malformed telemetry normalizes to unknown; task/options remain strict | `R5: empty/malformed Claude telemetry…` |
| R6: all model limits were ignored | Apply `all` plus matching model windows to fit, pin and pressure, for both tools | `R6a`, `R6b`, `R6 Codex` |
| R7: tail boundary dropped complete event | Inspect preceding byte; discard only a cut first record | `R7: tail aligned exactly…`; `R7 partial tail` |
| R8: premature resumeAt | Minimum across eligible cells of the maximum blocking reset for each cell | `R8: resumeAt is min…` and corrected original both-exhausted test |
| R9: ambiguous/impossible instants | Require explicit zone and valid calendar; order parsed milliseconds | `R9a` two process timezones; `R9b` invalid dates/leap day; `R9c` offset ordering |
| R10: omitted image risk threw | Default `image` and `images` to normal; reject explicitly sensitive risk | `R10: image and images default…` |

Routing coverage: **174 (`68487c7a`) → 13 (`aaf893ee`) → 364 cases**. Conserve coverage:
**12 → 6 → 13 cases**. The restored routing suite keeps all 24 builder input rows, 288 named review
cases (8 historical author models × 6 effort/origin variants × 2 kinds × 3 zones), and seven availability
states per review, including both tools exhausted. An independent hand table checks role/risk, 4,860 builder
combinations check valid catalog/model/runtime/effort/transport, frozen inputs check purity, and deliberately
invalid results prove that the invariant checkers fail. Session eligibility, consultation, retries, mixed-author
order, catalog validation and capability guards are checked separately. Author `max` is tested as rejected
input; routed `max`/`ultra`, Fable and Terra remain forbidden. The conserve suite restores adapter symmetry,
unknown/fresh/reset controls, author-order invariance, security audit fallback and all BL-0321 patch assertions.

### tests retirados

This is the assertion-level retirement ledger for the two historical files. Repeated generated variants
of one assertion are identified by their original row numbers/input domains. All scenarios remain exercised
with the current contract; only the following obsolete policy expectations are retired. Vocabulary, catalog,
runtime capability, safety floor, result structure, deterministic/frozen-input and checker negative-control
assertions remain active. No quota probe using a model is reintroduced.

| Historical assertion (`68487c7a`) | Why retired / current assertion |
|---|---|
| Builder docs-touch rows (plain, r1, attempt 3): label chooses Sonnet medium / Sol low and docs ignore risk | Docs are design work; labels do not pin. All three scenarios now check role and transversal risk |
| Builder docs feature/giant: label chooses Opus high / Sol high | Same qualified design cells remain; capacity chooses the eligible runtime |
| Builder tests rows none/floor/r1: Sonnet high / Sol medium for all zones | Test implementation follows actual risk; ordinary Sol low, delicate Sol medium, critical Astra high |
| Builder default/feature/attempt-2: label chooses runtime | Role preference plus capacity replaces label affinity; enabled models and floors remain checked |
| Builder floor/r1: same Sonnet high / Sol medium for both risk levels | Floor is delicate; r1 is critical and cannot route below Astra high / Opus high |
| Builder reopen 1/2 and reopen-over-zone: automatically Opus high / Sol high | Reopen count does not imply risk or escalate the model |
| Builder attempt-3 and attempt-3-over-reopen/zone: Opus xhigh / Astra high | Attempts cannot escalate ordinary work to Astra; actual risk still governs |
| Builder bounded/unbounded patch: Sonnet high / Sol medium vs Opus high / Sol high | Size/boundedness alone does not establish risk; both scenarios retain role/risk guards |
| Builder patch-reopen: keep old bounded-patch cell | Reopen no longer selects the cell; both bounded values and retries remain exercised |
| Builder bounded/unbounded patch attempt 3: Opus xhigh / Astra high | Attempt-only escalation is superseded |
| Builder audit: always Claude Opus high, including Codex label | Eligible critical Codex Astra high also runs; an exhausted Claude cannot stop an audit |
| Quota-switch tables: label selects a matrix column; switching preserves that row's old escalations | Fallback follows the task's role/risk cells; both exhaustion directions and each builder row remain checked |
| Unrelated-company quota never changes label routing; exhaustive healthy labels always build their own units | Labels no longer define the preference; design vs implementation preference does |
| Exact repeat raises effort one step on the same model/company; capped at xhigh | Previous cell/attempt cannot escalate risk. Retry chains still forbid invalid models/efforts and preserve current floors |
| Non-exact previous cell does not bump; switch is not a repeat; retry chain stays in label company | No repeat bump exists; all previous model/effort/company variants now keep role/risk selection and capacity fallback |
| Review matrix rows 1/2: Sonnet/Haiku author chooses Sol high/medium; 9/10: Sol/Luna author chooses Opus high/medium | Reviewer role and risk, not author company or FRD/touch size, select the cell |
| Review matrix rows 3/4 and 11: floor/r1 choose old Sol high/Astra high/Opus xhigh columns | Separate delicate and critical floors remain; author-dependent company and effort are superseded |
| Review matrix rows 5/7: Opus author requires Sol high; on quota N7 bumps Opus effort; unreachable parks | Fresh context permits the same model; one unavailable tool cannot park work that fits the other |
| Review matrix row 6: Opus r1 requires Astra; fallback Opus xhigh only on quota, park on unreachable | Critical floor remains Astra high / Opus high independent of author; fallback runs when it fits |
| Review matrix row 8: session Sonnet/Haiku/Opus uses a special touch row and null effort counts as high for N7 | Session origin does not select the reviewer or escalate effort; session authors and null effort remain inputs |
| Review matrix row 8 Fable and row 16: Fable author always demands Astra; no Codex means park | Historical author cannot force ordinary Astra or prevent eligible Claude; automatic Fable remains forbidden |
| Review matrix row 12: Astra author gets Opus normally, Sol high on quota, Astra xhigh on unreachable | Author and scarcity do not select stronger/different reviewer; fresh-context role/risk cells apply |
| Review matrix row 13: Astra risk-zone author gets Opus xhigh; Sol xhigh on quota; unreachable parks | Critical floor cannot downgrade for scarcity; floor/r1 keep their own risk cells and eligible fallback |
| Review matrix row 14: Terra author requires Opus or special Sol fallback | Disabled historical author is accepted as evidence but cannot choose current policy; Terra output stays forbidden |
| Review matrix row 15: Codex session authors use Opus medium, Astra or Sol/xhigh by scarcity | Session/author effort no longer selects reviewer; all session variants remain exercised |
| Review matrix all rows: primary stays fixed when availability changes | `primary` is now the actual allocated reviewer; it equals `used`, or both are null on wait |
| Review matrix all rows: Sol at_capacity automatically escalates to Astra | Ordinary work never escalates to Astra from pressure; capacity fallback and actual risk select cells |
| Review matrix all rows: quota/unreachable require degraded flags and sometimes a deferred cross-company re-review | Independent context satisfies review; routing sets degraded/deferred null and never waits for a preferred company |
| Named owner rules: Sonnet/Opus whole-FRD vs small-change, Opus unit-touch vs session-touch choose distinct old cells | All author/kind/origin combinations remain; role/risk replace the old size/author matrix |
| Named owner rules: no Codex quota → N7 next effort; unreachable Opus/Fable → park; Sonnet → degraded Opus | Context independence permits same model without N7 escalation; fallback runs if any cell fits |
| Named owner rules: no Claude → Astra for Sol author; Astra author → Sol xhigh/high or parked by zone | Author never forces ordinary Astra, and scarcity cannot lower a critical floor |
| Named owner rules: Fable session → Astra; Haiku session equals old Sonnet touch row | Sessions keep identical role/risk outcomes; never automatically emit Fable |
| Mixed Claude authors choose the strictest author row/Opus xhigh under quota | Risk of the task is authoritative; author order does not affect the independent reviewer |
| Review exhaustive: primary must be other company; same-model review only N7 quota exception | Same-company/model permitted with independent context, explicitly asserted |
| Review exhaustive: author's company availability is irrelevant | That company may now be the preferred or fallback qualified reviewer |
| Review exhaustive: Fable author may never use any Claude reviewer | Fable input does not disable otherwise qualified reviewers; Fable output is still forbidden |
| Negative controls reject same-company primary, same-model unreachable, non-N7 effort or missing deferred re-review | Those are now valid. Negative controls instead reject missing independent context, forbidden cells, wrong risk, malformed results and used reviewer while parked |
| Consult 1: origin Claude → Sol, origin Codex → Opus, drive/app → Astra | Consultation is design work; origin does not establish critical risk |
| Consult 2: different/higher cell; drive/app cannot consult twice | Both qualified design consultations are allowed without origin/attempt escalation; >2 still returns no cell |
| Conserve policy: 85 inclusive through 89 conserved; 90 stops new units | Pressure is a preference, never a global veto. Historical threshold metadata remains tested as compatibility data |
| Conserve availability adapter: 87 maps to conserve | Current policy maps admitted providers to ok and actual exhaustion to quota; next/preflight adapter symmetry retained |
| Conserve Sol-built review → Astra high; Astra-built → Sol high/xhigh (also 90+); symmetric Sonnet → other Claude model | Scarcity/author cannot force escalation or downgrade critical risk; risk-qualified review and no deferred ledger retained |
| Conserve controls: healthy tool always reviews cross-company; unreachable triggers N7 and deferred review | Context independence and capacity, not provider identity, determine the reviewer |
| Conserved builds stay with run label, including a conserved label tool | Label no longer pins tool selection; each new task follows role/risk and fitting capacity |
| Conserved Claude-pinned audit waits/deferred until Claude recovers | Audit can use either qualified tool; both directions preserve critical floor |
| BL-0322 mixed Sol+Astra authors → same_model Sol xhigh, park on unreachable, healthy Claude reviews | Current role/risk is independent of author set/order; no parked result while a qualified cell fits |
| BL-0322 stale Claude at >=85 stays known until reset | TTL applies regardless of percentage; stale/reset/missing-reset/fresh controls are restored without sticky scarcity |

### Historical acceptance evidence

Final current-tree battery: **35 suites, 1,449 passed, 0 failed**. Each command below ran with isolated
`PANDACORP_CAPACITY_DIR` and empty `CODEX_HOME` per suite, `TMPDIR=/private/tmp` and
`PANDACORP_TEST_TMP=/private/tmp`; the attended Python driver ran two independent fixture processes
at a time. All test processes exited 0. `test-build-v2-nested` reports its nine tests through Node's
native test runner. There were no inference/provider calls.

| Command | Final observed result |
|---|---|
| `node plugin/scripts/test-build-v2-admission.mjs` | 29 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-answer.mjs` | 32 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-cli.mjs` | 36 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-conserve.mjs` | 13 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-detect.mjs` | 46 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-disk.mjs` | 26 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-doubts.mjs` | 38 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-drive.mjs` | 45 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-e2e.mjs` | 104 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-failure.mjs` | 32 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-g2-leftover.mjs` | 5 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-gate-patch.mjs` | 7 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-hardening.mjs` | 38 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-integrate.mjs` | 23 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-jobs.mjs` | 13 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-land.mjs` | 50 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-lock-stress.mjs` | 3 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-nested.mjs` | 9 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-next.mjs` | 68 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-perf.mjs` | 10 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-planner.mjs` | 30 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-preflight.mjs` | 26 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-quota.mjs` | 35 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-report.mjs` | 46 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-review-pin.mjs` | 3 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-review-r1.mjs` | 23 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-review.mjs` | 59 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-risk-backtest.mjs` | 28 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-risk.mjs` | 30 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-routing.mjs` | 364 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-state.mjs` | 76 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-telemetry.mjs` | 23 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-unblock.mjs` | 13 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-build-v2-workers.mjs` | 16 passed, 0 failed; exit 0 |
| `node plugin/scripts/test-capacity.mjs` | 50 passed, 0 failed; exit 0 |
| `node --check` for the five changed `.mjs` files | exit 0 for each |
| `node plugin/scripts/generate-plugin-manifests.mjs` | exit 0; metadata/manifests 10.10.1 |
| `bash plugin/scripts/check-derived-drift.sh "$PWD"` | exit 0; only the expected linked-WT personal ledger check skipped |
| `git diff --check` | exit 0, clean |
| `claude plugin validate plugin/` | First invocation passed; repeat rejected by automatic approval: Codex may not dispatch or steer the Claude runtime |

No acceptance criterion remains unverified. Real provider reset/dispatch qualification and automatic wake-up
remain outside this correction's scope. The existing worktree is retained for the coordinator; temporary
battery drivers and logs are removed after recording this evidence. No commit is made.



## Historical phase-2a integration evidence (2026-11-14)

Base and retained HEAD: `68487c7a`. No commit was made. Plugin metadata and both generated manifests are
10.10.0. The required fallback battery is **38 suites passed, 0 failed**; no plugin package.json or test-all
runner exists. All model-facing integration uses fake executables, never live quota-consuming inference.

The attended verification driver ran every `plugin/scripts/test-build-*.mjs` plus `test-capacity.mjs`, with
two independent fixture processes at a time, per-suite `PANDACORP_CAPACITY_DIR` / empty `CODEX_HOME`, and
`TMPDIR=/private/tmp PANDACORP_TEST_TMP=/private/tmp`. A physical temporary path OUTSIDE a Git repository is
necessary: `/var` is a macOS symlink rejected by the safe-cleanup gate, while a temporary path inside the WT
would invalidate the risk classifier's not-a-Git-repository fixture. Neither expectation was relaxed.
The equivalent selection is `for test in plugin/scripts/test-build-*.mjs plugin/scripts/test-capacity.mjs;
do node "$test"; done`, with the isolated environment above. Temporary driver/log files are removed at close-out.

### Changed expectations and why

| Test / fixture | Before → after | Owner rule / preserved constraint |
|---|---|---|
| `test-capacity.mjs` | Standalone policy only → account ingestion/reuse, observedAt/private mode, concurrent atomic writes, corrupt snapshot unknown, passive probe, image exit 75, direct/alias Claude fallback | Adds the phase-2a contracts; all phase-1 preference, reserve, pin and freshness assertions remain |
| `test-build-v2-quota.mjs` reader/freshness cases | mtime/last-line wins and stale Codex probe → event-time selection, equal-time conflicts unknown, passive TTL and no probe | One shared reader; no model may read quota. The fixture's first normal event now has a distinct earlier timestamp |
| `test-build-v2-quota.mjs` policy cases | 90 veto / 95 handoff or no-standby pause; review degradation → continue while a qualified cell fits, no handoff/degradation, wait only when neither fits | Never-stop rule; limit detection, tail bounds, record validation and private projections remain tested |
| `test-build-v2-routing.mjs` builder tables | Label/size/reopen/attempt rows and repeat escalation → role/risk selection; attempts/reopens keep the risk floor; exhausted provider falls back | Old matrix assertions are replaced by explicit role/risk cells and 6,480 builder combinations, plus reviews. Catalog, forbidden model/effort, invalid input, determinism and immutability guards remain |
| `test-build-v2-routing.mjs` review/consult/session tables | Mandatory other company/layer, N7/author Astra, origin escalation and early session shortcut → independent-context review, risk-only Astra, design consultation and capacity before session eligibility | Context independence and no author/attempt escalation; same selected runtime/model required for a session shortcut |
| `test-build-v2-conserve.mjs` | 85/90 conserve and forced Astra/different-model audit deferral → no conserve veto, ordinary Sol review, same-model mixed-author review and stale readings unknown | DR-162 supersedes DR-161 thresholds. The unrelated BL-0321 patchSupersedes regression is retained |
| `test-build-v2-next.mjs` | Label-Claude agent and null session effort; 90/95 stop/handoff → actual allocated CLI/effort, one-tool fallback, both-exhausted pause with state/journal resumeAt | Adds task-specific design exhaustion and per-dispatch JSONL assertions. The completion fixture now closes its CLI job too; tokens, gates and state checks remain |
| `test-build-v2-cli.mjs` | 95/98 means paused and 95 means handoff → actual exhaustion with future resets means paused; single-provider pressure dispatches | Fencing, released lease, resume and tracked-write safeguards are unchanged |
| `test-build-v2-drive.mjs` | Codex 90/98 alone parks, silent recovery gated at Claude 85 → only joint exhaustion parks; single-provider pressure reaches the allocator loop; expired-lease recovery ignores percentages | Ownership, epoch transfer, current workers and human gates remain unchanged |
| `test-build-v2-doubts.mjs` | Origin-selected Sol/Astra and escalating Opus xhigh → design capacity and stable high effort; helper serves the actual allocated agent with a token | No origin/author escalation. Wrong-token, disagreement, caps, irreversibility and source checks remain |
| `test-build-v2-hardening.mjs` | Consult1 assumed CLI/no token → helper supplies the real token when the allocator selects an agent | Preserves authorization, no-consensus and irreversible-vote assertions |
| `test-build-v2-preflight.mjs` | Other-company reviewer / unreachable degradation; drive line only above threshold → ordinary Sol reviewer and shared-capacity announcement | No forced company independence or quota-triggered relay; no-probe and Spanish-output checks remain |
| `test-build-v2-workers.mjs` | Every Claude cell rejected → allocated Claude accepted with a structured execution pin; unsupported runtime and missing effort still rejected | Other-tool fallback uses the shared vehicle without relaxing arbitrary argv checks |
| `test-build-v2-review.mjs` | Narrow same-model N7 assumption → explicit same-model fresh-context pass and identical-worker-identity refusal | Adds context-independence proof; parked-review, token, probe and pinned-range protections remain |
| `test-build-v2-e2e.mjs` | 95 automatic handoff and 90 joint pause → pressure dispatch plus explicit handoff test, actual exhausted snapshots with resets, scenario B forces Codex pressure to exercise Claude work | Keeps landing/fencing/kill/resume/production/no-leak assertions. When ps is sandboxed, the helper requires the scenario's own PID set and a recent private standby PID/run receipt; the process-must-die assertion is unchanged |
| `fixtures/build-v2/make-fixture.mjs` | Project-local quota environment / equal-time differing normal events → isolated account directory and chronologically distinct events | Prevents host-account leakage and supplies valid observations to the shared conflict-aware reader |

Some legacy test names retain historical threshold wording for traceability; the table above specifies the
current assertions. No risk, fencing, token, production, isolation or cleanup expectation was weakened.

### Final battery output

| Command | Observed result |
|---|---|
| `node plugin/scripts/test-build-liveness.mjs` | exit 0; RESULT: 5 passed, 0 failed |
| `node plugin/scripts/test-build-state.mjs` | exit 0; RESULT: 33 passed, 0 failed |
| `node plugin/scripts/test-build-state-handoff.mjs` | exit 0; RESULT: 25 passed, 0 failed |
| `node plugin/scripts/test-build-v2-admission.mjs` | exit 0; RESULT 29 passed, 0 failed |
| `node plugin/scripts/test-build-v2-answer.mjs` | exit 0; RESULT: 32 passed, 0 failed |
| `node plugin/scripts/test-build-v2-cli.mjs` | exit 0; RESULT: 36 passed, 0 failed (test-build-v2-cli) |
| `node plugin/scripts/test-build-v2-conserve.mjs` | exit 0; RESULT 6 passed, 0 failed |
| `node plugin/scripts/test-build-v2-detect.mjs` | exit 0; RESULT 46 passed, 0 failed |
| `node plugin/scripts/test-build-v2-disk.mjs` | exit 0; RESULT 26 passed, 0 failed (test-build-v2-disk) |
| `node plugin/scripts/test-build-v2-doubts.mjs` | exit 0; RESULT: 38 passed, 0 failed |
| `node plugin/scripts/test-build-v2-drive.mjs` | exit 0; RESULT: 45 passed, 0 failed |
| `node plugin/scripts/test-build-v2-e2e.mjs` | exit 0; RESULT test-build-v2-e2e: 104/104 passed, 0 failed (42 s) |
| `node plugin/scripts/test-build-v2-failure.mjs` | exit 0; RESULT 32 passed, 0 failed |
| `node plugin/scripts/test-build-v2-g2-leftover.mjs` | exit 0; RESULT: 5 passed, 0 failed |
| `node plugin/scripts/test-build-v2-gate-patch.mjs` | exit 0; RESULT 7 passed, 0 failed |
| `node plugin/scripts/test-build-v2-hardening.mjs` | exit 0; RESULT test-build-v2-hardening: 38 passed, 0 failed |
| `node plugin/scripts/test-build-v2-integrate.mjs` | exit 0; RESULT 23 passed, 0 failed |
| `node plugin/scripts/test-build-v2-jobs.mjs` | exit 0; RESULT 13 passed, 0 failed |
| `node plugin/scripts/test-build-v2-land.mjs` | exit 0; RESULT: 50 passed, 0 failed (test-build-v2-land.mjs) |
| `node plugin/scripts/test-build-v2-lock-stress.mjs` | exit 0; 3 passed, 0 failed (13.8 s, plugin /private/tmp/claude-501/-Users-Shared-Proyectos-panda-corp-mission-control/fc70ef5d-08c6-4d65-9c1a-6dd405fc8c3f/scratchpad/wt-capacity/plugin) |
| `node plugin/scripts/test-build-v2-nested.mjs` | exit 0; exit 0 |
| `node plugin/scripts/test-build-v2-next.mjs` | exit 0; RESULT: 68 passed, 0 failed |
| `node plugin/scripts/test-build-v2-perf.mjs` | exit 0; RESULT 10 passed, 0 failed |
| `node plugin/scripts/test-build-v2-planner.mjs` | exit 0; RESULT: 30 passed, 0 failed |
| `node plugin/scripts/test-build-v2-preflight.mjs` | exit 0; RESULT  26 passed, 0 failed |
| `node plugin/scripts/test-build-v2-quota.mjs` | exit 0; RESULT 35 passed, 0 failed |
| `node plugin/scripts/test-build-v2-report.mjs` | exit 0; RESULT: 46 passed, 0 failed |
| `node plugin/scripts/test-build-v2-review.mjs` | exit 0; RESULT: 59 passed, 0 failed |
| `node plugin/scripts/test-build-v2-review-pin.mjs` | exit 0; RESULT: 3 passed, 0 failed |
| `node plugin/scripts/test-build-v2-review-r1.mjs` | exit 0; RESULT: 23 passed, 0 failed (test-build-v2-review-r1) |
| `node plugin/scripts/test-build-v2-risk.mjs` | exit 0; RESULT: 30 passed, 0 failed (test-build-v2-risk.mjs) |
| `node plugin/scripts/test-build-v2-risk-backtest.mjs` | exit 0; RESULT: PASS passed=28 failed=0 |
| `node plugin/scripts/test-build-v2-routing.mjs` | exit 0; RESULT 13 passed, 0 failed |
| `node plugin/scripts/test-build-v2-state.mjs` | exit 0; RESULT: 76 passed, 0 failed |
| `node plugin/scripts/test-build-v2-telemetry.mjs` | exit 0; RESULT 23 passed, 0 failed |
| `node plugin/scripts/test-build-v2-unblock.mjs` | exit 0; RESULT: 13 passed, 0 failed |
| `node plugin/scripts/test-build-v2-workers.mjs` | exit 0; RESULT: 16 passed, 0 failed |
| `node plugin/scripts/test-capacity.mjs` | exit 0; 31 passed, 0 failed |

Additional acceptance commands: `bash plugin/scripts/check-derived-drift.sh "$PWD"` → exit 0;
`git diff --check` → exit 0. The drift gate intentionally skips only the gitignored personal-state ledger
in a linked WT. Generated plugin manifests remain synchronized; no agent mirror was hand-edited.

### Delivered files

One path per line; all changes remain uncommitted:

- `factory/decision-log.md`
- `factory/decisions/registry.yaml`
- `factory/standards/agent-portability.md`
- `factory/standards/build-engine.md`
- `mission-control/content/manual/guides/g-implement-parcial.md`
- `mission-control/docs/decision-log.md`
- `mission-control/src/app/manual/manualPages.tsx`
- `plugin/.claude-plugin/plugin.json`
- `plugin/.codex-plugin/plugin.json`
- `plugin/docs/capacity.md`
- `plugin/docs/decision-log.md`
- `plugin/runtime/build/doubts.mjs`
- `plugin/runtime/build/doubts/consult.mjs`
- `plugin/runtime/build/doubts/records.mjs`
- `plugin/runtime/build/drive/loop.mjs`
- `plugin/runtime/build/drive/takeover.mjs`
- `plugin/runtime/build/drive/triggers.mjs`
- `plugin/runtime/build/lifecycle/resume.mjs`
- `plugin/runtime/build/next/candidates.mjs`
- `plugin/runtime/build/next/dispatch.mjs`
- `plugin/runtime/build/next/planning.mjs`
- `plugin/runtime/build/next/step.mjs`
- `plugin/runtime/build/next/terminal.mjs`
- `plugin/runtime/build/paths.mjs`
- `plugin/runtime/build/preflight/access.mjs`
- `plugin/runtime/build/quota.mjs`
- `plugin/runtime/build/review.mjs`
- `plugin/runtime/build/review/degradation.mjs`
- `plugin/runtime/build/routing.mjs`
- `plugin/runtime/build/schemas/state.schema.json`
- `plugin/runtime/build/state.mjs`
- `plugin/runtime/build/summary.mjs`
- `plugin/runtime/build/workers.mjs`
- `plugin/runtime/capacity-cli.mjs`
- `plugin/runtime/capacity.mjs`
- `plugin/runtime/plugin-metadata.json`
- `plugin/scripts/codex-worker.mjs`
- `plugin/scripts/fixtures/build-v2/make-fixture.mjs`
- `plugin/scripts/test-build-v2-cli.mjs`
- `plugin/scripts/test-build-v2-conserve.mjs`
- `plugin/scripts/test-build-v2-doubts.mjs`
- `plugin/scripts/test-build-v2-drive.mjs`
- `plugin/scripts/test-build-v2-e2e.mjs`
- `plugin/scripts/test-build-v2-hardening.mjs`
- `plugin/scripts/test-build-v2-next.mjs`
- `plugin/scripts/test-build-v2-preflight.mjs`
- `plugin/scripts/test-build-v2-quota.mjs`
- `plugin/scripts/test-build-v2-review.mjs`
- `plugin/scripts/test-build-v2-routing.mjs`
- `plugin/scripts/test-build-v2-workers.mjs`
- `plugin/scripts/test-capacity.mjs`
- `plugin/skills/design/scripts/codex-image.sh`
- `plugin/skills/implement/SKILL.md`
- `plugin/skills/implement/references/autonomy.md`
- `plugin/skills/implement/references/drive.md`
- `plugin/skills/implement/references/engine-v2.md`
- `factory/memory/_inbox.md` (gitignored, append-only lesson capture)

### Remaining scope and risks

- Automatic wake-up is phase 3. This change persists resumeAt in both state and journal and clears it on resume.
  Concurrent reservations/crash reconciliation and live subscription-reset certification are not claimed.
- Real authenticated Claude/Codex/image dispatch, native-agent effort fidelity and provider CLI permission behavior
  were not exercised. Automatic tool approval rejected even `claude --help` because Codex may not dispatch or steer
  the Claude runtime in this environment. Both launch paths and the Claude bridge were verified with fake processes.
- Historical N7 prose in the reviewer role file remains unchanged (generated agent mirrors are read-only here).
  Each engine review brief carries the explicit owner DR-162 policy overriding that historical paragraph, and the
  registry, routing and review-record enforce context independence. Live-model adherence still needs qualification.
- Changes to Mission Control are manual explanatory text only; its app build/browser was not run for this plugin task.

## Suspension, wake ownership and option B

A certified provider `usage_limit` suspends the execution, retaining the dirty worktree, branch, report
token, worker id, provider thread/session id, tool/model/effort pin and attempt. Harvest closes only the
process job; it never queues a fresh task or removes these references. A bare mention of "quota" is not
exhaustion. HTTP 429/529 / overloaded errors are `rate_limit`, with same-cell backoff 60,120,240,480,900s
(capped thereafter); a positive Retry-After is honored up to 900s. Rate limits do not write account exhaustion.

Only that pinned tool can resume a suspended unit. Independent new units still use the other tool. When
nothing can progress the run becomes `waiting`, retaining its lease, with the minimum eligible `resumeAt`.
The live drive loop sleeps in <=60s lease-renewal chunks until `resumeAt+60s`, then rereads Codex rollouts
and the Claude account snapshot. Node does not call Desktop get_usage. A Claude lead with the app open
uses **ScheduleWakeup**, not an additional CronCreate job, for the same instant, re-ingests get_usage,
and calls `start --resume --coordinator claude --wake-generation N`. If no scheduler is available the lead
keeps the attended next loop alive. A single optional owner line announces the wait; details stay in JSONL.

The run's `wake` generation, epoch, owner and claim pid are protected by the existing lease mutex.
Drive, lead and manual resume conditionally claim `waiting→resuming` once. Losing and stale-generation
wakes do not transfer ownership. A failed lead claim returns to waiting; a dead claim pid is recoverable.
A resumed run with a live lease cannot be stolen by another simultaneous manual capacity resume.
Suspended trees are never reset, including a crash between re-admission and continuation registration.
The worker relay resumes an explicit provider session (`codex exec resume <id>` / Claude `--resume <id>`),
never `--last`, with the saved cell, sandbox and schema. A continuation sequence makes a repeated resume
idempotent. Old process result files are moved individually into `continuations/<sequence>/`.
A missing provider session refuses a fresh replacement task and retains the checkpoint for diagnosis.
Native Claude agents enter via `suspend --epoch E --unit U --file RECEIPT`, including the exact Agent
resume id; `resume:true` dispatches instruct the lead to resume that Agent with its original report token.

Passing the reset time does not invent zero usage. Subscription continuation requires a newer healthy
observation at/after reset; stale/unknown/expired readings retry after 60,120,240,480,900s. `resumeAt` is
the earliest retry eligibility; schedulers add 60s. Suspensions, waits, wakes and resumptions append
`capacity-decisions.jsonl` with reason, cell(s) and resumeAt; `capacity_state` journal events rebuild them.

Option B resolves an inconclusive reversible technical choice as an engine assumption, with rationale
and reversal in its doubt record, decision log and journal. It proceeds through normal review and
integration even for a lone unit. It does not need later owner acceptance. Production, money, deletion
and unauthorized external communication retain their gates; tests retain the veto/gate negative controls.

`test-capacity-resume.mjs` uses fake providers and real local fences/worktrees; it spends no model quota.
Historical assertions expecting quota release, root-ratio approval or no-consensus owner waits in
`test-build-v2-{next,cli,drive,e2e,doubts,hardening}.mjs` are updated in-place to the phase-3 contract;
their scenarios, gate checks and negative controls remain. Live authentication, native Agent timer
execution, machine sleep and a real subscription reset require the separate phase-4 canary. No live
provider qualification is inferred from fake transports or a scheduled-instruction document.

### Phase-3 verification, 2026-11-14

Compared in this session against main `bc923770`, from worktree HEAD `05a9fdaf` (no commit).
`test-capacity-resume.mjs`: **10 passed, 0 failed**; `test-capacity.mjs`: **50 passed, 0 failed**.
All 34 `test-build-v2-*.mjs` suites: **zero new failures**. Existing failure counts match main:
CLI 1, disk 10, G2-leftover 5, hardening 2, integrate 2, land 2, next 1, report 1.
Main additionally failed one e2e check here; current e2e passed 104/104. Historical scenario assertions
were updated only for the explicitly superseded pause/release and reversible-owner-wait policies;
the doubt suite retains 38 named cases. Derived-drift and diff whitespace checks exit 0.
