---
id: FRD-14
type: frd
title: FRD-14 — Probable snapshot and feedback channels
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-21'
---
# FRD-14 — Probable snapshot and feedback channels

What Mission Control shows to operate an unattended build: which is the **last build commit that passed all gates** (safe to test), what is being built right now, and the channels to feed it feedback without stopping. Derived from [docs/proposals/07-unattended-build.md](../../../../docs/proposals/07-unattended-build.md). Read-only.

## What "green" means here (canonical copy)

The "green" point is the **last build commit that passed all the gates** (tests/type/lint/build/smoke — "en verde"), and is therefore **safe to test in a separate `git worktree` while the build keeps running**. It is NOT a local-vs-remote git distinction, and the UI does NOT use the old "punto verde" jargon. The **staleness warning** means exactly: that green commit has fallen **far behind the build's current HEAD**, so testing it no longer reflects what the build has produced since.

## Acceptance criteria (EARS)

### REQ-14-001 — Green snapshot panel
- **AC-14-001.1** — FOR each project being built, Mission Control SHALL show a **snapshot panel** presenting the **last build commit that passed all gates** ("último commit en verde · seguro para probar"), the FRD it closed, and the **`git worktree add /Users/Shared/review-worktrees/<project> <sha>` command** ready to copy (the review worktree lives under the canonical review-worktrees root, outside `Proyectos/` — DR-090). It reads `last_green_sha` and `safe_to_test` from `.pandacorp/status.yaml`.
- **AC-14-001.2** — The copy SHALL state that the green commit is **safe to test in a separate git worktree while the build continues** — it SHALL NOT frame it as a local-vs-remote git matter, nor use the "punto verde" term.
- **AC-14-001.3** — The panel SHALL distinguish **"building now"** (the work order in progress — "this is not green yet, don't test it") from the **last green commit** — they are two different things.

### REQ-14-002 — Staleness warning
- **AC-14-002.1** — IF the last green commit (`last_green_sha`) is **far behind the build's current HEAD** (many commits/hours), THEN Mission Control SHALL warn that the green commit has fallen behind the build, and that testing it no longer reflects the build's current state.
- **AC-14-002.2** — WHILE `status.yaml` claims `running: true`, THE panel SHALL show "building
  now" ONLY when the claim is LIVE — `running` crossed with the supervisor heartbeat's recency
  (DR-066: liveness = running AND fresh, never the flag alone). WHEN the heartbeat is stale
  (≥ the 10-min TTL) or absent, THE panel SHALL show a "sin señal" note instead — the flag is
  never dressed up as a live build. (Change `mc-observability-consumer-dr066`, 2026-07-02.)

### REQ-14-003 — Portfolio chips & feedback channels
- **AC-14-003.1** — EACH project in the portfolio rail SHALL show **chips** with the number of **pending decisions** (amber) and **bugs in the inbox** (red), derived live from the project's inbox (`readStatusWithLiveInboxCounts` — DR-092/DR-115), never a status.yaml counter.
- **AC-14-003.2** — IF a project has `rethink_pending: true`, it SHALL indicate it (the build is going to pause for a major change).
- **AC-14-003.3** — Mission Control's documentation SHALL explain the **three feedback channels** to an in-progress build: `/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide` (all via files, picked up at the next safe point).

### REQ-14-004 — Portfolio-rail decision/bug chips (traceability)
> Reconciled 2026-07-05 — the blueprint and `wo-14-003` track the portfolio-rail chips under this id; it is the same behaviour as AC-14-003.1, given its own REQ anchor so the spine resolves.
- **AC-14-004.1** — EACH portfolio-rail row SHALL show an amber **pending-decisions** chip when `> 0` and a red **pending-bugs** chip when `> 0`, both derived live from the project's inbox (`readStatusWithLiveInboxCounts`, DR-092/DR-115), never a status.yaml counter.

### REQ-14-005 — Rethink indicator + feedback channels (traceability)
> Reconciled 2026-07-05 — same behaviour as AC-14-003.2/.3, anchored so `wo-14-003`'s citation resolves.
- **AC-14-005.1** — IF a project has `rethink_pending: true`, the rail SHALL indicate it; AND the documentation SHALL explain the three feedback channels (`/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide`).

## Non-goals
- Mission Control does NOT run `git worktree` nor start the dev server: it shows the command for the owner to run (read-only). In the future there could be a button that assembles it, but it remains the operator's action.

## Relationship
It complements Party ([FRD-06](../frd-06-party/frd.md)) and the work orders ([FRD-05](../frd-05-work-orders/frd.md)). The state is written by the project's gate script, not the agent (see `factory/standards/infra.md`).
