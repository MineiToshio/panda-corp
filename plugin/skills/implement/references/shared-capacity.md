# Shared capacity and Claude lead wake-up

## Shared account capacity (DR-162)

At startup and before every wave, the lead calls Desktop `get_usage` and pipes its unchanged JSON to
`node <plugin-root>/runtime/capacity-cli.mjs ingest-claude`. Never launch a model to measure quota.
When that tool is unavailable, use the stored account snapshot; the allocator handles unknown readings.
Never ask the owner about quota. The CLI selects the other qualified tool when one cannot fit; capacity
waits only when no remaining unit can progress, with `resumeAt` persisted. Subscription limits suspend
the exact execution (dirty files, branch, worktree, thread, token, pin and attempt). Transient 429/529 errors
retry the same cell after 60/120/240/480/900 seconds, honoring Retry-After up to 900 seconds.
Dispatch exactly the returned cell, fixed for the execution. Review independence means a fresh context,
including for the same model. Capacity switches never force Astra or a later cross-company re-review.

### Claude lead wake-up (app open)

On `next.action: waiting`, schedule **ScheduleWakeup** for `resumeAt + 60 seconds`, carrying the project,
run id, epoch and `wake_generation`. This is the Claude session timer used by this protocol; do not also
create a CronCreate job. On that wake, call Desktop `get_usage`, ingest its unchanged result, then run
`pandacorp-build.mjs start --resume --coordinator claude --wake-generation <N>`.
`claimed:false` means no new coordinator: `waiting` rearms ScheduleWakeup at the returned instant +60s;
`already_resumed`/`already_resuming` leaves the winner running. On success continue `next` with the
returned epoch. Drive and manual resume use the same conditional waiting→resuming claim under the run
lease mutex; an obsolete generation cannot start another execution. An elapsed reset without a newer
healthy observation retries reads after 60/120/240/480/900 seconds. Never ask for quota permission.
One optional Spanish line only: "Cupo agotado; guardé el trabajo y retomaré automáticamente." All
suspension/wait/wake/resume details belong in `capacity-decisions.jsonl`, never in chat. If ScheduleWakeup
is unavailable, keep the attended `next` loop renewing the lease; do not claim a timer was installed.
