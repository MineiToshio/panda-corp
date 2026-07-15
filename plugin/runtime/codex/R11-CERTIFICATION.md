# R11 Codex unattended certification

This evidence record is append-only by run. Evidence classes are not interchangeable:

- `OFFLINE_ACCELERATED`: deterministic failure injection and accelerated soak. It proves controller
  mechanics, not provider or elapsed-time durability.
- `LIVE_SHORT`: a real, low-budget Codex provider run in a disposable project. It proves the installed
  transport/auth/sandbox path at that moment, not unattended endurance.
- `LIVE_OVERNIGHT`: a representative multi-FRD run lasting several hours without owner interaction.
  Only this class can close the R11 overnight gate.

## Current verdict — OFFLINE GREEN; CURRENT-HEAD SHORT LIVE GREEN; OVERNIGHT PENDING

`OFFLINE_ACCELERATED` is automated by `node plugin/scripts/test-codex-unattended.mjs` (**14/14** on
2026-07-11). It injects crash/restart, network loss, rate limit, expired auth, approval denial,
budget/ownership and uncertain-result failures; verifies the supervisor breaker/backoff, whole-run
sleep prevention, interruptible backoff, `TTL/3` renewal, path-safe receipts, exact guarded resumption,
canonical project enforcement projections, no blind retry and fail-closed evidence parsing.

`LIVE_SHORT` has a **GO on the pre-launcher-hardening revision**: run
`codex-20260711T130926Z-11105` used the real Codex provider through the real launcher in a disposable
all-VERIFIED fixture. It completed in 95 seconds, performed two real
dispatches for four durable spend units, independently reran the gate, finalized `phase: release`,
emitted a supervisor terminal event and released the fenced lease. It dispatched no implementer for
the already-VERIFIED WO. It proved the real provider/controller path, but not the later
receipt/PID/config-isolation changes by itself; the canonical evidence file has since advanced to the
current-head run below.

The first real attempt was a useful **NO-GO**: the hardening prompt asked for “Verification evidence”
while the controller required the exact `## Verification` heading. The deterministic gate rejected
the otherwise-green model output and paused for the owner. The prompt now names the exact contract;
the corrected real canary is the GO above. A later current-head rerun failed safe because an unrelated
user-level MCP had an expired token. The executor now passes `--ignore-user-config` and the preflight
requires the project's own `.codex/config.toml` + rules, preventing unrelated global connectors from
controlling a build. The immediate post-fix rerun then hit the account usage limit. Capacity was
restored later, but the independent offline review intentionally consumed no provider quota. Therefore
the current-head recheck remained pending until capacity returned.

The **current-head `LIVE_SHORT` recheck is now GO**: run
`codex-20260711T183105Z-28552` completed in 114 seconds on the disposable all-VERIFIED fixture after
the launcher receipt, project-config isolation and evidence-binding hardening. It made two real
dispatches for four durable spend units, renewed at 120000 ms (within the 600-second lease's `TTL/3`),
ended `complete`, recorded the supervisor terminal and fenced lease release, and removed the
disposable fixture. The canonical evidence JSON at
`plugin/runtime/codex/evidence/r11-live-short-2026-07-11.json` records this current-head run.

`LIVE_OVERNIGHT` remains **PENDING** until a real several-hours window completes; no accelerated clock,
short provider call or mock worker may promote it. Full unattended parity is therefore not yet claimed.

Codex `implement` now exposes one narrow `EXPERIMENTAL` normal-project profile: exactly one FRD or one
ready change, `attended_foreground`, cumulative duration `<=7200`, zero automatic restarts, ending in
`implementation`. R11 remains a separate certification-only exception for unattended/multi-FRD
coverage. It is evidence machinery and does not widen the promoted attended profile.

Two 2026-07-11 overnight attempts are retained as explicit **NO-GO** evidence and do not count toward
promotion. In the first disposable checkout (`codex-20260711T193340Z-40302`), the launcher receipt was
written but the short-lived orchestration shell reaped its detached supervisor/worker immediately
after launch. The lease and inflight checkpoint were preserved; the uncertain dispatch was not
replayed or resumed. In a separate clean checkout, run `codex-20260711T193448Z-42409` kept the
supervisor and sleep inhibitor alive, completed the Alpha implementer green, then the Alpha reviewer
exited non-zero because the real Codex provider reported `usage_limit`. The controller failed safe,
did not retry, persisted the uncertain checkpoint and released its fenced lease. A read-only provider
diagnostic confirmed the same quota condition and reported a reset at **18:48 local time**. No third
provider attempt was made. Neither run reached the three-hour/two-reviewed-FRD requirement.

Provider failures now persist only a sanitized `error_class` (`usage_limit`, `rate_limit`, `auth`,
`approval`, `network`, or `unknown`) plus exit/timeout facts. Raw child stdout/stderr is never copied
to the journal, checkpoint, owner decision or notification. This improves diagnosis without weakening
the no-blind-retry rule.

The two deployed recurring routines remain Claude-owned. This certification covers only a manually
launched Codex `implement` run.

## One-shot installed R11 permit

Prepare a fresh standalone, non-symlink fixture under
`/Users/Shared/Proyectos/pandacorp-canaries/`. It must contain at least two exact pending FRDs and a
committed `.pandacorp/certification/r11.json`:

```json
{
  "schema": 1,
  "kind": "pandacorp-r11-installed-canary",
  "fixture_uuid": "<fresh UUID>",
  "fixture_path": "<exact real absolute fixture path>",
  "seed_commit": "<fixture seed SHA>",
  "stage": "codex-live-overnight",
  "frds": ["<exact FRD A>", "<exact FRD B>"],
  "limits": { "max_spend": 24, "max_duration": 28800, "max_retries": 2, "max_blocks": 3 },
  "launch_mode": "foreground",
  "plugin_version": "<installed version>",
  "overlay_version": "<fixture overlay>",
  "executor_sha256": "<SHA-256 plugin/runtime/codex/executor.mjs>",
  "supervisor_sha256": "<SHA-256 plugin/runtime/codex/supervisor.mjs>",
  "launcher_sha256": "<SHA-256 plugin/scripts/launch-codex-implement.sh>"
}
```

Commit the marker, verify a clean tree, `running: false` and no active lease. Only then may the owner
create a fresh gitignored authorization at `.pandacorp/run/r11-owner-authorization.json` with the
same fields plus `authorized_head` equal to the exact current HEAD, a fresh `nonce`, and kind
`pandacorp-r11-owner-authorization`. Never synthesize owner authorization from the marker or an old
chat approval.

The permit rejects path/marker/authorization symlinks, a non-standalone or outside-root repository,
dirty or drifted HEAD, fixture/seed/version/overlay/hash/scope/limit drift, a live lease, background
mode and every previously consumed or revoked nonce. Consumption writes the distinct
`.pandacorp/run/r11-certification-receipt.json` before the executor can acquire a lease. Every
terminal launcher path revokes it. A revoked/uncertain run is evidence and is never resumed or
retried with the same authorization.

## One-shot overnight command

Run from a disposable, representative multi-FRD project after the short canary is green:

```bash
bash /absolute/path/to/panda-corp/plugin/scripts/launch-codex-implement.sh \
  "$PWD" 24 28800 2 3 "" "<exact FRD A>,<exact FRD B>" auto foreground \
  "$PWD/.pandacorp/run/r11-owner-authorization.json"
```

Keep the Mac powered and logged in. `foreground` is mandatory under Codex Desktop or another ephemeral
command shell: the launcher stays attached, owns signal propagation, and starts
`caffeinate -w <supervisor_pid>` as a separate sleep inhibitor. The receipt records launcher and child
PIDs; stopping the launcher ends the supervisor worker tree and inhibitor. Power-off, forced OS
termination, loss of the local checkout, or closing the attached task cannot continue.
The general supervisor remains mechanically resumable after promotion, but this certification permit
is deliberately one-shot: a crash/uncertain/terminal result revokes its receipt and the recorded
`resume_argv` must not be used for R11. Preserve the state and obtain a new fixture plus a new explicit
owner authorization if policy requires a later independent attempt.
Preserve these files as evidence:

- `.pandacorp/run/codex-launch.json`
- `.pandacorp/run/codex-supervisor.jsonl`
- `.pandacorp/run/codex-executor.jsonl`
- `.pandacorp/run/run-ledger.json` and `.jsonl`
- `.pandacorp/run/codex-checkpoint.json`

After terminal completion, run:

```bash
node /absolute/path/to/panda-corp/plugin/scripts/collect-codex-unattended-evidence.mjs "$PWD"
```

The collector classifies a run as `LIVE_OVERNIGHT` only after at least three wall-clock hours and at
least two independently reviewed FRDs. It binds launch, checkpoint, durable ledger, executor terminal,
supervisor terminal, the revoked one-shot R11 receipt and lease release to the same run/reason; it also
requires the lease directory to be absent. The terminal checkpoint is one atomic transition:
`terminal_at` and `updated_at` must be identical, and the completion, release, supervisor and receipt
timestamps must follow their causal order and cannot be future-dated past collection. Each counted
FRD requires its exact JUDGE dispatch, a green `dispatch.finished` record and its real green result
artifact. The revoked receipt must carry the complete permit identity and match the committed marker
plus owner authorization; a minimal or reconstructed receipt is not evidence. While unattended and
multi-FRD execution remain outside the promoted `EXPERIMENTAL` profile, a three-hour result without
that exact receipt is rejected rather than promoted. Mixed/corrupt evidence, duplicate event IDs, a
forged terminal chain, a live receipt or a surviving lease fails closed.
