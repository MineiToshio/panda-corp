# Shared capacity policy — phase 2a

The build engine, direct/alias worker launcher and image launcher use the shared allocator.
`build/quota.mjs` preserves its public API as a compatibility adapter; local quota files are projections.
Role and deterministic risk choose a cell, independent of author and attempt. One exhausted tool means
use the other qualified tool; only neither fitting parks capacity, persisting `resumeAt` in run state and journal.
Never ask the owner about quota. Review independence is a fresh context, including on the same model.

## Account ingestion and audit

The account state lives in `~/.pandacorp/host/capacity/` (`PANDACORP_CAPACITY_DIR` in tests).
`ingest-claude` reads Desktop get_usage JSON from stdin, retaining/adding `observedAt`, and atomically
replaces `claude.json` using a unique exclusive temp, rename and mode 0600. Readers see complete snapshots
without a lock. `decide` reads that snapshot when `--claude-usage-stdin` is absent. Codex is read from rollouts;
legacy recordCodex observations and real limit receipts are reconciled by observation time. Limit receipts
remain effective until reset or a newer observation, without refreshing the recorded timestamp.

Every dispatcher records JSONL with task, decision, reason and readings_used. Engine run path:
`.pandacorp/run/build/capacity-decisions.jsonl`; otherwise `<capacity-dir>/decisions.jsonl`.
The CLI accepts `--log` and launchers accept `PANDACORP_CAPACITY_LOG` for an explicit audit destination.
`type:image` is an alias of `images`. `codex-image.sh` exits 75 with the wait JSON including resumeAt.
Worker launches consult once before starting; repeated run/read calls retain their existing execution cell.
The launcher can execute an allocated Claude cell through the authenticated Claude CLI; engine-assigned
cells are passed as pins, preserving the execution's tool/model. Real CLI authentication and provider resets
are not certified by fixture tests. Automatic wake-up, reservations and crash reconciliation remain later phases.

## Inputs and readings

Core exports have JSDoc contracts. The normalizers and `decide` require an injected `now` (ISO instant,
epoch milliseconds or Date); `decide()` remains pure; account helpers and rollout readers perform filesystem IO.

Claude accepts Desktop `get_usage` JSON: `{status?, observedAt?, plan:{windows:[{label,percentUsed,resetsAt}]}}`.
Labels are `5-hour limit`, `Weekly · all models` and `Weekly · Fable`. A live handoff without `observedAt`
is dated at ingestion; cached callers must preserve the original timestamp. Node never calls get_usage.
The Fable window is retained for diagnostics and never restricts other models.

Codex accepts the real rollout envelope: `{timestamp,type:"event_msg",payload:{type:"token_count",rate_limits}}`.
`primary` and `secondary` use `used_percent`, `window_minutes` and epoch-seconds `resets_at`. Duration 10080
is weekly and 300 is five-hour, independently of their position. An absent five-hour window is explicitly
`not_applicable` for this owner's confirmed weekly-only account, with null percentage/reset; this is not
a general inference from `plan_type:prolite`. Additional reported windows constrain admission too.

Normalized schema 1 has `tool`, `source`, `state`, `reason`, `observedAt`, `ageSeconds` and `windows` with
`id`, `scope`, `applicability`, `percentUsed`, `resetsAt`. The file reader adds `file`. All timestamps are UTC.
Missing/malformed/contradictory data, an expired reset, or age over 600s (Claude) / 3600s (Codex) gives
`unknown`. Exact TTL boundaries are fresh; clock skew up to 30s in the future is tolerated. Reusing a
normalized reading never refreshes its timestamp. `readings_used` contains both readings, revalidated at dispatch.

The rollout reader scans the last 256 KiB of **every** recursively discovered `rollout-*.jsonl` file,
choosing the greatest valid event timestamp across the examined files and lines. It never uses mtime as
observation time or launches a model. Partial JSON and invalid/far-future timestamps are skipped; differing
windows at the same latest timestamp produce unknown. Symlinks are not followed. This bounded historical
reader can miss events outside those tails and returns unknown if no usable event is found. A read error
also gives unknown, with its error code. It is not a server refresh or a subscription identity check.

## Selection contract

`decide({task:{id,type,risk,override,pin,imageDemandPp},readings,now,costs})` accepts types `plan`, `design`,
`judgment`, `implement`, `review`, `mechanical`, `images`; risk is `normal`, `delicate` or `critical`.
Missing risk defaults to critical. Invalid tasks/overrides/costs throw TypeError, rather than inventing a quota wait.

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

Preference never causes a wait. Among candidates that fit, known readings precede unknown readings.
If both are unknown, use the preferred cell; an unknown tool is still usable if the healthy other tool
cannot fit. With both healthy and fitting, any applicable preferred window **strictly over 85%** reverses
tool order, including design. Exactly 85% preserves preference. No effort degradation is performed.

`override` is `"claude"`, `"codex"` or `{tool,model?,effort?}` and fixes the tool. Optional model/effort must
match the qualified task cell; an override cannot lower its risk floor or send images to Claude.
`pin:{tool,model,effort}` preserves an already dispatched cell even under pressure/unknown readings.
A pin is not charged a fresh task estimate: only a fresh applicable 100% window pauses it. The caller
must retain task identity/scope and persist the returned pin; phase 1 owns no grant ledger or launch receipt.

Run returns `{action:"run",tool,model,effort,pin,reason,readings_used}`. Wait retains the fixed cell if any,
includes `resumeAt` at the earliest blocking reset, and never changes a pin's tool. Waiting applies to this
task only. If different windows block, waking at the first reset requests reevaluation; it grants no launch
and never fabricates a zero balance. `explain(decision)` produces one Spanish line for logs.

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

## Phase-2a integration evidence (2026-11-14)

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
