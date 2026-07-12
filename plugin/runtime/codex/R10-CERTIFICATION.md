# R10 — Sequential runtime-switch certification

Date: 2026-07-11

## Verdict

**FIXTURE PROVEN · LIVE ATTEMPTED / NO-GO · RETRY PENDING.** The runtime-neutral state/lease
contract passes the offline bidirectional fixture. The first installed canary proved Claude Stage 1,
then stopped safely but inconclusively in Codex Stage 2 when Codex Desktop reaped a detached worker
after dispatch reservation. The ambiguous dispatch was not repeated and the lease was released.
That fixture is preserved as failed evidence; a fresh foreground-owned retry fixture is pending.
No capability is promoted from `FALLBACK`.

## Evidence levels

- **fixture-real-cli:** a disposable Git project exercised the real fenced state APIs.
- **fixture/source-suite:** the named independent suite executes a real script/engine harness.
- **source:** static ownership or lifecycle invariant; never represented as runtime behaviour.
- **live:** an installed Claude/Codex run. The first run is partial evidence only: Claude Stage 1 is
  green, while Codex Stage 2 is NO-GO and the full bidirectional verdict remains open.

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

## Installed canary attempt — partial GO, overall NO-GO

The preserved fixture is
`/Users/Shared/Proyectos/pandacorp-canaries/r10-installed-cold-switch`.

- Installed Claude plugin 9.92.5 completed targeted FRD-A at lease epoch 2. WO-A-001 and FRD-A are
  VERIFIED; the independent gate and a separate 14/14 `verify.sh` rerun were green; commit `faa15c6`
  quiesced the Claude lease with a clean tree.
- Installed Codex plugin 9.92.5 acquired epoch 3 for targeted FRD-B. It reserved
  `implement-WO-B-001-p0` and commit `d20e3c2` persisted WO-B-001 as `IN_PROGRESS`, after which the
  host reaped the background worker before an agent result or deterministic completion existed.
- A continuation before expiry correctly returned `CONTENDED`. After expiry, epoch 4 recovery found
  the orphaned `IN_PROGRESS` work without a reconstructable inflight dispatch, stopped
  `needs-owner`, persisted that decision in `ae3ac6b`, did not dispatch a duplicate, and released the
  lease in `c41f815` with `running: false`.
- Commit `90eb3eb` records the complete fixture-local NO-GO timeline. The fixture must not be reset,
  repaired or retried in place.

The fencing and uncertainty behavior is green, but FRD-B never completed or reached its independent
gate. Therefore this is not an end-to-end installed cold-switch certification. BL-0065 fixed the
process-lifetime cause in plugin 9.92.6 by adding foreground-owned launch mode; it does not convert
the failed run into passing evidence.

## Live canary retry still required

Use the fresh retry fixture
`/Users/Shared/Proyectos/pandacorp-canaries/r10-installed-cold-switch-b` with plugin 9.92.6 or later.
Claude verifies one WO and cleanly releases;
a later Codex session acquires a newer epoch and verifies the next WO; a later Claude session
acquires a newer epoch and confirms both VERIFIED WOs are skipped. Capture factory SHA,
plugin/cache versions, overlay version, lease epochs and gate output. No runtime messages or live
takeover are allowed. The Codex stage MUST use the launcher's `foreground` mode from an ephemeral
Codex Desktop shell. Until the complete retry and R11 are green, Codex `implement` remains
`FALLBACK`.

The three launches MUST carry the same logical build-run ID, but the owner never copies it. In the
default `auto` mode the shared resolver reuses it only when canonical state proves a released
cross-runtime safe point: `phase: implementation`, `running: false`, no lease, valid
`build_run_id`, and a different prior `build_runtime`. Preflight reports this classification without
printing or requesting an owner-supplied ID:

```bash
# First Claude launch: creates the logical run id.
bash "$CLAUDE_PLUGIN_ROOT/scripts/launch-implement.sh" "$PROJECT" balanced 4

# Later Codex continuation: auto-resolves the prior Claude logical run and keeps an
# ephemeral Codex Desktop launcher alive until the supervisor exits.
bash plugin/scripts/launch-codex-implement.sh "$PROJECT" 4 1800 2 3 "" "" auto foreground

# Later Claude return: auto-resolves the prior Codex logical run.
bash "$CLAUDE_PLUGIN_ROOT/scripts/launch-implement.sh" "$PROJECT" balanced 4
```

Same-runtime next passes, `phase: release`, missing/invalid prior state and the explicit `new` mode
create a new governed run. A supervisor restart receipt may pass the canonical ID explicitly; this is
mechanical runtime state, never owner input.
