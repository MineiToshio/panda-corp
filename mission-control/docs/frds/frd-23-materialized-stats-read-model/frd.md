---
id: FRD-23
type: frd
title: FRD-23 — Materialized stats read-model
status: ACTIVE
implementation_status: IN_PROGRESS
ui: false
last_updated: '2026-07-06'
---
# FRD-23 — Materialized stats read-model (stop deriving git on every render)

The **Informe** tab of the Achievements Hall (FRD-10) and every **history-derived** metric Mission
Control today computes by shelling out to **git at render time** stop doing so on each navigation.
Instead the factory tooling materializes a **read-model ("portada")** per project — `.pandacorp/stats.json` —
that Mission Control only **reads**, so the cost of git is paid **once per project when it changes**,
not once per navigation. The goal is an Informe that is **practically independent of the number of
projects**: O(N) today (≈1.4 s at 30 projects, ≈4.7 s at 100), O(1) after (≈5 ms via an aggregate index).

This is a **cross-cutting platform capability**, not a visual change: the Informe looks identical
(REQ-10-020..027 unchanged); only the **source of its numbers** changes — from "derive in the render"
to "read the snapshot, fall back to live git only when the snapshot is missing/stale/corrupt".

> Supersedes the FRD-10 blueprint §3 "git-at-read-time in the render" contract for the Informe. See
> [ADR-0004](../../adr/ADR-0004-materialized-stats-read-model.md) for the architecture decision.

## Why this shape (design agreed with the owner)

1. **Portada per project** — `.pandacorp/stats.json`, an **honest cache** (DR-115): the already-derived
   numbers that feed the Informe (WOs verified per ISO week, ideas captured per week, phase transitions,
   scalars, lessons, funnel). **Single writer**, re-derived from git **at a safe point** — never with
   incremental `+1/-1` sums (that drifts and DR-115 forbids it).
2. **Aggregate index** — `sync-portfolio` (which already walks every project) joins the N portadas into
   **one file** MC reads in **O(1)**, independent of N.
3. **Self-validating freshness seal** — each portada stores a **seal** = the hash of the last commit
   touching the routes that feed the Informe: `git log -1 --format=%H -- docs/frds .pandacorp/status.yaml`
   (O(1), ~2 ms). On read, MC compares the seal against git's current state: **match → use the portada;
   mismatch / missing / corrupt → stale → fall back to live git**. Correctness does NOT depend on any
   particular writer having run.
4. **Universal write point, not tied to a skill** — the Informe mixes sources from many skills, so the
   write cannot depend on `/implement` closing. Regenerated from the Claude Code **Stop hook** and/or a
   git **`post-commit`** hook. Since every change that affects the Informe ends in a commit, the commit
   is the correct trigger and covers every path (direct hand edits, ideas/decisions/phases, single-FRD
   builds, "nobody regenerated yet").
5. **Honest fallback (fail-loud, DR-078)** — a missing / stale / corrupt portada makes MC fall back to
   the **live git reader for that project** (current behavior — correct, only slower). **Never lies,
   never breaks.** Atomic write (tmp + rename) so a mid-write crash never leaves corrupt JSON; a corrupt
   JSON is rejected by the fail-loud reader and triggers the fallback.
6. **Backfill** — a one-shot command walks git **once** per existing project to generate its initial
   portada.

**Excluded from the materialized model:** `getPendingMerge` (FRD-21, un-merged worktrees/branches)
stays **live** — it is state that must be fresh; caching it would show stale info exactly where
freshness matters.

## Acceptance criteria (EARS)

### REQ-23-001 — Portada reader (fail-loud, DR-078)
- **AC-23-001.1** — WHEN a project's `.pandacorp/stats.json` is present, well-formed and its seal
  **matches** the current git seal, Mission Control SHALL read the Informe numbers from the portada and
  NOT shell out to git for that project.
- **AC-23-001.2** — WHEN the portada is **missing**, Mission Control SHALL fall back to the live git
  reader for that project (current behavior), never a fabricated zero.
- **AC-23-001.3** — WHEN the portada exists but its **seal mismatches** the current git seal (stale),
  Mission Control SHALL treat it as stale and fall back to the live git reader for that project.
- **AC-23-001.4** — WHEN the portada is **present but unparseable/corrupt** (malformed JSON or an
  unrecognised shape), the reader SHALL **fail loud** (throw / explicit error variant) and the caller
  SHALL fall back to the live git reader — never a silent `[]`/`null` treated as "no activity" (DR-078).

### REQ-23-002 — Portada writer (single writer, honest cache, DR-115)
- **AC-23-002.1** — The writer SHALL re-derive the portada's numbers **from git** (the same values the
  live reader produces) and stamp the **seal** = `git log -1 --format=%H -- docs/frds .pandacorp/status.yaml`.
  It SHALL NEVER maintain the numbers with incremental `+1/-1` writes.
- **AC-23-002.2** — The write SHALL be **atomic** (write to a temp file, then rename) so a crash
  mid-write never leaves a corrupt `stats.json`.
- **AC-23-002.3** — The materialized numbers SHALL **equal** the numbers the live git reader derives for
  the same project (portada-vs-live equivalence), verified by an equivalence test.

### REQ-23-003 — Aggregate index (O(1) at any N)
- **AC-23-003.1** — `sync-portfolio` SHALL join every project's portada into one aggregate file MC reads
  in O(1); the Informe's cost SHALL be independent of the number of projects.
- **AC-23-003.2** — The aggregate reader SHALL itself be fail-loud: a malformed aggregate SHALL throw /
  return an explicit error, never a silent empty.

### REQ-23-004 — Backfill
- **AC-23-004.1** — A one-shot backfill command SHALL walk git once per existing project and generate
  its initial portada + seal, equivalent to what the live reader would produce.

### REQ-23-005 — Pending-merge stays live
- **AC-23-005.1** — `getPendingMerge` (FRD-21) SHALL NOT be materialized; it SHALL continue to read live
  git so un-merged worktree/branch state is never shown stale.

## Edge cases / error states (each maps to an AC)
- Portada present, seal matches → read portada (AC-23-001.1).
- Portada missing → live git fallback (AC-23-001.2).
- Portada stale (seal mismatch) → live git fallback (AC-23-001.3).
- Portada corrupt/unparseable → fail loud → live git fallback (AC-23-001.4).
- Mid-write crash → atomic rename means no half-written JSON is ever read (AC-23-002.2).
- New/never-built project with no history yet → portada with empty-but-explicit series, not an error.

## Out of scope
- The Informe's rendering / six bands (FRD-10 WO-10-015) — this FRD only changes the data source.
- Materializing `getPendingMerge` (explicitly excluded, AC-23-005.1).
- Any visual change — no `/pandacorp:design` pass needed.
