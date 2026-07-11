# R10 — Sequential runtime-switch certification

Date: 2026-07-11

## Verdict

**FIXTURE PROVEN · LIVE PENDING.** The runtime-neutral state/lease contract passes a disposable,
bidirectional cold-continuation fixture using the real `build-state.mjs` APIs. This is not yet an
installed-runtime certification: a Codex process cannot launch the installed Claude Dynamic
Workflow, and the owner-run Claude→Codex→Claude canary remains pending. No capability is promoted
from `FALLBACK` on fixture evidence alone.

## Evidence levels

- **fixture-real-cli:** a disposable Git project exercised the real fenced state APIs.
- **fixture/source-suite:** the named independent suite executes a real script/engine harness.
- **source:** static ownership or lifecycle invariant; never represented as runtime behaviour.
- **live:** an installed Claude/Codex run. None was available from this Codex session.

## Proven offline

`node plugin/scripts/test-runtime-switch.mjs` proves:

1. Claude safe point → committed quiesce → lease finalization → later Codex acquisition.
2. Codex safe point → committed quiesce → lease finalization → later Claude acquisition.
3. Canonical VERIFIED WO state survives both changes without a transcript, message or live takeover.
4. Epochs increase across owners; simultaneous acquisition has exactly one winner.
5. Non-owner release fails; stale reclaim fences the old owner's dispatch.
6. Both directions retain cumulative spend and health-breaker floors by carrying one logical build
   `run_id` through the cold continuation; a new runtime-specific ID would intentionally start a new
   ledger and is therefore not a continuation.
7. The only two deployed routine ownership records remain Claude-owned.
8. Factory backlog drain-all remains explicitly Claude-only and Codex exposes single-item fallback.

Run the companion suites separately because their process-group kill canaries must not run nested:

```bash
node plugin/scripts/test-build-state.mjs
node plugin/scripts/test-codex-enforcement.mjs
node plugin/scripts/test-codex-executor.mjs
node plugin/scripts/test-engine-lease-lifecycle.mjs
node plugin/scripts/test-pandacorp-build.mjs
bash plugin/scripts/test-check-derived-drift.sh
bash plugin/scripts/test-detect-gate-config-newer.sh
node plugin/scripts/test-pandacorp-backlog.mjs
```

Together they cover simultaneous/non-owner/stale fencing; durable budget and health; uncertified
Codex Stop suppression and jq absence; orphan `IN_PROGRESS`; transaction crash boundaries; gate
rejection and preserved tests; orphan Claude gate-worktree cleanup/fallback; hardening; drift; and
Claude-only backlog drain-all.

## Live canary still required

From a disposable project with both installed runtimes: Claude verifies one WO and cleanly releases;
a later Codex session acquires a newer epoch and verifies the next WO; a later Claude session
acquires a newer epoch and confirms both VERIFIED WOs are skipped. Capture factory SHA,
plugin/cache versions, overlay version, lease epochs and gate output. No runtime messages or live
takeover are allowed. Until this canary and R11 are green, Codex `implement` remains `FALLBACK`.

The three launches MUST carry the same logical build-run ID, but the owner never copies it. In the
default `auto` mode the shared resolver reuses it only when canonical state proves a released
cross-runtime safe point: `phase: implementation`, `running: false`, no lease, valid
`build_run_id`, and a different prior `build_runtime`. Preflight reports this classification without
printing or requesting an owner-supplied ID:

```bash
# First Claude launch: creates the logical run id.
bash "$CLAUDE_PLUGIN_ROOT/scripts/launch-implement.sh" "$PROJECT" balanced 4

# Later Codex continuation: auto-resolves the prior Claude logical run.
bash plugin/scripts/launch-codex-implement.sh "$PROJECT" 4 1800 2 3

# Later Claude return: auto-resolves the prior Codex logical run.
bash "$CLAUDE_PLUGIN_ROOT/scripts/launch-implement.sh" "$PROJECT" balanced 4
```

Same-runtime next passes, `phase: release`, missing/invalid prior state and the explicit `new` mode
create a new governed run. A supervisor restart receipt may pass the canonical ID explicitly; this is
mechanical runtime state, never owner input.
