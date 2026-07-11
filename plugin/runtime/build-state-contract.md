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

`run_id` is the logical governed build-run identity, not a runtime session or process ID. A cold
continuation reuses it so dispatch reservations, cumulative spend and health-breaker floors survive
the runtime change. Both launchers consume `resolve-build-run-id.mjs`: default `auto` inherits the
canonical ID only at a released cross-runtime `phase: implementation` safe point. Same-runtime next
passes, `phase: release`, invalid/missing prior state or explicit `new` intent create a genuinely new
run and ledger. An explicit canonical ID is reserved for mechanical supervisor restart receipts; the
owner never copies it. Runtime-local process/session identity remains local.

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

## CLI exit codes

- `0`: operation accepted.
- `2`: contention, stale fence, invalid state, spend cap, or another fail-closed rejection.
- `3`: malformed invocation or unavailable prerequisite.

The CLI prints one JSON object on stdout. Tokens are secrets of the local run and must not be
committed or emitted to the shared event stream.
