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

## Codex executor

`launch-codex-implement.sh` starts a controllable local supervisor and a separate PID-bound sleep
inhibitor (`caffeinate -w` on macOS), recording both in an atomic receipt. The executor uses only
`codex exec --ignore-user-config --json --output-schema` child processes: unrelated user MCPs cannot
control the run, while project-local Codex config/rules remain mandatory. Strict config and the
workspace-write sandbox apply; approval/sandbox bypass flags never do. Work is sequential in the shared checkout.
STANDARD implements one WO; a separate JUDGE reviews each FRD and runs the project gate. The
controller parses the mandatory Build Plan DAG table and rejects dependency drift against WO
frontmatter. Dispatch, spend, health, commit ownership, retry attempts, checkpoints and uncertain
outcomes are durable. An uncertain dispatch is never retried blindly: it persists a decision and
quiesces. Reviewer tests survive a rollback under `.pandacorp/run/preserved-tests/` and are injected
as the RED baseline of the next bounded pass.

Terminal handling is controller-owned. SIGINT/SIGTERM/SIGHUP first quiesce the active Codex process
group; the main controller alone then records the terminal reason and performs the two-phase release:
fenced `quiesce` → precise `status.yaml` commit → fenced `finalize-release`. Claude terminal prompts
use the same protocol. This keeps the lease alive across the commit boundary and prevents a second
writer from entering the checkout during finalization.

Hardening preserves reviewer independence: a JUDGE performs a mechanically read-only audit; a
separate STANDARD implementer applies fixes/evidence; the controller checks the dated security report,
telemetry `## Verification` and full deterministic gate. A false-green candidate is committed only as
a rollback unit, immediately reverted, and cannot advance the phase.

## R7 certification verdict — live transport green; promotion still gated

The offline disposable harness is green for the controller contract, including precise staging,
Build Plan drift, no-blind-retry uncertainty, owner quiescence, multipass rollback, preserved-test
reuse, budget/rethink/breakers, hardening separation, process-group shutdown, post-dispatch signal
races, two-phase release, and supervisor terminal-reason handling. The usage limit later cleared and
R11's real disposable `LIVE_SHORT` canary completed two provider dispatches and the full controller
close-out. That closes the old R7 live-transport blocker. It still does **not** promote Codex
`implement` to PROVEN: the installed bidirectional R10 canary and a real several-hours R11
`LIVE_OVERNIGHT` canary remain mandatory.

Therefore `skill-capabilities.json` correctly keeps Codex `implement` at `FALLBACK`. The existence of
the executor, its mock suite and a short provider success do not grant production build-write permission.

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
blocker; R10 installed-runtime switching and R11 overnight certification remain binding.

Factory backlog drain-all is a separate R8 decision. Its Claude engine corpus is green (26/26), but Codex
still supports only single-item mode; `plugin/runtime/codex/R8-BACKLOG-SPIKE.md` records the explicit
Claude ownership and reevaluation gates. Product queue parity does not imply backlog drain-all parity.

## R10 sequential runtime-switch verdict — fixture proven, live pending

The runtime-neutral state and lease contract now has a bidirectional disposable-project harness at
`plugin/scripts/test-runtime-switch.mjs`. It exercises the real `build-state.mjs` APIs and proves that
a Claude owner can quiesce and finalize before a later Codex owner acquires a newer fenced epoch, and
that the inverse direction preserves the same VERIFIED work-order truth. It also covers simultaneous
acquisition, non-owner release, stale reclaim and zombie fencing without a shared transcript, live
takeover or runtime-to-runtime messaging. Companion source and executor suites cover orphan
`IN_PROGRESS`, durable budget/health state, terminal enforcement, preserved tests, hardening and
orphan worktree/journal recovery.

This is deliberately **fixture evidence, not installed-runtime evidence**. A Codex session cannot
impersonate or launch the installed Claude Dynamic Workflow. The owner-run Claude→Codex→Claude canary
and R11 unattended canary therefore remain mandatory promotion gates. Codex `implement` stays
`FALLBACK`; the two deployed recurring routines and factory-backlog drain-all remain Claude-owned.
The evidence taxonomy, commands and live capture requirements are canonical in
`plugin/runtime/codex/R10-CERTIFICATION.md`.

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

`test-codex-unattended.mjs` is the `OFFLINE_ACCELERATED` failure corpus (13/13). The real disposable
current-head `LIVE_SHORT` run `codex-20260711T183105Z-28552` is green: 114 seconds, two real
dispatches, four durable spend units, controller verification, a 120000 ms heartbeat within `TTL/3`,
supervisor terminal, fenced release, and no implementer dispatch for its already-VERIFIED WO. The
disposable fixture was removed and the exact summary lives in
`plugin/runtime/codex/evidence/r11-live-short-2026-07-11.json`.

This evidence is intentionally **not** `LIVE_OVERNIGHT`. The parity gate stays open until a
a representative multi-FRD run completes at least three real wall-clock hours without owner interaction,
followed by the cold return canary. Commands, evidence retention and the fail-closed collector are in
`plugin/runtime/codex/R11-CERTIFICATION.md`.
