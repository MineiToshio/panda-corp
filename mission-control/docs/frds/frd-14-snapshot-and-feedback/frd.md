---
id: FRD-14
type: frd
title: FRD-14 — Probable snapshot and feedback channels
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-10-22'
floor: false
---
# FRD-14 — Probable snapshot and feedback channels

What Mission Control shows to operate an unattended build: which is the **last build commit that passed all gates** (safe to test), what is being built right now, and the channels to feed it feedback without stopping. Derived from [docs/proposals/07-unattended-build.md](../../../../docs/proposals/07-unattended-build.md). Read-only.

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype has no portfolio rail, so the rail chips go out of v2 (owner decision 2026-10-21, prefixed **Out of v2**). The owner decided at M1 (2026-10-22) to DRAW the snapshot panel in the project Resumen (state `project-snapshot`, below La Fragua, only while a build runs). Source: `docs/design/freeze/reconciliation.md` (B-10, B-35, B-38, B-40, B-52).

## What "green" means here (canonical copy)

The "green" point is the **last build commit that passed all the gates** (tests/type/lint/build/smoke — "en verde"), and is therefore **safe to test in a separate `git worktree` while the build keeps running**. It is NOT a local-vs-remote git distinction, and the UI does NOT use the old "punto verde" jargon. The **staleness warning** means exactly: that green commit has fallen **far behind the build's current HEAD**, so testing it no longer reflects what the build has produced since.

## Acceptance criteria (EARS)

### REQ-14-001 — Green snapshot panel
- **AC-14-001.1** — FOR each project being built, Mission Control SHALL show, in the project Resumen below La Fragua and ONLY while a build is running and a `last_green_sha` exists, a **snapshot panel** presenting the **last build commit that passed all gates** ("último commit en verde · seguro para probar"), the FRD it closed, and the **`git worktree add /Users/Shared/review-worktrees/<project> <sha>` command** ready to copy (the review worktree lives under the canonical review-worktrees root, outside `Proyectos/` — DR-090). It reads `last_green_sha` and `safe_to_test` from `.pandacorp/status.yaml`.
- **AC-14-001.2** — The copy SHALL state that the green commit is **safe to test in a separate git worktree while the build continues** — it SHALL NOT frame it as a local-vs-remote git matter, nor use the "punto verde" term.
- **AC-14-001.3** — The panel SHALL distinguish **"building now"** (the work order in progress — "this is not green yet, don't test it") from the **last green commit** — they are two different things.

### REQ-14-002 — Staleness warning
- **AC-14-002.1** — IF the last green commit (`last_green_sha`) is **far behind the build's current HEAD** (many commits/hours), THEN Mission Control SHALL warn that the green commit has fallen behind the build, and that testing it no longer reflects the build's current state.
- **AC-14-002.2** — (amended 2026-10-22, gate fix) WHILE `status.yaml` claims `running: true`, THE panel SHALL show "building
  now" ONLY when the claim is LIVE — `running` AND a fresh signal, where the signal is the freshest of the
  supervisor heartbeat and the latest event (DR-066: never the flag alone). WHEN that signal is older than the freshness
  TTL (10 min) or absent, THE panel SHALL show "Sin señal · último evento hace N" instead — the flag is
  never dressed up as a live build. The panel SHALL read this state from the one resolver `buildSignal()` (via `WorkspaceProject.build`),
  the same rule as FRD-06 AC-06-019.7 (state `build-no-signal`), so the Resumen can never show «Construyendo» and «Sin señal» together (DR-115).
  (Change `mc-observability-consumer-dr066`, 2026-07-02.)

### REQ-14-003 — Portfolio chips & feedback channels
- **AC-14-003.1** — **Out of v2 (owner decision 2026-10-21; the rail is gone, the decisions count is a column of the Lista view, FRD-03 AC-03-008.2):** EACH project in the portfolio rail SHALL show **chips** with the number of **pending decisions** (amber) and **bugs in the inbox** (red), derived live from the project's inbox (`readStatusWithLiveInboxCounts` — DR-092/DR-115), never a status.yaml counter.
- **AC-14-003.2** — **Out of v2 (owner decision 2026-10-21; the rail is gone):** IF a project has `rethink_pending: true`, it SHALL indicate it (the build is going to pause for a major change).
- **AC-14-003.3** — Mission Control's Documentación SHALL explain the **three feedback channels** to an in-progress build: `/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide` (all via files, picked up at the next safe point).

### REQ-14-004 — Portfolio-rail decision/bug chips (traceability)
> Reconciled 2026-07-05 — the blueprint and `wo-14-003` track the portfolio-rail chips under this id; it is the same behaviour as AC-14-003.1, given its own REQ anchor so the spine resolves.
- ~~**AC-14-004.1** — EACH portfolio-rail row SHALL show an amber **pending-decisions** chip when `> 0` and a red **pending-bugs** chip when `> 0`, both derived live from the project's inbox (`readStatusWithLiveInboxCounts`, DR-092/DR-115), never a status.yaml counter.~~ **Struck (amended 2026-10-22, v2 plan; retired id, never reused):** a traceability duplicate of AC-14-003.1, which is itself out of v2 (owner decision 2026-10-21; the rail is gone).

### REQ-14-005 — Rethink indicator + feedback channels (traceability)
> Reconciled 2026-07-05 — same behaviour as AC-14-003.2/.3, anchored so `wo-14-003`'s citation resolves.
- ~~**AC-14-005.1** — IF a project has `rethink_pending: true`, the rail SHALL indicate it. The Documentación SHALL explain the three feedback channels (`/pandacorp:bug`, `/pandacorp:iterate`, `/pandacorp:decide`).~~ **Struck (amended 2026-10-22, v2 plan; retired id, never reused):** a traceability duplicate of AC-14-003.2 (out of v2, the rail is gone) and AC-14-003.3 (the feedback-channels explanation, which stays and is owned there).

## Non-goals
- Mission Control does NOT run `git worktree` nor start the dev server: it shows the command for the owner to run (read-only). In the future there could be a button that assembles it, but it remains the operator's action.

## Relationship
It complements La Fragua ([FRD-06](../frd-06-party/frd.md)), the Resumen that hosts the snapshot panel ([FRD-04](../frd-04-project-workspace/frd.md) REQ-04-005) and the work orders ([FRD-05](../frd-05-work-orders/frd.md)). The state is written by the project's gate script, not the agent (see `factory/standards/infra.md`).
