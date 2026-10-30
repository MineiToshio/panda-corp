---
id: LESSON-0546
type: gotcha
domain: testing
tags: [process-management, liveness-probe, eperm, esrch, parallel-worktrees, postgres, race-condition]
context: a multi-worker/multi-worktree test harness that probes whether a per-worker resource's owning process is still alive (e.g. `kill(pid, 0)` / `process.kill(pid, 0)`) before reclaiming or recreating that resource
trigger: use this when writing or auditing a liveness check that decides "is the owner of this resource still running?" before a cleanup/reclaim step, especially when several concurrent worktrees or sessions share the same host and the same UID namespace
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-28/29 (agent-inferred) — parallel test runs launched from several git worktrees against the same native Postgres swept each other's live per-worker databases: a liveness probe treated an EPERM error (permission denied signalling the PID exists but isn't owned/signalable by the calling process) as equivalent to the PID being dead, so one worktree's test run tore down and recreated another, still-running worktree's per-worker database; fixed by run-scoped ownership plus restricting 'dead' to ESRCH only"
provenance: agent-inferred
created: 2026-10-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0154, LESSON-0463, LESSON-0480]
---

**Situation:** a test harness that gives each parallel worker/worktree its own per-worker Postgres
database recorded the owning PID so a later run could decide whether a stale-looking database was
actually abandoned (owner dead, safe to drop and recreate) or still in use (owner alive, leave it
alone). The liveness check sent a null signal to the recorded PID and treated ANY error from that call
— including `EPERM` — as "the process is gone." `EPERM` on a signal probe means the opposite: the PID
exists, it is simply not one the calling process/user is allowed to signal (a different worktree's
session, under concurrent/multi-session load, can easily hit this). The harness therefore reclaimed and
recreated a database another, perfectly live worker was still actively using mid-test.

**Lesson:** a signal-0 liveness probe (`kill -0 $PID`, `process.kill(pid, 0)`) returns a specific errno,
and only ONE of the possible errors means "dead": `ESRCH` (no such process). Any other failure —
`EPERM` chief among them — means the process EXISTS but the probe lacks permission to signal it, which
is a near-certain outcome whenever concurrent sessions/worktrees on the same host can end up probing
each other's processes. Collapsing "probe failed" to "owner is dead" is the exact inversion of the
truth for `EPERM`, and the failure mode it causes (silently destroying another live worker's resource)
looks like a flaky/corrupted test run rather than an own-tooling liveness bug.

**Apply next time:** when writing any "is the recorded owner of this resource still alive?" check used
to gate a destructive reclaim/cleanup step, branch explicitly on the errno: `ESRCH` → dead, safe to
reclaim; any other error (`EPERM` in particular) → treat as ALIVE (or unknown — never destructive) and
skip the reclaim. Pair this with run-scoped resource ownership (a unique run/session id in the
resource's name or a lockfile, not just a bare PID) so two concurrent workers can never even compete
over the same resource in the first place — the liveness check should be a last-resort disambiguator,
not the primary isolation mechanism.
