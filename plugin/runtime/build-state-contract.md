# Neutral build-state infrastructure contract

`pandacorp-build-state.mjs` is the only writer of the neutral lease and run-ledger facts.

## Files

- `.pandacorp/run/build.lease/lease.json` — current owner. Directory creation is the atomic acquire;
  it stores only a SHA-256 token verifier, never the raw fencing credential.
- `.pandacorp/run/lease-epoch` — monotonic fencing epoch, never decremented.
- `.pandacorp/run/run-ledger.json` — atomic snapshot of dispatch, spend and health facts.
- `.pandacorp/run/run-ledger.jsonl` — append-only audit evidence for accepted ledger mutations.

`status.yaml` receives compatibility projections only: `running`, `run_started_at`,
`supervisor_heartbeat`, `build_run_id`, `build_runtime`, and `build_lease_epoch`. Those fields do not
own the lease; consumers resolve ownership from `build.lease/lease.json`.

`run_id` is the logical governed build-run identity, not a runtime session or process ID.
The product build CLI owns run-id creation and resume selection; same-run continuation retains
that id and transfers or reacquires epoch-fenced ownership under BUILD-14. See
`plugin/docs/build-engine-cli.md` sections 3.3 and 3.4 for start/resume behavior. Runtime-local
process/session identity remains local.

All state snapshots are written through temp-file + rename. Lease reclaim and governed mutation use
the same owner-stamped `.pandacorp/run/lease-mutation.lock` mutex; stale recovery renames the old
mutex and an exiting owner removes a lock only when its owner stamp still matches. A writer must
present both the opaque token and epoch; the token is checked against the durable hash and a stale
process is rejected even if it still holds an old credential. Governed file transitions reject
symlink/path escapes before mutation.

Certified terminal paths use a two-phase release. `quiesce` writes the `running:false` compatibility
projection and stamps `quiesced_at` while the lease still fences every writer. The runtime controller
then commits only that projection. `finalizeRelease` accepts the same token+epoch only after quiesce
and atomically removes the lease directory. A crash before finalize leaves a reclaimable fenced lease;
there is never a writer-free window in which another runtime can enter before the projection commit.
Once quiesced, renew and every governed mutation reject with `QUIESCED`; only token+epoch-matched
finalization is accepted.
The one-shot `release` API is compatibility-only and MUST NOT be used by a certified executor.

## Product change-queue transactions

The same fenced writer owns ready-card integration, commit stamping and final archival. A planner may
only propose complete canonical markdown; it never writes. `applyChangePlan` validates the affected
FRD DAG, records an idempotent transaction before the first mutation, and binds the card to the
transaction digest and exact mutation paths. Unknown types/stages, digest drift, or a card FRD/path
set that differs from the completed apply plan fail closed. `stampChangeIntegration` accepts only
current-HEAD commit evidence containing those
exact paths and contents. Archival requires all affected FRDs VERIFIED and never replaces an existing
`done/` target.

The changes root/card/done directory, FRD/work-order parents and mutation leaves are realpath-checked
real in-tree entries. A symlink, missing/noncanonical parent, foreign archive target or replay target
drift is `INVALID_PATH`. Recovery revalidates the original plan rather than trusting the transaction
journal as authority; the journal is durable intent, not permission to bypass current invariants.
Post-integration progress normalization applies only to controller-owned keys in leading YAML
frontmatter; matching text in Markdown content is never discarded from evidence comparison.

## Same-run transfer and engine v2 primitives

These additions are opt-in and leave every v1 call unchanged.

- `transfer(project, {token, toRuntime, coordinator, epoch?})` hands the SAME run to another coordinator
  (`coordinator`: `session` or `drive`) without quiescing. Under the lease mutex it requires the caller's
  raw token to match `token_hash` (and `epoch`, when given, to match the lease), then writes a lease with
  the same `run_id`, `epoch + 1`, a new token, `ttl_seconds: 1800`, `renewed_at` now, the new `runtime` and
  `coordinator`, and no `quiesced_at`. It works on a fresh or a stale lease, never projects `status.yaml`
  and never stops workers; a missing lease, a wrong token or epoch, or a `run_id` that differs from
  `.pandacorp/run/build/state.json` (when that file exists) is `FENCE`. The previous holder is fenced by the
  epoch at its next mutating command and can only observe afterwards. The commit order is the monotonic
  epoch file, then the lease, then the token file, so a crash can never lower the epoch.
- `forceRelease(project, {ownerConfirmed: true})` removes a lease whose owner is dead. It requires
  `isReclaimable` (`CONTENDED` otherwise), an explicit `ownerConfirmed: true` (`USAGE` otherwise), and never
  projects status. The CLI form is `force-release --owner-confirmed`.
- `transitionWorkOrderAt(root, {file, to, reason})` is the governed WO transition of `transitionWorkOrder`
  rooted in any worktree. It is not fenced (the caller holds the fence) and writes only the WO file, the
  `frd.md`/`blueprint.md` rollups and, in `root/.pandacorp/status.yaml`, the `work_orders_*` counters and
  `updated_at`. It never writes `running`, `build_*`, `supervisor_heartbeat`, `phase` or `last_event_at`.
- `acquire`, `renew` and `quiesce` accept `projectStatus: false`, which skips every `status.yaml` write
  (including the rollback copy). `acquire` also accepts an optional `coordinator` stored on the lease.
  With `projectStatus: false`, `acquire` mirrors the raw token to `.pandacorp/run/build/lease-token.json`
  (`{epoch, token}`, mode 0600, never printed by the engine); `transfer` rewrites it and `finalizeRelease`
  and `forceRelease` remove it when it still belongs to the released epoch.
- A lease may carry an optional `coordinator` (`session` or `drive`). The default v1 `acquire` omits it and
  writes no token file.

## CLI exit codes

- `0`: operation accepted.
- `2`: contention, stale fence, invalid state, spend cap, or another fail-closed rejection.
- `3`: malformed invocation or unavailable prerequisite.

`transfer` (`--token --epoch --to-runtime claude|codex --coordinator session|drive`) and
`force-release --owner-confirmed` are the two added commands; both are fenced commands of the Codex hook
adapter policy. The CLI prints one JSON object on stdout. Tokens are secrets of the local run and must not be
committed or emitted to the shared event stream.
