# R10 — Sequential runtime-switch certification

Date: 2026-07-11

## Verdict

**FIXTURE PROVEN · THREE LIVE ATTEMPTS / NO-GO · CLAUDE 9.95.2 STATE-SEAM QUALIFIED · FRESH RETRY PENDING.** The runtime-neutral
state/lease contract passes the offline bidirectional fixture. The first installed canary proved
Claude Stage 1, then stopped safely but inconclusively when Codex Desktop reaped a detached worker.
The second installed canary proved foreground-owned Codex process lifetime and a same-run,
new-epoch continuation through implementation, but it was invalid as certification evidence: Claude
had published an orphaned `last_green_sha`, and Codex's independent review ended uncertain on a
provider `usage_limit`. Both fixtures are preserved as failed evidence. BL-0066 and BL-0067 are fixed
in plugin 9.93.0 / overlay 8.74.0. Fixture C then exposed BL-0068: an ambient `test` alias fabricated
an absent owner-stop signal and the generic pre-loop closer performed unauthorized product work.
Plugin 9.94.0 / overlay 8.75.0 replaces both seams with deterministic, bounded CLI operations; a
distinct clean retry is still required. No capability is
promoted from `FALLBACK`.

Installed fixture E then exposed BL-0071 before useful Claude work: Workflow subagents did not
inherit `CLAUDE_PLUGIN_ROOT`, so governed state commands resolved under `/scripts`. Plugin 9.94.2 /
overlay 8.75.1 pass a realpath-validated absolute `stateCli` capability in launcher-produced args and
fail before any spawn when it is absent or relative. This repairs the cause but does not promote or
retroactively certify the failed canary; a distinct clean installed retry remains required.

## Executor boundary and BL-0074 disposition

R10 certifies two different runtime-local executors and their durable handoff; it does not ask either
runtime to drive the other. Claude Stage 1/3 use the installed Dynamic Workflow and Claude agents.
Codex Stage 2 uses `plugin/runtime/codex/executor.mjs` and Codex agents. The only bridge is committed
canonical state plus the fenced lease, after the prior executor has fully quiesced.

The installed Claude 9.95.2 state-seam qualification proved `inspect-stop` returns `stop:false`, then
`stop:true`, and fences a stale epoch under hostile shell aliases, followed by clean lease release.
Dynamic Workflow JavaScript itself has no filesystem/process channel, so a Claude subagent remains in
the tool-execution path. Receipt validation is fail-closed and the installed qualification is the live
oracle for the current platform; neither is misrepresented as cryptographic proof that every future
agent call is honest. BL-0074 tracks a future runtime-owned seam as P2 hardening. It is **not** an
R10/R11 blocker, because Codex never consumes Claude narration and uses its own executor after the
committed safe point.

## Certification-only Stage 2 permit

PORT-5 no longer deadlocks its own evidence collection. Plugin 9.95.0 adds a narrowly scoped,
one-shot permit for installed Codex Stage 2 only. The committed fixture marker and owner
authorization bind the fixture UUID and seed, stage, current safe-point HEAD, plugin/overlay/engine
pins, exact single FRD, limits and nonce. The foreground launcher consumes it before ownership and
revokes it at terminal exit. Any mismatch, symlink, non-canary path, dirty tree, live lease,
non-ancestor green pointer or reused nonce fails closed. This is not capability promotion.

The engine pin has exactly one project-side source: the managed overlay file at
`.claude/engines/pandacorp-build.js`, materialized from the matching file under
`plugin/templates/shared/` by scaffold/upgrade. The permit requires that canonical path to be a
regular, versioned file and rejects missing, altered or symlinked engines; the former invented
`.pandacorp/pandacorp-build.js` path is neither read nor accepted as a fallback. Non-consuming
`check` output contains only the fixture identity and stage, never the authorization nonce.

```bash
bash "$PLUGIN_ROOT/scripts/launch-codex-implement.sh" "$FIXTURE" 4 900 0 1 "" \
  "frd-b-multiply" auto foreground "$FIXTURE/.pandacorp/run/r10-owner-authorization.json"
```

## Evidence levels

- **fixture-real-cli:** a disposable Git project exercised the real fenced state APIs.
- **fixture/source-suite:** the named independent suite executes a real script/engine harness.
- **source:** static ownership or lifecycle invariant; never represented as runtime behaviour.
- **live:** an installed Claude/Codex run. Both preserved attempts provide partial evidence only;
  neither completed the full Claude→Codex→Claude chain on a valid green ancestor.

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

## Installed canary B — foreground lifetime GO, certification NO-GO

The preserved fixture is
`/Users/Shared/Proyectos/pandacorp-canaries/r10-installed-cold-switch-b`.

- Installed Claude plugin 9.92.7 functionally built and independently verified FRD-A, quiesced at
  commit `074730a`, and released epoch 1 with a clean main checkout. Its final status nevertheless
  published `last_green_sha: 1fb820d`, a gate-worktree commit that was not an ancestor of main. The
  code and independent 12/12 rerun were green, but the orphaned pointer invalidates the safe point.
- Installed Codex plugin 9.92.7 used the canonical `foreground` launcher. Launcher, supervisor and
  sleep inhibitor remained alive together, proving BL-0065's process-lifetime fix under the real
  Codex Desktop host.
- Codex automatically continued logical run `run_20260712T012811Z_27525` under epoch 2. WO-B
  implementation completed green and commit `ca32d3a` persisted it for handoff to review.
- The independent JUDGE review returned an uncertain provider outcome classified as `usage_limit`.
  The executor did not retry it, committed the governed uncertain state in `10c76ec`, quiesced in
  `f00bded`, released the lease, and left `running: false`.
- Commit `9301dcc` preserves the fixture-local NO-GO report. Do not run Stage 3, repair, continue or
  retry this fixture.

BL-0066 now publishes a verified ancestor through the explicit two-commit green-snapshot protocol.
BL-0067 now preserves ambiguous gate-worktree residue and falls back to the synchronous gate instead
of deleting crash evidence. Both fixes ship in plugin 9.93.0 and overlay 8.74.0. They repair the
causes but cannot retroactively turn fixture B into passing evidence.

## Live canary retry still required

R10-H Stage 1 completed installed Claude FRD-A and published a clean safe point. Stage 2 then exposed
BL-0076: the targeted Codex FRD-B run completed its exact feature scope, but because it made every
global WO `VERIFIED`, the controller widened into project-wide hardening. That audit/fix authority was
outside the one-shot target, so Stage 2 is not certifiable and Stage 3 must not consume it. Plugin
9.95.4 fixes both runtime-local executors: targeted FRD/change runs terminally quiesce in
`phase: implementation`; only a bare run may harden/release. R10 must continue from a clean authorized
state under the repaired version; no failed permit is retried or fabricated.

Use a distinct clean fixture with plugin 9.95.4 / overlay 8.76.2 or later.
Claude verifies one WO and cleanly releases;
a later Codex session acquires a newer epoch and verifies the next WO; a later Claude session
acquires a newer epoch and confirms both VERIFIED WOs are skipped. Capture factory SHA,
plugin/cache versions, overlay version, lease epochs and gate output. No runtime messages or live
takeover are allowed. The Codex stage MUST use the launcher's `foreground` mode from an ephemeral
Codex Desktop shell. Until the complete retry and R11 are green, Codex `implement` remains
`FALLBACK`. Fixture C must also prove that the published `last_green_sha` resolves to an ancestor of
the shared main HEAD and that any preexisting ambiguous gate worktree remains preserved.

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
