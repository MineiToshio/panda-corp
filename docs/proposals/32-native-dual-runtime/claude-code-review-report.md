# Claude Code independent review — Proposal 32

**Date:** 2026-07-10
**Reviewer:** Claude Code (independent session, adversarial mandate per [claude-code-review-handoff.md](claude-code-review-handoff.md))
**Status of this artifact:** dated independent evidence. It is NOT a second canonical plan. Where it disagrees with Proposal 32, the disagreement is a delta for Codex to reconcile, not a replacement text.
**Review mode:** read-only audit. No implementation, no fixes, no version bumps, no plugin/config/trust/automation mutations, no commits. The only writes performed were this file and `claude-to-codex-return-prompt.md`.

## Executive verdict

- **Overall: MODIFY.**

Proposal 32's strategic direction is sound and its red-team ledger is honest — every mechanism claim I could trace against the live code (the TOCTOU lock, the ownerless Stop-gate signals, the prompt-embedded mutations, the two independent Dynamic Workflows, the routine ownership) checked out as accurate or *conservative*. It is not approvable as-is for three reasons. First, its central architectural device — a "transition/state service (single writer)" called by both executors — is drawn as if the Claude executor could invoke it deterministically; it cannot: a Dynamic Workflow script body has no filesystem, module-import, or process access, so every state-service call from the Claude side is necessarily mediated by a subagent (a model roundtrip), which changes where the one-writer boundary can actually be enforced (R5/R6/R7 need re-scoping, not just a spike). Second, the proposal kills the "file lock is cross-runtime safe" and "resume from any interruption" claims but leaves them **alive in the committed standards** (`factory/standards/agent-portability.md:73-80`, `AGENTS.md:97`) with no retraction step in any ring — until those lines change, the repo itself instructs a Codex operator to perform the exact unsafe TOCTOU acquisition the red team rejected. Third, several concrete gaps found in this review (no portable spend brake, achievements/XP derived from undeduplicated events, a fail-open `jq` path in the Stop gate, prompt-prose mutations that R6's "remove the replaced branch" cannot mechanically remove) are absent from the plan. All are fixable by modification; none invalidates the progressive-certification approach.

## Evidence inspected

### Live proof (executed or read directly in this session, 2026-07-10)

| Evidence | Method | Result |
|---|---|---|
| `node plugin/scripts/test-build-engine.mjs` | re-run | 3 passed, 0 failed (review-split harness) |
| `node plugin/scripts/test-pandacorp-build.mjs` | re-run | 54 passed, 0 failed (main engine harness) |
| `bash plugin/scripts/test-check-derived-drift.sh` | re-run | 10 passed, 0 failed |
| `bash plugin/scripts/test-block-dangerous.sh` | re-run | 54 passed, 0 failed |
| `bash plugin/scripts/test-warn-adhoc-write.sh` | re-run | 13 passed, 0 failed |
| `bash plugin/scripts/test-detect-gate-config-newer.sh` | re-run | 8 passed, 0 failed |
| `bash plugin/scripts/test-backup-and-precious.sh` | re-run | 12 passed, 0 failed |
| `bash plugin/scripts/check-derived-drift.sh` | re-run | green (exit 0) |
| Unmatched-label claim (§4 of the proposal) | re-run, observed harness log | CONFIRMED: scenarios log `unmatched agent labels (answered {})`: `baseline-precheck`, `pin:*`, `gate-worktree`, `apply-gate:*` while passing |
| Repo facts (§3.1) | shell counts | CONFIRMED: 25 skills, 14 agent .md, 17 TOMLs, `AGENTS.md` = 17,010 bytes, `.agents/skills -> ../plugin/skills` healthy, both manifests `9.85.0` |
| Installed Claude plugin | read-only read of `~/.claude/plugins/installed_plugins.json` | `pandacorp@panda-corp` user-scope, version `9.85.0`, cache path `.../cache/panda-corp/pandacorp/9.85.0`, lastUpdated 2026-07-10 |
| Installed scheduler | read-only `list_scheduled_tasks` | EXACTLY two tasks: `pandacorp-memory-review` (daily 09:03, enabled, lastRun 2026-07-10) and `pandacorp-review-launch` (weekly Mon 09:03, enabled). NO `pandacorp-consistency-sweep`. Matches §3.4 |
| Factory HEAD | `git rev-parse HEAD` | `50ef2cb6cc5be5a5dc874e5e51a09f025a0bc7a5` |
| Dynamic Workflow runtime contract | this runtime's own `Workflow` tool contract (primary source: the installed Claude Code runtime executing this review) | Scripts are plain single-file JavaScript loaded via `script`/`scriptPath`; injected globals `agent`, `parallel`, `pipeline`, `phase`, `log`, `args`, `budget`, `workflow`; **no filesystem or Node.js API access**; `Date.now()`/`Math.random()` throw (resume determinism); the only escape hatch is `agent()` (a model roundtrip); `workflow()` nests one level |

Full engine, hook, Mission Control, and governance-document inspection was performed by delegated read-only audit agents over: `plugin/templates/shared/.claude/engines/pandacorp-build.js` (all 2,057 lines), `.claude/engines/pandacorp-backlog.js`, `plugin/skills/implement/SKILL.md`, `plugin/skills/implement-backlog/SKILL.md`, `plugin/hooks/hooks.json` and every script it registers, `plugin/scripts/{preflight-implement,launch-implement,check-build-liveness,verify-before-stop,block-dangerous,generate-codex-agents,check-derived-drift,emit-event,rotate-events,warn-adhoc-write,capture-lessons-reminder}.{sh,mjs}`, both plugin manifests, all 17 `.codex/agents/*.toml`, `mission-control/src/app/api/live/route.ts`, `mission-control/src/lib/{events/events.ts,tasks/tasks.ts,plugin-sync/plugin-sync.ts,achievements/*,gamification/*,status/*,work-orders/*,build-track/*}`, `plugin/docs/routines.md`, `plugin/docs/dynamic-workflows.md`, `factory/constitution.md`, `factory/standards/{single-source-of-truth,agent-portability,build-orchestration}.md`, `docs/proposals/25-multi-runtime-portability.md`, `factory/backlog/BL-0030/0031/0032` plus a scan for adjacent open items. Load-bearing quotes (PORT-5 lock claim, `verify-before-stop.sh` jq usage, proposal ring labels) were re-verified first-hand by the reviewing session before being used in findings.

### Official documentation (fetched 2026-07-10)

All 8 Codex URLs cited in Proposal 32 §2 resolve to official OpenAI documentation. `developers.openai.com/codex/...` URLs 308-redirect to `learn.chatgpt.com/docs/...` ("ChatGPT Learn — OpenAI Developers"), which is OpenAI's own doc platform — URL #2 (`learn.chatgpt.com/docs/hooks`) is the same official property cited by its redirect target rather than its canonical vanity URL (hygiene defect only). Details in the Codex capability verdict section.

### Inference vs proof

- **Live proof:** everything in the table above; all file:line citations in the findings.
- **Inference (labeled):** behavior of an installed Codex runtime against this repo (hooks firing, trust flow, subagent compliance, automation continuity) — no Codex process was run and no plugin/config/trust mutation was allowed in this review. All such claims below are marked UNKNOWN with the required spike.

## Findings

### P0-1 — The one-writer "transition/state service" cannot be invoked deterministically by the Claude executor; the proposal's architecture diagram implies a call seam that cannot exist

- **Claim:** §6.3 / §9 draw `Claude executor → transition/state service (single writer)` as an invocable seam, and R5 asks "Can it call a CLI without converting deterministic transitions into a model roundtrip?" as an open empirical question.
- **Evidence:** The Dynamic Workflow runtime contract (primary source: the running Claude Code runtime) gives script bodies **no filesystem or Node.js API access and no module imports** — a script is one file (`scriptPath`) with injected globals, and its only side-effect channel is `agent()`, i.e., a model roundtrip. This is not speculative; it is the current published tool contract of the runtime executing this review, consistent with `plugin/docs/dynamic-workflows.md` and with how both engines actually work: the forensic pass over `pandacorp-build.js` found the script body performs **zero** filesystem/git operations — every durable mutation is executed by a subagent following prompt prose (WO status stamps at lines ~716, ~1000, ~1097, ~1124-1128; `phase: release` at ~2022; the FRD/blueprint rollup derivation rule repeated **verbatim in ≥7 prompts** at ~660, ~1000, ~1011, ~1097, ~1128, ~1978, ~2020; `last_green_sha` ordering recipe at ~310). The only deterministic non-model writers of build state today are shell scripts (`launch-implement.sh`, the supervisor's touch), already outside the workflow.
- **Impact:** Three of R5's five questions are answerable **today** without a spike (imports: NO; direct CLI calls from the script body: NO; deterministic bundle: only as generated text concatenated into the single script file). More importantly, the one-writer boundary cannot be enforced at the call layer on the Claude side — the workflow will always route mutations through subagents. So the enforceable boundary is: (a) a shared deterministic CLI (`plugin/scripts/*`) that subagents of BOTH runtimes are instructed to invoke, plus (b) path-level rejection of direct writes to governed keys (hook/CI check), plus (c) generated prompt fragments so the instruction text itself has one source. The diagram as drawn (executors call the service directly) is achievable for Codex, but never for Claude, and the proposal does not say so.
- **Correction:** Re-scope R5 from "can the workflow import/bundle/call a CLI?" to "which shape of shared core — (i) generated bundle concatenated into the engine script (projection of a canonical source module), (ii) shared CLIs invoked by subagents via Bash, or (iii) both — preserves semantics?" and state explicitly in §6.3/§9 that on the Claude side the service is invoked *by subagents on the executor's instruction*, with enforcement at the file/guard layer, not the call layer. Note the engines share **zero code** (two independent single-file scripts; confirmed), so a shared CLI is the only vehicle that serves both engines and both runtimes at once.
- **Acceptance test:** revised R5 spike plan enumerates the three shapes with a live disposable-fixture test for (i) (generated script byte-determinism + injected-globals preservation + resume) and a golden test for (ii) (same CLI, same inputs → same file mutations when called from a Claude subagent and from a plain shell); the state-writer boundary check in §11 is specified as path/key-based rejection (not call-graph-based).

### P0-2 — The committed standards still assert the two claims the red team killed, and no ring retracts them

- **Claim:** §7 kills "Existing file lock prevents concurrent runtimes" (TOCTOU) and "Resume works from any runtime interruption". §13's documentation model applies only "after approval and implementation".
- **Evidence (first-hand):** `factory/standards/agent-portability.md:75`: *"**The single-build lock applies across runtimes.** … runtime-agnostic: a Codex attended build and a Claude background build cannot run on the same project simultaneously."* Line 73: *"This is exactly what makes **cross-runtime resume** work: Codex can continue a build Claude Code started (and vice versa)…"*. Worse, line 80 gives the attended (non-Claude) loop an explicit read-then-write recipe: *"Read `running` + `supervisor_heartbeat`… Stale or absent → take the lock: `running: true`…"* — the standard literally instructs a Codex operator to perform the TOCTOU acquisition. `AGENTS.md:97` repeats both claims. `factory/standards/build-orchestration.md` §11 itself never claims cross-runtime safety (the word "runtime" does not appear in its lock section) and even records *"no fencing token exists — that claim was corrected 2026-07-01"* — so the standards contradict each other today.
- **Impact:** This is a **present-day** hazard, not a plan hazard. Any Codex session following the committed instructions right now is authorized — instructed — to take the lock unsafely and to resume "from files" mid-run, which the engine analysis shows corrupts the per-process commit chain, discards in-flight gate worktrees, and loses the in-memory brakes (see P1-3). The proposal cannot leave the correction to post-implementation documentation.
- **Correction:** Add to R0 an owner-gated standards hotfix (via `/pandacorp:learn`, outside this review): mark PORT-5's lock/resume claims as corrected — cross-runtime handoff is **safe-point-only**, the lock is a TTL heartbeat guard without mutual exclusion, and non-Claude runtimes must not self-clear a stale lock until the atomic lease (R2) exists. Mirror the fix in `AGENTS.md` §Runtime portability. Until that lands, the interim rule is: Codex is read/review-only on any project with build state.
- **Acceptance test:** grep gate: the strings asserting cross-runtime lock safety / unqualified cross-runtime resume are absent from `agent-portability.md` and `AGENTS.md`; the revised text names safe-point-only handoff and the lease dependency; the reevaluation trigger points at Gate R2.

### P1-1 — Stop-gate suppression is confirmed, and the gate has an additional fail-open path the proposal missed

- **Claim:** §8: a non-certified Codex controller creating fresh build signals could disable Claude Stop verification for unrelated sessions.
- **Evidence:** CONFIRMED and mechanically precise. `verify-before-stop.sh:30-33` skips verification when `.pandacorp/run/build.lock` mtime < 10 min; lines 40-56 skip when `last_event_at` OR `supervisor_heartbeat` in `status.yaml` is < 600 s old. None of these signals carries any owner/runtime identity; the skip applies to **every** session parked at that cwd (the script's own comments say this is intentional for the legitimate multi-session case). Net-new: the script has **no `command -v jq` guard**, unlike its siblings (`block-dangerous.sh:7`, `preflight-implement.sh:15`, `check-derived-drift.sh`, `emit-event.sh`, `detect-gate-config-newer.sh` all have one — verified by grep). With `jq` absent, its `jq -r` extractions fail, `cwd` resolves empty/garbled, `[ -f "$verify" ]` evaluates false, and the script exits 0 — **verification silently skipped, fail-open**. Also net-new: `plugin/.codex-plugin/plugin.json:6` already declares `"hooks": "./hooks/hooks.json"` — the Codex manifest claims hook wiring that has never been certified live; an implementer reading the manifest could mistake this for "hooks work under Codex".
- **Impact:** R2's "Stop-gate delegation requires a certified verification owner" is the right fix but under-specified; the jq fail-open is a today-defect independent of dual-runtime; the manifest's hooks claim is a trap for R3 planning.
- **Correction:** (1) R2 design: the stand-aside branch must additionally verify lease ownership (owner token + certified runtime) once the lease exists; legacy signals alone stop sufficing after migration. (2) File the jq guard as a backlog defect (not fixed in this review). (3) R3: either remove the `hooks` key from the Codex manifest until certification, or gate it behind the capability catalog entry.
- **Acceptance test:** hook conformance corpus (§11) includes: fresh-but-foreign signals (no valid lease owner) → verification RUNS; `jq` absent → exit code signals failure closed; a canary asserting the Codex manifest's declared capabilities match the capability catalog's PROVEN entries.

### P1-2 — No trustworthy spend brake exists for any non-Claude executor, and R4/R7/R11 don't define one

- **Claim:** §5.1 lists "bounded repair and budget ceilings" as mandatory governance parity; R4/R7 gates say "bounded execution".
- **Evidence:** The engine's in-process `agentSpawned` counter is explicitly **not trusted alone** — DR-070 (implement SKILL ~line 75) records it under-counted (68 agents on a 40-cap run); the reliable external brake counts Claude transcript files at `~/.claude/projects/<slug>/<session>/subagents/workflows/<run-id>/agent-*.jsonl` — a Claude-only surface. `budget`/`maxAgents` are Dynamic Workflow injected globals, also Claude-only. Nothing in the proposal names the Codex-side accounting mechanism (config `agents.max_threads`/`max_depth` bound *concurrency/recursion*, not cumulative spend).
- **Impact:** an attended Codex executor (R7) and especially unattended Codex (R11) would run with a weaker spend guarantee than governance parity requires — the exact failure class DR-070 already bit Claude with.
- **Correction:** R4 outputs must include a runtime-neutral spend ledger design (e.g., an append-only counter file in `.pandacorp/run/` advanced by the same shared CLI that records transitions, checked before each dispatch), and Gate R7/R11 must include a live overspend canary (cap N, attempt N+k dispatches, prove the brake trips from the durable ledger, not the executor's memory).
- **Acceptance test:** disposable-fixture run where the executor's in-memory count is deliberately corrupted; the durable ledger still stops dispatch at the cap.

### P1-3 — Safe-point-only handoff is justified, but the proposal doesn't name the in-memory state that dies at handoff, and the liveness signals are asymmetric across runtimes

- **Claim:** §7 revised position permits "handoff only at quiesced safe points; add recovery reconciliation"; §5.2 requires lock ownership and recovery boundaries.
- **Evidence:** The engine's scheduler state is entirely in-memory and non-persistent: `frdState`, `globalQueue`, `doneIds`/`blockedIds`, `gateQueue`/`gatesInFlight`, `convergeQueue`, the serialized `commitChain` (a per-process JS promise chain — the "serialized commit writer" does NOT span processes or runtimes), per-FRD `gateAttempts` (drives the serial-vs-split gate decision; only partially reconstructable from persisted `reopen_count`), `agentSpawned` (spend brake), `consecutiveBlocks` (health breaker — resets to 0 on every launch). Baseline recovery force-removes a stale `gate-worktree` (~line 521) and reconciles IN_PROGRESS by discarding uncommitted work against `last_green_sha` (~545). Liveness asymmetry: `supervisor_heartbeat` is written by the Claude supervisor every ~2 min (Claude-only); the portable signal `last_event_at` advances **only at safe points**, which under a slow attended loop can be > 10 min apart — so a legitimate mid-build Codex attended run would read STALE to a second launcher and to the Stop gate (BL-0030 already flags the Stop-gate half).
- **Impact:** (a) "recovery reconciliation" in R2/R10 must enumerate exactly these structures or the certification scenarios ("crash with IN_PROGRESS WO reconciliation", "orphan gate worktree/journal recovery") will be written against an incomplete list; (b) the health breaker and spend brake having no cross-run memory means a crash-loop (launch → 2 blocks → crash → relaunch) never trips the breaker — worth a durable floor; (c) the lease contract must impose a **renewal cadence obligation on any executor** (attended included), or attended Codex builds will flap between RUNNING/STALE.
- **Correction:** Add to §6.1/§8: the explicit inventory of non-persistent state lost at handoff; a lease renewal cadence (e.g., ≤ TTL/3) required of every certified executor; move `consecutiveBlocks`/spend into the durable run facts at safe points.
- **Acceptance test:** R10 scenario: kill an executor mid-wave, hand off at the next safe point, prove the taker (i) rebuilds the schedule solely from frontmatter, (ii) inherits reopen/health/spend floors from durable state, (iii) never applies a stale in-flight gate verdict.

### P1-4 — "Events are never a state reconstruction source" is false today for achievements/XP, and event_id dedup alone cannot close R9's gate

- **Claim:** §6.1: "Global events are observability transport, never a state reconstruction source." R9 gate: "Mixed-runtime events do not double-count activity or achievements. … Deduplicate by stable IDs."
- **Evidence:** Mission Control derives project/phase/WO/build truth from files — confirmed (`fragua-snapshot.ts:36-44` documents "WO frontmatter decides structure, events decide liveness only"; `guildState.ts:69-95` counts WOs live from frontmatter "never status.yaml's cached counter"). BUT the achievements/gamification subsystem counts the **raw event stream**: `achievements/signals.ts` counts builds/launches/subagents/gate-passes/reviews/findings/peaks from `~/.claude/dashboard-events.ndjson` (read with `cap: 100_000` — effectively the whole retained history); `gamification.ts:574-584` counts `test_ok` events into XP (`XP_PER_GREEN_TEST`). There is **no `event_id` anywhere in the schema** (`events.ts:83-151`; `emit-event.sh:37-43` emits `event/at/project/…` with no `runtime` and no id), no dedup, and the persistent ledger MAX-guards only 3 of ~15+ counters (`workOrdersDone`, `phasesCompleted`, `releases`). Peaks/flags (`maxAgentsPeak`, `earlyBird`, …) are max/OR aggregates over the whole stream — a one-time double-write inflates them permanently.
- **Impact:** R9's own gate cannot be met by its own outputs: if a Codex transport emits its own (legitimately distinct-id) `SubagentStop`-equivalents for work Claude also observed, ID-dedup passes and the counters still double. The §6.1 sentence must be split into "target" vs "current state", or the claim correction table below applies.
- **Correction:** R9 outputs must add: (a) a semantic event vocabulary contract (one emitter definition per event name; a runtime transport maps to it, never invents parallel names for the same act); (b) either ledger/cap the remaining counters like the existing 3, or scope achievement counting to events bearing a certified `runtime`+`run_id` and count each `(run_id, event_name, subject)` once; (c) keep `stats.json`/report-core derivation (git-derived, DR-115-clean) as the pattern to migrate toward.
- **Acceptance test:** cache-not-truth canary extended: append duplicated and vocabulary-variant events to the stream; project state unchanged (already true) AND achievements/XP unchanged (new).

### P1-5 — R6's "remove the replaced Claude mutation branch" has no mechanism for prompt-prose mutations, which is where almost all mutations live

- **Claim:** R6: "Remove the replaced Claude mutation branch in the same cutover. Add a guard that rejects reintroduction."
- **Evidence:** The mutation "branches" are prose instructions inside prompt template strings (P0-1's inventory: the rollup rule alone appears verbatim in ≥7 prompts across `pandacorp-build.js`; the archive protocol, reopen increment, `last_green` ordering are likewise prose). A "guard that rejects reintroduction" of prose has no obvious static form; a model told "update the rollups" by a stale prompt fragment will happily re-become a second writer.
- **Impact:** without a mechanism, R6 slices will silently retain shadow writers — the exact defect class DR-115 §"strongest enforcement is by construction" warns about.
- **Correction:** R6 must specify: shared prompt fragments generated from one canonical source (so the instruction text has one producer), plus a lint over engine sources for the retired instruction patterns (e.g., the rollup-derivation sentence), plus the runtime writer-boundary check (P0-1c). The first slice should be the rollup + status-counts CLI (`pandacorp-rollup`-shaped): it is pure-functional, idempotent, the single most-duplicated mutation, needs no git ownership, and serves both engines and both runtimes.
- **Acceptance test:** after slice 1, a grep/lint proves the derivation prose appears 0 times in engine prompts; corrupting a rollup and running the CLI restores it; the engine harness (54/54) stays green with the CLI-backed prompts.

### P2-1 — Ring numbering and editorial defects in the plan itself

- **Evidence (first-hand):** §10 "R9 — Additive Mission Control adaptation" closes with a gate labeled **"Gate R8"** (README.md:528-533); R8 contains a duplicated line ("Also run independent spikes for: / Run independent spikes for:", README.md:500-502); §4's suite names vs the handoff's commands invert naturally-assumed mapping (the "review-split harness 3/3" is `test-build-engine.mjs`; the "main build-engine harness 54/54" is `test-pandacorp-build.mjs`) — counts verified correct, but the name↔file mapping should be stated to avoid future misreads.
- **Impact:** in a gates-driven plan, a mislabeled gate invites skipping or double-satisfying a gate.
- **Correction:** renumber Gate R9, deduplicate the R8 lines, add the harness name↔file mapping to §4.

### P2-2 — Citation integrity: Goal mode is not documented by any cited source; automations are materially weaker than "scheduled work"

- **Evidence:** All 8 URLs are official (see capability section). But the cited `…/codex/cloud` page does not mention Goal mode at all; Goal is real (`/goal`, `features.goals = true`) yet documented at `developers.openai.com/codex/use-cases/follow-goals` — the proposal's claim rests on a page that doesn't support it. Scheduled tasks/automations are a **ChatGPT Desktop App/Web feature** (no CLI surface), require the app running and the machine awake, and **cannot wake a sleeping machine**; the web variant can't touch local folders between runs. Hooks docs: only `type: "command"` handlers currently execute (`prompt`/`agent` parsed but inert) — acceptable for Pandacorp's command-script hooks, but worth recording in the capability catalog.
- **Impact:** R11's "bounded overnight canary" inherits a hard environmental constraint (machine awake + app running) that changes what "unattended" can honestly promise; a broken citation weakens the proposal's own evidentiary standard.
- **Correction:** fix the Goal citation; add the awake-machine/app-running constraint to R11's design and to the capability catalog entry for scheduled work; record the command-handlers-only hook limitation.

### P2-3 — Manifest parity is enforced on `version` only; every other field is unguarded (and the proposal's fix should enumerate the canaries)

- **Evidence:** `check-derived-drift.sh` Check 1 compares only `.version` between the two manifests; `name/description/author/license/keywords` can silently diverge (currently identical — verified field-by-field). Check 3's `diff -rq` regeneration mechanically catches stale, hand-edited, missing, AND orphan TOMLs (orphan/missing not explicitly exercised in its self-test — add cases). The drift gate runs only as a Claude Stop hook + manual CLI — drift introduced outside a Claude session sits latent.
- **Correction:** R1 as written covers this ("Compare name, version, description…"); add explicit self-test canaries for orphan/missing TOMLs, and note the enforcement point gap (no CI/pre-commit) so R1's "gate is red" claims name *when* it turns red.

### P2-4 — The model-tier mapping is triplicated, and the proposal's model-literal lint scope must name `AGENTS.md`

- **Evidence:** the same haiku/sonnet/opus → `gpt-5.4-mini`/`gpt-5.5`/`gpt-5.5` mapping is hardcoded in (1) `generate-codex-agents.mjs:101-105` + `TIER_WORKERS` at 229-252 (generator constants — §3.3's claim "generic tier workers live in generator constants" CONFIRMED), (2) `factory/standards/agent-portability.md:33-35` (PORT-2 prose table), (3) `AGENTS.md:89` (rule 11 prose). No script cross-checks any pair. §11's lint says "Standards and agents name tiers" — `AGENTS.md` is neither; make it explicitly in scope.
- **Correction:** R1's `model-tiers.yaml` extraction must rewrite PORT-2 and AGENTS.md rule 11 to *point*, not restate; lint scope = repo-wide except the mapping source, generated outputs, and dated history.

### P2-5 — R3's trust model has an unaccounted recurring cost and no rollback path

- **Evidence:** Codex hook trust is **hash-keyed** — any change to a hook re-requires review/trust (official hooks doc). Pandacorp bumps the plugin version frequently (semver discipline, DR-034); every release that touches a hook re-triggers the trust flow on the owner's machine. The rollout §12 has no de-trust/de-install rollback step for the Codex side.
- **Correction:** R3 must state the per-update re-trust burden (owner-facing) and define rollback: disable/untrust plugin hooks, remove project `config.toml` additions, and verify Claude-side behavior unchanged after Codex rollback (rollback principle "roll back a runtime adapter without rolling back canonical state" applies — make it concrete for trust state).

### P3-1 — Coupling census over-counts: `tasks.ts` is dead code

- **Evidence:** `mission-control/src/lib/tasks/tasks.ts` (`readTasksState`) has zero import sites outside its own test; the `TASKS_DIR` config it references doesn't exist in `config.ts`. §3.2 lists "Mission Control live data from Claude-specific event, **task**, and installed-plugin paths" — the task path is currently inert.
- **Correction:** correct the census; separately, Mission Control owners may want to delete or rewire it (out of scope here).

### P3-2 — Adjacent open backlog items the plan should cross-link

- **Evidence:** BL-0025 (parallel-agent races over shared monotonic values — same defect class as the lease problem, hits `implement-backlog` drain-all directly), BL-0040/BL-0041 (Mission Control Manual hand-copies of tables — prior art for the "capability catalog must not become a hand-copied third table" risk), BL-0044 (adhoc-write exemption masks plugin-manifest edits that later red the drift gate — interacts with R1's enforcement points), BL-0062 (decision-id derivation duplicated in prose — same genus as P1-5).
- **Correction:** R1/R8/R9 should reference these so their fixes don't fork.

## Claim correction table

| Proposal claim | Verdict | Corrected wording | Evidence |
|---|---|---|---|
| §3.2 six engine capabilities (artifact-disjoint waves; serialized commit writer; serial+split gates; recovery/bounded repair; safe-point draining; hardening-gated release) | ACCURATE with caveat | Add: "the commit writer is a per-process promise chain over model-executed commits — serialization does not span processes or runtimes; the scheduler and safe-point drain are engine-JS, re-implemented by hand in any attended loop" | `pandacorp-build.js` ~682, ~1002, ~1284, ~1792, ~2015-2022 |
| §6.3 "Today the Dynamic Workflow embeds mutations in agent prompts" | ACCURATE but understated | "…embeds essentially ALL governed mutations in agent prompts (including `phase: release` and a rollup rule duplicated verbatim in ≥7 prompts); the script body cannot perform or directly invoke any deterministic write" | P0-1 inventory |
| §6.1 "Global events are observability transport, never a state reconstruction source" | FALSE as current-state description | "Phase/WO/build truth derives from files (confirmed); the achievements/XP subsystem currently counts the raw event stream with no dedup — a defect to fix in R9, not a property to rely on" | `signals.ts`, `gamification.ts:574-584`, `events.ts:83-151` |
| §8 lock race + Stop-gate hazard | ACCURATE, confirmed mechanically | Keep; add the `jq` fail-open path and the Codex manifest's premature `hooks` claim | `launch-implement.sh:42-48` (blind `set_key`/`touch`, no owner identity), `verify-before-stop.sh:30-56`, `plugin/.codex-plugin/plugin.json:6` |
| §3.1 "Drift-checked only partially" (manifests) | ACCURATE | Add precision: "only `.version` is compared; all other manifest fields are unguarded; the gate fires only at Claude session Stop" | `check-derived-drift.sh:54-59`, `hooks.json:73-77` |
| §3.3 "Model IDs are duplicated and already temporally stale" | ACCURATE | Add: "three uncross-checked locations: generator constants, PORT-2 table, AGENTS.md rule 11" | P2-4 |
| §3.4 routines table | ACCURATE, verified live | Keep verbatim — installed scheduler has exactly `pandacorp-memory-review` + `pandacorp-review-launch`; harvest is inside memory-review; consistency-sweep defined (`plugin/docs/routines.md`) but not deployed | read-only `list_scheduled_tasks`, 2026-07-10 |
| §4 baseline suites table | ACCURATE, re-verified | Add name↔file mapping: review-split = `test-build-engine.mjs` (3), main = `test-pandacorp-build.mjs` (54); the unmatched-label `{}` self-criticism is real (labels: `baseline-precheck`, `pin:*`, `gate-worktree`, `apply-gate:*`) | this session's re-runs |
| §2 official sources | ACCURATE with 2 defects | learn.chatgpt.com is official (redirect target) — cite canonical URLs; Goal mode is NOT documented by the cited cloud page — cite `…/codex/use-cases/follow-goals` | WebFetch 2026-07-10 |
| §5/§9 "Codex initially executes sequentially… denied direct writes after a transition slice migrates" | SOUND, incomplete | Must add: portable spend ledger (P1-2), lease renewal cadence for attended executors (P1-3), prompt-fragment generation for R6 (P1-5) | P1-2/3/5 |
| Handoff: "review-split harness: 3/3 … main build-engine harness: 54/54" | ACCURATE | — | re-run |
| §14 open decision 2 (imports/bundling) framed as unknown | PARTIALLY SETTLED | Imports/Node APIs: NO (runtime contract). Bundling: only as generated single-file script text. CLI-from-script-body: NO. Remaining spike: semantic preservation of a generated bundled engine + subagent-CLI golden tests | Workflow tool contract; P0-1 |

## SSOT/source graph verdict

Verdict on question B: **the proposed source map contains no hard second-writer or cycle**, provided the following table's risks are honored. The real DR-115 exposure is in what the plan *doesn't* rewrite (prose restatements) and in prompt-text duplication (P1-5).

| Fact | Canonical source (proposed/current) | Writer/generator | Outputs/consumers | Drift risk |
|---|---|---|---|---|
| Repo rules | `AGENTS.md` | owner+learn skill | Claude via CLAUDE.md import; native readers | LOW — but rule 11 restates the tier mapping (P2-4): must point, not restate |
| Tier→model mapping | proposed `plugin/runtime/model-tiers.yaml` | learn skill | generator, docs pointers | HIGH today (3 copies); OK if PORT-2 + AGENTS.md become pointers and lint covers repo-wide |
| Codex generic tier workers | proposed `plugin/runtime/codex/tier-workers.yaml` | learn skill | generated TOMLs | LOW once extracted from `generate-codex-agents.mjs:229-252` |
| Plugin metadata | proposed `plugin/runtime/plugin-metadata.json` | learn skill | BOTH manifests generated | LOW if full-field projection gate (P2-3) exists; today only `.version` guarded |
| Agent instructions | `plugin/agents/*.md` | learn skill | generated TOMLs | LOW — regeneration diff already catches stale/tamper/missing/orphan mechanically |
| Skill contract | `SKILL.md` | learn skill | Claude plugin, `.agents/skills` symlink | LOW (symlink drift-checked) |
| Codex skill invocation metadata | `agents/openai.yaml` sidecars (BL-0032) | learn skill | Codex only | LOW — additive, no body duplication |
| WO status | WO frontmatter | today: model prompts; target: shared transition CLI | planner, rollups, MC | HIGH until P1-5 slice lands (rule duplicated ×7 in prompts) |
| Rollups/counts | derived caches | today: model prompts ×7; target: rollup CLI (slice 1) | status.yaml, MC | HIGH today; slice 1 collapses it |
| Phase/run facts | `status.yaml` | launch script + model close-out; target: transition CLI | skills, MC | MEDIUM — `phase: release` write is model-prose gated on a JS boolean |
| Lock | today `running`+heartbeat+`build.lock` (touch); target atomic lease | today: launch script + supervisor; target: lease CLI | both runtimes, Stop gate | CRITICAL today (TOCTOU, no owner identity, standards contradict each other — P0-2) |
| Timeline | `track.jsonl` | agents (append-only) | MC | LOW — append-only, portable |
| Live telemetry | `~/.claude/dashboard-events.ndjson` | `emit-event.sh` + engine prompts + supervisor | MC live route, achievements | HIGH — Claude-path hardcoded, no `runtime`/`event_id`, achievements count it (P1-4) |
| Capability status | proposed `factory/runtime-capabilities.yaml` | learn skill | docs render/pointers | MEDIUM — must not become a third hand-copied table (BL-0040/41 precedent); render, don't restate |
| Routine definition+ownership | `plugin/docs/routines.md` (canonical per its own header) | learn skill | installed schedules = deployments | LOW — red-team's "no separate ownership registry" verdict is correct; add an `owner: claude` field in place |

## Claude regression analysis

- **Dynamic Workflow:** Zero changes proposed before R5/R6, and R6 requires live Claude baselines per slice — correct. The regression risk concentrates in R6's prompt rewrites (P1-5): swapping prose mutations for CLI calls changes prompt behavior; the 54-scenario harness must gain CLI-path scenarios BEFORE the first slice (R0's "repair stale harness coverage" should name this).
- **Supervisor/unattended contract:** untouched by the plan (correct). Note the supervisor is also the `build.lock` refresher and the guaranteed `running:false` writer — any lease migration (R2's "legacy signals as projections") must keep the supervisor's shutdown semantics byte-compatible or Claude's own Stop gate behavior changes.
- **Hooks and Stop gate:** the "one policy + payload adapters" direction is viable — verified: every gate script does its `jq` extraction up front and never re-touches the payload, so thin adapters can reuse the policy bodies unmodified. Hard-deny cannot rely on hooks alone under either runtime: `block-dangerous.sh` is literal-substring matching (`grep -E` on `tool_input.command`) — it does not see through `bash script.sh` indirection, interpreter one-liners (`python3 -c "shutil.rmtree(…)"`), encodings, or variable indirection. Defense in depth (sandbox/permissions/execpolicy on the Codex side, deny rules + settings on the Claude side) is mandatory, as the proposal already says. Claude golden hook tests (54/13/8/12) re-ran green in this review.
- **Plugin cache/restart:** installed cache verified at 9.85.0 = source. R0's "installed plugin updated and restarted in a fresh session" gate is right; add: the drift gate only fires at Claude session Stop, so cache/source drift introduced by non-Claude edits stays latent until the next Claude session (P2-3).
- **Overlay/project copies:** the engine under review is the template copy (`plugin/templates/shared/.claude/engines/`); deployed projects hold overlay copies at their own `overlay_version`. R6 slices change the template — the plan doesn't say how in-flight projects with older overlay engines behave against a migrated shared CLI. Add an overlay compatibility note to R6 (CLI must be backward-compatible or version-gated via `gate-config` detection, which exists: `detect-gate-config-newer.sh`, 8/8 green).
- **Mission Control:** additive dual-read direction is right; P1-4's achievements exception and P3-1's dead code are the census corrections; FRD-15 needs a two-surface (Claude+Codex) sync verdict design in R9.
- **Routines:** no regression — plan explicitly leaves both deployed routines Claude-owned; verified live that only those two exist. R10's "no duplicate routine schedules" scenario is the right guard; ownership lives with the routine definition (no new registry) per the red-team verdict — endorsed.

## Codex capability verdict

Statuses are **for this repository's contracts**, not for the product features in the abstract. "UNKNOWN" = requires a mutation this review was not allowed to perform; the spike is named.

| Capability | Status | Repository proof required | Safe fallback |
|---|---|---|---|
| Skills discovery via `.agents/skills` | PROVEN (product docs + healthy symlink + prior P25 verification) | R3 smoke: `/skills` lists 25 | read SKILL.md directly |
| Native subagents (TOMLs) | EXPERIMENTAL | Docs confirm subagents + project `.codex/agents/` TOMLs exist; **invocation from a skill is instruction-driven/best-effort, not a callable API** — spike: measure named-agent compliance rate on a disposable fixture | inline sequential work (PORT-3) |
| Hooks enforce deny/Stop | UNKNOWN | Official events include `PreToolUse`/`Stop`; only `command` handlers execute today; blocking semantics of `Stop` handlers and shell-path coverage undocumented — spike: R3 live cert from installed+trusted plugin cache, CLI and app | Codex stays read/review-only (R3's own rule) |
| Plugin install/trust from repo-local marketplace | UNKNOWN (docs confirm the mechanism exists) | R3: install from `.agents/plugins/marketplace.json` path, hash-trust flow, re-trust on update (P2-5) | manual per-machine hook registration |
| `config.toml` bounds (depth/threads/sandbox/permissions/approvals) | PROVEN as product feature; UNPROVEN here (no `.codex/config.toml` exists — confirmed) | BL-0031/R3: author + verify a denied pattern is refused with hooks absent | rely on hooks + instructions (weaker; documented) |
| Scheduled automations | FALLBACK at best for this repo | App-only, machine awake, no wake-from-sleep, web variant can't touch local repo | Claude remains scheduler owner (already decided) |
| Goal mode continuity | EXPERIMENTAL | Real feature (`features.goals`), mis-cited (P2-2); R8 spike for continuity/steering/sleep | attended sequential |
| Cloud tasks | EXPERIMENTAL | Isolated sandboxes; no bearing on local `.pandacorp` state | n/a |
| Codex parallel writes via worktrees | UNSUPPORTED (policy) | DR-060 chose shared-tree+disjoint+one-writer; needs its own ADR + E2E (proposal already says this — endorsed) | sequential |
| Cross-runtime lease/handoff | UNSUPPORTED today | R2 lease + R10 certification | no handoff; one runtime per project until R2 |

## Atomic lease recommendation

Answering open decision #4 and question E. **The repo already contains the correct primitive:** the product merge queue uses atomic `mkdir` as a mutex (`factory/standards/build-orchestration.md` ~line 1179). Reuse that pattern; do not invent.

- **State model:** lease = directory `.pandacorp/run/lease/` containing `owner.json`: `{run_id, runtime, executor, owner_token (random ≥128-bit), acquired_at, heartbeat_at, ttl_s, capability_version, verification_owner}`.
- **Acquire:** `mkdir .pandacorp/run/lease` — atomic on local APFS/HFS+ (POSIX guarantees; document the local-filesystem assumption; network filesystems out of scope for a solo-operator machine). On success, write `owner.json` (temp file + `mv`). On `EEXIST`, read `owner.json` and report the live owner. `O_EXCL` file creation is an equivalent alternative; `mkdir` wins on in-repo precedent.
- **Heartbeat/renew:** rewrite `owner.json` (temp+`mv`) only if the on-disk `owner_token` matches yours; cadence ≤ TTL/3, **required of every certified executor including attended ones** (P1-3).
- **Stale reclaim:** fail-closed and deterministic: reclaim only when `now - heartbeat_at ≥ ttl_s` AND legacy signals (`supervisor_heartbeat`, `last_event_at`, `build.lock` mtime) are also ≥ TTL. Reclaim = write a tombstone (`reclaimed_from: <old owner.json>`, appended to `track.jsonl` or a lease journal), then atomically replace `owner.json` with the new owner (same compare-and-swap discipline: re-read after write to detect a race, or reclaim via `mkdir lease.reclaim.<token>` election). Never silently `rm` the lease dir of a live-looking owner.
- **Release:** compare `owner_token`, then remove `owner.json` and `rmdir` the lease dir. Non-matching token → refuse loudly. Release must run on every terminal path (the Claude supervisor's guaranteed last act today; the attended loop's exit discipline under PORT-5).
- **Stop-gate delegation:** `verify-before-stop.sh`'s stand-aside branch gains: fresh signals alone suffice only in legacy mode; in lease mode it must read `owner.json` and stand aside only for a **certified** `verification_owner` (runtime+capability_version listed PROVEN in the capability catalog). A crashed/uncertified Codex contender therefore cannot suppress Claude verification (Gate R2's fourth bullet — this is the concrete mechanism). Fix the `jq` fail-open in the same slice (P1-1).
- **Compatibility migration:** while the flag is on, the lease writer also projects `running: true`, `supervisor_heartbeat`/`last_event_at`, and touches `build.lock` so legacy readers (Stop gate, preflight, Mission Control) behave identically; preflight learns to read the lease first, legacy second; the projection is removed only after all readers migrate (one writer for the legacy keys = the lease service, satisfying DR-115 during the overlap).

## Revised rollout verdict

| Ring | Verdict | Prerequisites | Evidence to advance | Rollback |
|---|---|---|---|---|
| R0 | **MODIFY** | none | add: (a) owner-gated standards hotfix retracting PORT-5/AGENTS.md lock+resume claims (P0-2) — this is the true first slice; (b) harness coverage repair must name the unmatched labels (verified real) and add CLI-path scenarios ahead of R6; (c) record harness name↔file mapping | git revert of docs; no state touched |
| R1 | **GO** (with P2-3/P2-4 scope) | R0 | two byte-identical generations; full-field manifest projection; orphan/missing TOML canaries in the self-test; model-literal lint covering AGENTS.md; BL-0040/41 cross-linked | regenerate from previous sources; projections are disposable |
| R2 | **GO** (design per lease recommendation) | R0 | two-contender barrier test single winner; non-owner release refused; deterministic fail-closed reclaim; Stop-gate certified-owner canary incl. crashed-contender and jq-absent; Claude live canary green in legacy mode | feature flag off → legacy signals path unchanged |
| R3 | **MODIFY** | R1, R2 | add: per-update hash re-trust burden stated; de-trust/rollback path; Codex manifest `hooks` claim gated by capability catalog; "I have a bug"→`change` routing test; Claude golden hook tests untouched | untrust/disable Codex plugin hooks; remove config.toml additions; verify Claude unchanged |
| R4 | **GO** (add spend ledger design, P1-2) | R3 | simulation trace invariants incl. budget-from-durable-ledger; recorded intents only | discard simulation |
| R5 | **MODIFY** (re-scope per P0-1) | R0 | imports/CLI-from-body already answered NO by the runtime contract; spike = generated-bundle determinism + semantics + resume, and subagent-CLI golden equivalence | no production surface touched |
| R6 | **MODIFY** (prompt-fragment mechanism per P1-5; overlay compatibility note) | R5 GO shape | slice 1 = rollup/status-counts CLI; prose-rule lint at 0 occurrences; 54/54 + live canary green; overlay version gate for older deployed engines | flag off restores prose path only if the prose fragment is still generated — otherwise revert commit; never leave both active |
| R7 | **MODIFY** (lease renewal cadence + spend ledger as gate criteria) | ≥1 R6 slice fully cut over | disposable-fixture full contract; writer-boundary static+runtime checks; Claude branch absent | Codex loses write permission; Claude executor unaffected (its branch already migrated — revert = R6 rollback) |
| R8 | **GO** (cross-link BL-0025; note engines share zero code so shared CLIs serve both) | R7 for governed writes; spikes independent | drain-all E2E on throwaway repo or explicit Claude ownership recorded with reevaluation trigger | keep Codex single-item mode |
| R9 | **MODIFY** (renumber gate; P1-4 achievements mechanism; FRD-15 two-surface design; La Fragua vocabulary contract) | R1 (schema fields) | legacy sessions render; duplicate/vocabulary-variant replay changes neither state nor achievements; stream mutation cannot change project state | dual-reader off → Claude path only |
| R10 | **GO** (scenarios complete; add jq-absent + crashed-uncertified-contender cases) | R2-R9 as applicable | all listed live scenarios on disposable fixtures | per-ring rollbacks |
| R11 | **MODIFY** (machine-awake/app-running constraint; unattended spend brake prerequisite from P1-2) | R0-R10 | bounded canaries with the environmental constraints documented; failure honestly leaves attended mode as supported | attended sequential remains |
| **Overall** | **MODIFY** | — | reconcile P0/P1 findings; owner decisions below | — |

## Required tests

Executable now (exist, re-run green this review): the 7 baseline suites + `check-derived-drift.sh`.

New tests to write (source-level, no runtime mutation needed):
1. Lease barrier test: N contenders `mkdir` simultaneously → exactly one winner, losers' writes rejected (shell-level, disposable dir).
2. Non-owner release and stale-reclaim race tests (compare-token discipline).
3. Stop-gate certified-owner corpus: foreign fresh signals without valid lease → verification runs; crashed Codex owner.json → verification runs; legacy mode unchanged.
4. `verify-before-stop.sh` with `jq` removed from PATH → fails closed (currently fails open — will be red until fixed; that is the point).
5. Full-field manifest projection test + orphan/missing TOML canaries added to `test-check-derived-drift.sh`.
6. Model-literal lint (repo-wide, allowlist: mapping source, generated outputs, dated history) — will be red today on PORT-2/AGENTS.md/generator until R1.
7. Rollup CLI golden tests (slice 1): same fixture → identical mutations when invoked directly vs via a subagent transcript replay; corrupt-cache restoration; prose-rule lint at 0 in engine prompts.
8. Events replay canary: duplicate lines + vocabulary variants appended to a fixture stream → project state AND achievements/XP unchanged.
9. Engine-harness coverage repair: matchers for `baseline-precheck`, `pin:*`, `gate-worktree`, `apply-gate:*` (today answered `{}`).
10. Spend-ledger overspend canary (simulation level at R4; live at R7).

Live canaries requiring future gated mutation (marked UNKNOWN in this review; never run here):
- Codex plugin install/enable/trust from the repo-local marketplace; hook payload capture in CLI and app; dangerous-command deny through every Codex shell path (R3).
- Named-subagent invocation compliance rate from a skill (R4/R8 spike).
- Goal continuity, app sleep/restart/network loss, automation behavior on a disposable fixture (R8/R11).
- Claude installed-workflow canary on a disposable sibling fixture with `maxAgents`/spend ceiling fixed (R0 gate; explicitly deferred to an implementation/certification turn).
- Cross-runtime safe-point takeover both directions; simultaneous acquisition; stale reclaim (R10).

## Backlog reconciliation

No statuses were edited in this review.

- **BL-0030** (port enforcement hooks to Codex, open, p1): **expanded** by Proposal 32 into R3 with harder acceptance (live installed-cache certification). Its two concrete mismatches (apply_patch vs Write|Edit matcher; `build.lock` vs heartbeat signal for the Stop gate) are confirmed real by this review and P1-3 adds the renewal-cadence dimension. Keep open; re-scope to R3 language when the proposal is revised.
- **BL-0031** (`.codex/config.toml` rules/profiles, open, p2): **absorbed** into R3 outputs. Confirmed no `.codex/config.toml` exists today. Keep open.
- **BL-0032** (`agents/openai.yaml` sidecars, open, p2): **absorbed** into R3 outputs and §6.2's source graph (sidecars = Codex-only metadata, no body duplication — DR-115-clean). Keep open.
- **New actionable gaps surfaced by this review** (candidates for `BL-*` filing by the owner/Codex revision — NOT filed here): (1) `verify-before-stop.sh` jq fail-open guard; (2) PORT-5/AGENTS.md stale lock+resume claims retraction (P0-2 — needs `learn`); (3) full-field manifest drift + orphan/missing TOML self-test canaries; (4) model-tier triple duplication extraction; (5) event schema `runtime`/`run_id`/`event_id` + achievements dedup/ledger; (6) Codex manifest premature `hooks` claim; (7) `tasks.ts` dead code removal or rewiring; (8) engine-harness unmatched-label coverage.
- **Adjacent existing items to cross-link:** BL-0025 (shared monotonic-value races — R8 drain-all), BL-0040/BL-0041 (hand-copied Manual tables — capability catalog precedent), BL-0044 (exemption masks manifest edits — R1 enforcement point), BL-0062 (prose-duplicated derivation — same genus as P1-5).

## Owner decisions

Only decisions that genuinely require the owner:

1. **Standards hotfix before anything else (P0-2):** approve retracting the cross-runtime lock/resume claims in `agent-portability.md` + `AGENTS.md` via `/pandacorp:learn`, and the interim rule "Codex read/review-only on projects with build state" until Gate R2. This is a normative change; no agent may self-approve it.
2. **Constitution §14 (question D): CLARIFY — not KEEP silent, not CHANGE.** §14's text ("the work-order loop lives in the script → resumable and deterministic"; "native Claude Code script") names the Claude vehicle and the orchestration properties; it does not literally forbid the workflow's subagents from invoking shared deterministic CLIs (the engine already delegates to `verify.sh`/`launch-implement.sh`). Proposed clarification for owner approval: "The Dynamic Workflow remains the Claude executor and the orchestration decision-maker; deterministic state transitions may be delegated to shared, versioned, test-covered CLIs invoked under its instruction; an equivalent non-Claude executor must satisfy the same contract (PORT-5) — the workflow requirement binds Claude's vehicle, not the ownership of transition logic." Affected claims: §14 itself; `dynamic-workflows.md:3`; `implement/SKILL.md` DR-013 line.
3. **Codex V1 shape (question H):** endorse the proposal's answer — read/review-only now; attended sequential with governed writes only after R2+R3+ one R6 slice; worktree parallelism only via a future ADR (DR-060). The owner should ratify this as the operating rule because it constrains how they may use Codex day-to-day.
4. **If R5's realistic outcome is NO-GO on a shared executable core** (likely, per P0-1): accept "Claude engine stays canonical for orchestration indefinitely; sharing = schemas + read-only resolvers + shared transition CLIs + generated contracts" as a *stable end state*, not a failure. This caps the project's ambition and should be a conscious owner choice.
5. **R11 appetite:** given automations cannot wake a sleeping machine and require the desktop app running, decide whether unattended Codex is still worth its certification cost, or whether "Claude owns unattended; Codex owns attended/review" is the durable division (reevaluation trigger: Codex ships wake-capable local scheduling).
6. **Trust burden (P2-5):** accept that every plugin update touching hooks re-triggers a manual Codex trust flow on the owner's machine, or scope Codex hooks to rarely-changing policy scripts.

## Final recommended architecture

The smallest architecture that satisfies both runtimes without split truth — a reduction of Proposal 32 §9, honoring P0-1:

1. **Claude engine stays canonical for orchestration** (both engines, unchanged semantics). No shared-core extraction unless the re-scoped R5 proves the generated-bundle shape preserves semantics — and even then, only pure functions.
2. **Shared deterministic transition CLIs under `plugin/scripts/`** become the single writers, slice by slice (first: rollups + status counts; then `last_green` stamping; then archive protocol). Claude's engine calls them via its subagents (prompt fragments generated from one source); Codex calls the same CLIs from its agents or attended loop. Enforcement = path/key writer-boundary checks + prose lint, not call-graph control.
3. **One atomic lease** (mkdir-based, owner token, renewal cadence, certified verification owner) replaces the TOCTOU trio behind a compatibility projection; Stop gate delegates only to certified owners; preflight reads the lease first.
4. **Codex = read/review first, attended sequential second** (after R2+R3+slice 1), no shared-tree parallelism without an ADR; `implement-backlog` gets its own decision (R8) with Claude as drain-all owner unless the E2E proves otherwise.
5. **Telemetry made runtime-neutral additively** (`runtime`/`run_id`/`event_id` + vocabulary contract + achievements ledgering); state never derives from it — after the achievements exception is fixed, this sentence becomes true.
6. **All volatile shared facts extracted to machine-readable sources** (model tiers, tier workers, plugin metadata, capability status) with deterministic generators, full-field projection gates, and prose rewritten to point — never restate.
7. **Both deployed routines stay Claude-owned**, ownership recorded in `plugin/docs/routines.md` itself; no Codex automations for them; `pandacorp-consistency-sweep` remains defined-not-deployed until the owner deploys it.

This preserves Claude behavior byte-for-byte until each slice's cutover, gives Codex a real (not aspirational) write path gated on certified enforcement, and keeps exactly one source per fact and one writer per state transition at every intermediate step — which is the property the owner actually asked for.
