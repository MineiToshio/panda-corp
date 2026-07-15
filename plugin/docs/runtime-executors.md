# Runtime executors

## R5 decision — stable NO-GO for a shared orchestration bundle

The installed Claude Dynamic Workflow cannot import a module, access Node APIs, or invoke a CLI from
its JavaScript body. Pure source bundling would duplicate an orchestration program while still forcing
every durable write through an agent model roundtrip. R5 therefore records a stable **NO-GO** for a
shared orchestration bundle. Claude's single-file Dynamic Workflow remains its native controller;
Codex uses `plugin/runtime/codex/executor.mjs`. They share schemas, generated prompt fragments,
atomic lease/fencing, durable ledger and deterministic transition functions. This is the intended
stable architecture, not a degraded temporary fork. The decision is evidence-backed: the installed
Dynamic Workflow contract exposes injected orchestration globals but no Node module/filesystem/process
surface; the generated prompt-fragment and shared-CLI tests preserve deterministic transitions without
pretending the Claude controller can import the Codex executor.

This platform boundary also means Claude stop inspection is invoked by a Claude subagent. The engine
validates its receipt fail-closed, and the installed 9.95.2 qualification proves the real expected
path under hostile aliases, but no document claims cryptographic provenance for every future agent
tool call. BL-0074 tracks a possible native host seam as non-blocking hardening. R10/R11 evaluate the
observable executor contracts and cold file-state handoff; they do not require the two executors to
share a mechanism or remove Claude's native model-agent boundary.

Claude receives the shared state writer as an explicit installed capability: `launch-implement.sh`
realpath-validates the regular file before lease acquisition and serializes its absolute path as
`args.stateCli`. The engine validates it before spawning an agent and shell-quotes it in every
governed state command. This avoids relying on `CLAUDE_PLUGIN_ROOT`, which installed Workflow
subagents do not reliably inherit, without sharing either runtime's orchestration controller.

## Codex executor

### Promoted surface: `attended_foreground` (EXPERIMENTAL)

Codex project writes are available only through the intentionally narrow canonical
`EXPERIMENTAL/attended_foreground/targeted-only` profile. The official launcher accepts exactly one
normalized FRD OR one exact ready-change target, foreground only, with cumulative duration at most
7200 seconds and zero automatic restarts. It issues a one-run attended permit bound to the project,
logical run, exact target and ceilings; launcher, supervisor and executor each validate the profile
and consume their stage before lease-owned mutation. Direct controller invocation, missing or
ambiguous scope, background mode and larger duration fail closed.

The profile implements sequentially with Codex STANDARD, reviews independently with Codex JUDGE,
reruns `verify.sh` and requires a parsed green mutation receipt. Missing, timed-out, ambiguous or
below-threshold mutation evidence cannot stamp `VERIFIED` or `last_green_sha`. It appends owner-facing
milestones to `.pandacorp/comms/progress.md` and timings to `.pandacorp/track.jsonl`. On success or
bounded stop it quiesces/releases and keeps `phase: implementation`; bare/global drain, project-wide
hardening, `phase: release`, background/unattended/overnight execution and Claude cross-runtime
continuation remain outside the promotion.

Claude's Dynamic Workflow, agents, supervisor and capabilities are unchanged. The Codex executor
never invokes Claude and this profile does not require R10/R11 cross-runtime or overnight evidence.

`launch-codex-implement.sh` starts a controllable local supervisor and records it in an atomic receipt.
The profile requires `foreground`: the launcher remains alive as the process-tree owner,
forwards INT/TERM/HUP and waits for the supervisor. Sleep inhibition/background support exists only
for the separate certification machinery and is not normal attended authority. The receipt records
the launch mode, execution profile, launcher/child PIDs and exact resume argv. The executor uses only
`codex exec --ignore-user-config --json --output-schema` child processes: unrelated user MCPs cannot
control the run, while project-local Codex config/rules remain mandatory. Strict config and the
workspace-write sandbox apply; approval/sandbox bypass flags never do. Work is sequential in the shared checkout.
STANDARD implements one WO; a separate JUDGE reviews each FRD and runs the project gate. The
controller parses the mandatory Build Plan DAG table and rejects dependency drift against WO
frontmatter. Dispatch, spend, health, commit ownership, retry attempts, checkpoints and uncertain
outcomes are durable. An uncertain dispatch is never retried blindly: it persists a decision and
quiesces. Provider failures persist only a sanitized `error_class` (`usage_limit`, `rate_limit`,
`auth`, `approval`, `network`, or `unknown`) plus exit/timeout facts; raw child diagnostics are never
written to durable state. Reviewer tests survive a rollback under `.pandacorp/run/preserved-tests/` and are injected
as the RED baseline of the next bounded pass.

Worker ownership uses before/after content snapshots, not path-set attribution. During a dispatch,
lease renewal continues normally. A change to `status.yaml` is ignored only when the active Codex
token/epoch still passes the fence, the lease is fresh, and the complete diff normalizes to the exact
lease-derived projection (`phase`, `running`, acquisition time, logical run, runtime, epoch and
heartbeat), with exactly one occurrence of every field. Any other status value, duplicate projected
key, FRD or WO mutation remains a fail-closed `OWNERSHIP` violation.

Terminal handling is controller-owned. SIGINT/SIGTERM/SIGHUP first quiesce the active Codex process
group; the main controller alone then records the terminal reason and performs the two-phase release:
fenced `quiesce` → precise `status.yaml` commit → fenced `finalize-release`. Claude terminal prompts
use the same protocol. This keeps the lease alive across the commit boundary and prevents a second
writer from entering the checkout during finalization.

Project-wide hardening is reachable only from a bare whole-project run after every global WO is
verified. Targeted FRD/change runs persist terminal `complete`, quiesce and release the lease while
keeping `phase: implementation`, even when their target happened to be the final global pending WO;
this prevents a scope-limited invocation from authorizing an audit/fixer over unrelated features.
On the bare path, hardening preserves reviewer independence: a JUDGE performs a mechanically read-only audit; a
separate STANDARD implementer applies fixes/evidence; the controller checks the dated security report,
telemetry `## Verification` and full deterministic gate. A false-green candidate is committed only as
a rollback unit, immediately reverted, and cannot advance the phase.

## BL-0081 promotion verdict — attended target GO

The offline disposable harness is green for the controller contract, including precise staging,
Build Plan drift, no-blind-retry uncertainty, owner quiescence, multipass rollback, preserved-test
reuse, budget/rethink/breakers, hardening separation, process-group shutdown, post-dispatch signal
races, two-phase release, and supervisor terminal-reason handling. The usage limit later cleared and
R11's real disposable `LIVE_SHORT` canary completed two provider dispatches and the full controller
close-out. That closes the old R7 live-transport blocker. It still does **not** promote Codex
`implement` to unrestricted `PROVEN`: cross-runtime and several-hours unattended execution remain
open.

The dedicated installed canary `codex-attended-99510-final`, pinned to factory
`792d96ac7134ca0dc580055383ac160ea2109b93` and plugin 9.95.10, completed run
`codex-20260715T151508Z-99530` at clean final HEAD
`9c2ea16c5b82a7df71b3eb793e0bd4c57554399b`. It recorded exactly one green STANDARD worker and one
green independent JUDGE, a green deterministic gate, mutation score 100% (2/2 killed), complete
whole-FRD traceability, reachable `last_green_sha: 05489da`, terminal `complete`,
`phase: implementation`, `running: false` and a released lease. The independent postflight is green.
Its audit runner calls a project-relative mutation script, so the audit must run with the fixture as
CWD; an outside-CWD invocation is a harness error, not product evidence.

Capability policy is therefore `EXPERIMENTAL` with `profile: attended_foreground` and
`scope: targeted-only`. It remains deliberately narrower than unrestricted `PROVEN`: cross-runtime,
bare/global, hardening/release, background and unattended execution remain unavailable.

## R8 product change-queue verdict — offline contract green

The Codex controller now drains `status: ready` product change cards through a proposal-only JUDGE
planner and a fenced deterministic applier. Bare runs drain the queue; `--change` drains exactly its
target; `--frds` drains none. A card becomes `building` only after the canonical FRD/blueprint/WO plan
passes the Build Plan DAG checks, and moves to `done/` only after every affected FRD is VERIFIED and
the integration commit evidence is still canonical.

The controller treats cards and documentation as protected paths, not ordinary model output. The
changes root, card, `done/`, affected FRD and work-order parents, and every existing/missing mutation
target are checked with `lstat` + `realpath`; symlinks and out-of-tree parents fail closed. Archive
never overwrites an existing target. Transaction replay revalidates the complete plan and its canonical
archive target. Integration evidence is bound to the current HEAD, every exact planned mutation path,
and the committed content—not merely any commit touching the affected FRD. The card is also bound to
the digest of its completed durable apply transaction; card path-list or journal tampering fails
closed. Only controller-owned progress keys inside the leading YAML frontmatter are normalized during
post-integration comparison; same-looking Markdown body content remains evidence.

Crash recovery is journaled at `prepared`, every mutation and card/archive boundaries. The executor
corpus proves that each partial apply resumes without redispatching the planner and produces exactly
one integration commit. Every archive path—including `status: done` re-entry and transaction replay
after an `archive-card` crash—runs the same SHA, required-path and current-content validator before
rename. Offline evidence on 2026-07-11: `test-build-state.mjs` **21/21** and
`test-codex-executor.mjs` **23/23**. R8 therefore removes `R8-ready-change-drain` as a promotion
blocker. R10 installed-runtime switching and R11 overnight certification remain binding only for
their broader cross-runtime/unattended capabilities, not for `attended_foreground`.

Factory backlog drain-all is a separate R8 decision. Its Claude engine corpus is green (26/26), but Codex
still supports only single-item mode; `plugin/runtime/codex/R8-BACKLOG-SPIKE.md` records the explicit
Claude ownership and reevaluation gates. Product queue parity does not imply backlog drain-all parity.

## R10 sequential runtime-switch verdict — two installed attempts NO-GO, fixture C pending

PORT-5's evidence path uses a certification-only one-shot permit, not general write permission. The
foreground launcher validates the versioned fixture and owner authorization against the exact Stage
2 HEAD, FRD, limits and runtime pins; it consumes the nonce before ownership and revokes it on exit.
Its engine pin reads only the regular, versioned `.claude/engines/pandacorp-build.js` installed by the
overlay; the permit has no alternate engine path, and non-consuming checks never disclose the nonce.
The permit also binds the regular Stage-1 evidence to the current HEAD and released Claude projection,
then requires the shared resolver to return the same logical run as an automatic cross-runtime cold
continuation before authorization can be consumed.

The runtime-neutral state and lease contract now has a bidirectional disposable-project harness at
`plugin/scripts/test-runtime-switch.mjs`. It exercises the real `build-state.mjs` APIs and proves that
a Claude owner can quiesce and finalize before a later Codex owner acquires a newer fenced epoch, and
that the inverse direction preserves the same VERIFIED work-order truth. It also covers simultaneous
acquisition, non-owner release, stale reclaim and zombie fencing without a shared transcript, live
takeover or runtime-to-runtime messaging. Companion source and executor suites cover orphan
`IN_PROGRESS`, durable budget/health state, terminal enforcement, preserved tests, hardening and
orphan worktree/journal recovery.

The first installed canary is preserved as **partial GO / overall NO-GO**. Installed Claude 9.92.5
completed and independently verified FRD-A, committed a clean safe point and released epoch 2.
Installed Codex 9.92.5 then acquired epoch 3, reserved `implement-WO-B-001-p0` and persisted its start,
but Codex Desktop reaped the detached background worker. Epoch 4 recovery correctly stopped
`needs-owner`, never duplicated the ambiguous dispatch and released the lease. Those safety
properties are green, but FRD-B was never implemented or reviewed, so the switch did not complete.

BL-0065/plugin 9.92.6 adds foreground-owned process lifetime for ephemeral shells. Fixture B then
proved that lifetime under the installed Codex Desktop host: Codex retained the same logical run,
acquired epoch 2 and completed WO-B implementation. It is still an overall NO-GO. Claude Stage 1
published a gate-worktree `last_green_sha` that was not an ancestor of main, and Codex's independent
JUDGE review ended uncertain with sanitized class `usage_limit`; the executor did not retry, released
the lease and left `running: false`. BL-0066 and BL-0067 fix the green-snapshot and crash-evidence
contracts in plugin 9.93.0 / overlay 8.74.0, but fixture B remains immutable failed evidence.

Certification may restart on a distinct clean fixture C if cross-runtime continuation is pursued.
The installed R10 retry and R11 unattended canary remain gates for that broader promotion. Codex
`implement` now has only the separate EXPERIMENTAL Codex-only
`attended_foreground` target. The two deployed recurring routines and
factory-backlog drain-all remain Claude-owned. Full evidence and
retry requirements are canonical in `plugin/runtime/codex/R10-CERTIFICATION.md`.

Cold continuation uses one logical build `run_id` across runtimes. Both launchers consume the same
resolver and automatically inherit this durable key only from a released cross-runtime
`phase: implementation` safe point; the owner never copies an ID. Same-runtime passes, terminal
release state and explicit `new` intent start a new run. Runtime-local process/session identities stay
local. Preflight reports the resolver's intent before launch. The R10 fixture proves automatic
resolution, idempotent dispatch replay and overspend
rejection after both directions of switch.

## R11 unattended verdict — accelerated and short live green; overnight pending

The unattended path now has a fail-closed preflight for real project layout, clean baseline, host,
credentials, HTTPS reachability, workspace-write sandbox, sleep prevention and Claude-only ownership
of the two deployed routines. The launcher starts the supervisor as the controllable process, binds a
separate sleep inhibitor to its PID, health-checks both, and writes an atomic JSON receipt with an argv
array that preserves paths containing spaces. Supervisor restart uses bounded backoff and a crash
circuit breaker; executor renewal is mechanically constrained to `<= TTL/3`.

BL-0077 also makes the launcher consult the canonical capability policy before any build path. The
promoted attended single-target profile needs no R11 authorization; every R11 unattended/multi-FRD
certification run still requires a distinct one-shot foreground permit bound to a standalone canary,
exact HEAD/UUID, plugin/overlay, executor,
supervisor and launcher hashes, exact multi-FRD scope and limits. It is consumed before lease ownership
and revoked on terminal/recovery; R10 keeps its existing schema and receipt unchanged.

`test-codex-unattended.mjs` is the `OFFLINE_ACCELERATED` failure corpus (14/14), including foreground
launcher liveness and signal propagation. The real disposable
current-head `LIVE_SHORT` run `codex-20260711T183105Z-28552` is green: 114 seconds, two real
dispatches, four durable spend units, controller verification, a 120000 ms heartbeat within `TTL/3`,
supervisor terminal, fenced release, and no implementer dispatch for its already-VERIFIED WO. The
disposable fixture was removed and the exact summary lives in
`plugin/runtime/codex/evidence/r11-live-short-2026-07-11.json`.

This evidence is intentionally **not** `LIVE_OVERNIGHT`. The unattended gate stays open until a
representative multi-FRD run completes at least three real wall-clock hours without owner interaction,
followed by the cold return canary. Commands, evidence retention and the fail-closed collector are in
`plugin/runtime/codex/R11-CERTIFICATION.md`.
