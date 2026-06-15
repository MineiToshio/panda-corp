# FRD-14 — Probable snapshot and feedback channels

What Mission Control shows to operate an unattended build: which is the last **probable** (testable) point, what is being built right now, and the channels to feed it feedback without stopping. Derived from [docs/proposals/07-unattended-build.md](../../../docs/proposals/07-unattended-build.md). Read-only.

## Acceptance criteria (EARS)

- FOR each project being built, Mission Control SHALL show a **snapshot panel** with: the **last probable point** (FRD closed green + `last_green_sha`), a "green" badge, and the **`git worktree add ../<project>-review <sha>` command** ready to copy. It reads `last_green_sha` and `safe_to_test` from `docs/status.yaml`.
- The panel SHALL distinguish **"building now"** (the work order in progress, "don't test this yet") from the **"last probable point"** — they are two different things.
- IF `last_green_sha` is far behind HEAD (many commits/hours), it SHALL warn that the probable snapshot is getting stale.
- EACH project in the portfolio rail SHALL show **chips** with the number of **pending decisions** (amber) and **bugs in the inbox** (red), read from `pending_decisions` and `pending_bugs`.
- IF a project has `rethink_pending: true`, it SHALL indicate it (the build is going to pause for a major change).
- Mission Control's documentation SHALL explain the **three feedback channels** to an in-progress build: `/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide` (all via files, picked up at the next safe point).

## Non-goals
- Mission Control does NOT run `git worktree` nor start the dev server: it shows the command for the owner to run (read-only). In the future there could be a button that assembles it, but it remains the operator's action.

## Relationship
It complements Party ([FRD-06](frd-06-party.md)) and the work orders ([FRD-05](frd-05-work-orders.md)). The state is written by the project's gate script, not the agent (see `factory/standards/infra.md`).
