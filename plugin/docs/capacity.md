# Shared capacity policy — phase 1

`plugin/runtime/capacity.mjs` is a standalone, deterministic policy for new tasks. It does not dispatch
workers, reserve concurrent allocations, persist account state or schedule resumption. The build engine
and orchestrate still use their existing paths; neither `build/quota.mjs` nor `build/routing.mjs` is changed.

## Inputs and readings

All five exports have JSDoc contracts. The normalizers and `decide` require an injected `now` (ISO instant,
epoch milliseconds or Date); only `readCodexFromRollouts(dir, now)` performs filesystem reads.

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
Model names are catalog keys, as in the existing router; phase-2 dispatchers will resolve executable slugs.

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
node plugin/runtime/capacity-cli.mjs codex-reading
node plugin/runtime/capacity-cli.mjs decide --task '{"id":"t1","type":"design","risk":"normal"}' --claude-usage-stdin
node plugin/runtime/capacity-cli.mjs decide --task '{"id":"t2","type":"implement","risk":"normal"}' --only codex --log decisions.jsonl
node plugin/scripts/test-capacity.mjs
```

The CLI reads `$CODEX_HOME/sessions` or `~/.codex/sessions`. `PANDACORP_NOW` injects the clock for reproducible
checks. `--log` appends one JSONL record with date, task routing fields, decision, reason and readings/ages;
it excludes task prompts and raw tool payloads. The parent directory must already exist. New logs use 0600.
CLI errors go to stderr and exit nonzero; successful stdout contains exactly one JSON object.

The redacted fixture in `plugin/scripts/fixtures/capacity-rollout.jsonl` follows the complete rate_limits
object observed on 2026-11-14 (weekly 30%, secondary null). It deliberately omits unrelated token counters.
Acceptance includes quota/routing regressions and real local rollout reading, without provider calls.
