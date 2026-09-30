---
id: FRD-23
type: frd
title: FRD-23 — Materialized stats read-model
status: ACTIVE
implementation_status: VERIFIED
ui: false
last_updated: '2026-09-30'
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
   **per-project, sealed** numbers that feed the Informe (WOs verified per ISO week `woFlow`, the FRD
   count `scalars.frds`). **Single writer**, re-derived from git **at a safe
   point** — never with incremental `+1/-1` sums (that drifts and DR-115 forbids it). It holds **only
   per-project facts**, so its **per-project seal validates everything it contains** (see §Portada
   scope-split below).
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

## Portada scope-split — factory-wide facts leave the per-project portada (SSOT correction, DR-115/DR-116)

The original contract stored **factory-wide** facts inside the **per-project** portada — `phaseTransitions()`
(walks the whole portfolio), `scalars.projects` (`readPortfolio().length`), `scalars.decisions` (the
factory-wide decision registry) and `lessons` (over `factory/memory/`). Two defects follow, confirmed by
the reviewer at the FRD-23 gate:

1. **Duplicated writer (DR-115).** The writer runs **once per project**, so each factory-wide fact is
   re-derived and stored **N times** (once per portada). Factory-wide facts must have **one writer**, not N.
2. **Seal cannot validate what it guards.** The per-project seal
   (`git log -1 -- docs/frds .pandacorp/status.yaml` of THAT project) does **not** watch the factory-wide
   routes. A phase change in project **B** invalidates the `phaseTransitions` embedded in project **A**'s
   portada, but A's seal does not detect it → **A reads "fresh" with stale data from B**. Latent today (no
   materialized `stats.json`, MC falls back to live git), it surfaces the moment ≥2 projects are materialized.

**The corrected contract:** factory-wide facts move to **one factory-scoped store** with its **own
factory-wide seal**; the per-project portada keeps **only per-project facts**, so each seal validates
exactly what its store contains.

- **Factory store** — `<factory-root>/.pandacorp/stats-factory.json`: holds `phaseTransitions`,
  `scalars.projects`, `scalars.decisions`, `lessons`. **Single writer**, re-derived at a safe point
  (`sync-portfolio` already walks the whole factory → the natural point; and/or the universal per-commit
  trigger), atomic (tmp+rename), fail-loud.
- **Factory seal** = the last commit touching the factory-wide routes:
  `factory/portfolio.md` + `factory/decisions/` + `factory/memory/` + the `status.yaml` of **all** projects.
  It validates everything the factory store contains.
- **Per-project portada** — keeps only `woFlow` (WO-verified per week) and `scalars.frds`; its existing
  per-project seal now validates 100% of its contents (see §Seal coverage below).
- **Reader composes both, each with an independent fail-loud fallback (DR-078):** factory-wide facts from
  the factory store (validated by the factory seal) + per-project facts from the portada (validated by the
  per-project seal). A factory-seal mismatch re-derives / falls back to live **only the factory-wide facts**,
  leaving the per-project facts untouched, and vice versa. Never a fabricated zero.

> **Supersedes** this FRD's original §"Why this shape" item 1 (portada held factory-wide facts) and
> [ADR-0004](../../adr/ADR-0004-materialized-stats-read-model.md) §1. See ADR-0004 §"SSOT correction".

## Seal coverage — unsealed facts are always live (decided 2026-09-30, DR-115)

A store may hold a fact only if its seal validates it. Three facts the portada used to hold escaped the
per-project seal (`git log -1 -- docs/frds .pandacorp/status.yaml`), so a **fresh** portada served them
stale (proved with real data: sealed `commits=1096` vs live `1101`, same seal):

- `scalars.commits` (`git rev-list --count HEAD`): any commit of the repo moves it, not only the sealed routes.
- `funnel`: derived from `factory/ideas/` (gitignored, no commit ever invalidates a seal) **and** from every
  project's status (not per-project at all).
- the ideas-per-week series (`weeklyFlow.ideasCaptured` / `ideasWithoutCreated`): `factory/ideas/` again.

**Contract:** they are not materialized in either store and are always read live (`commits` via
`git rev-list --count` O(1); `funnel` and the ideas series from files the page already reads). The
expensive git walk (WO-verified series from `git log -p docs/frds`) stays materialized, which is the
whole point of the portada. The portada keeps `woFlow` + `scalars.frds` only; `peakWeek` is part of
`woFlow` (one derivation). A portada written in the previous shape (`weeklyFlow`/`funnel` keys) no longer
parses: the fail-loud reader returns `unparseable`, the caller falls back to live git, and the next
`pnpm stats:backfill` / commit-trigger regeneration rewrites it.

> **Supersedes** REQ-23-001/002 wording that listed `weeklyFlow`, `scalars.commits` and `funnel` as portada
> contents. Decision record: `docs/decision-log.md` 2026-09-30.

**Excluded from the materialized model:** `getPendingMerge` (FRD-21, un-merged worktrees/branches)
stays **live** — it is state that must be fresh; caching it would show stale info exactly where
freshness matters.

## Acceptance criteria (EARS)

### REQ-23-001 — Portada reader (fail-loud, DR-078)
- **AC-23-001.1** — WHEN a project's `.pandacorp/stats.json` is present, well-formed and its seal
  **matches** the current git seal, Mission Control SHALL read the **sealed** Informe numbers (the WO-verified
  series and the FRD count) from the portada and NOT shell out to the `docs/frds` git history for that project.
- **AC-23-001.5** — The portada SHALL NOT hold any fact its seal does not validate: `commits`, `funnel` and
  the ideas-per-week series SHALL be read live even beside a fresh portada, and a live failure to derive
  one of them SHALL surface as an explicit error result, never a fabricated zero (DR-078).
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

### REQ-23-006 — Factory-scoped store for factory-wide facts (SSOT split, DR-115)
- **AC-23-006.1** — Factory-wide facts (`phaseTransitions`, `scalars.projects`, `scalars.decisions`,
  `lessons`) SHALL be stored in **one** factory-scoped store `<factory-root>/.pandacorp/stats-factory.json`,
  written by a **single writer** that re-derives them from git (via the existing pure `derive*` cores,
  DR-092) — never with incremental writes, and NOT duplicated once per project.
- **AC-23-006.2** — The factory store SHALL stamp a **factory-wide seal** = the hash of the last commit
  touching `factory/portfolio.md`, `factory/decisions/`, `factory/memory/` and every project's
  `.pandacorp/status.yaml`. A change to any of these routes (e.g. a phase change in project B) SHALL make
  the seal mismatch and the store be treated as stale.
- **AC-23-006.3** — The write SHALL be **atomic** (tmp + rename); the reader SHALL be **fail-loud**
  (DR-078): a missing / stale / malformed factory store returns an explicit reason, never a silent empty.
- **AC-23-006.4** — The per-project portada SHALL NO LONGER contain factory-wide facts; it holds only
  `woFlow` (WO-verified per week) and per-project `scalars` (`frds`), all validated by the per-project seal
  (amended 2026-09-30: `weeklyFlow`'s ideas half, `scalars.commits` and `funnel` left it, AC-23-001.5).

### REQ-23-007 — Composed reader (per-project + factory-wide, independent fallback)
- **AC-23-007.1** — The Informe reader SHALL compose factory-wide facts from the factory store (validated
  by the factory seal) with per-project facts from the portada (validated by the per-project seal).
- **AC-23-007.2** — A **factory-seal mismatch** SHALL fall back to live git for the **factory-wide facts
  only**, leaving valid per-project facts untouched (and vice-versa). Neither fallback SHALL fabricate a
  zero (DR-078).
- **AC-23-007.3** (regression) — GIVEN two materialized projects A and B, WHEN a phase change in B
  invalidates the factory-wide facts, project A's Informe SHALL NOT be served with stale factory-wide data:
  the factory seal SHALL mismatch and A SHALL re-derive / fall back for those facts. (This is the exact
  defect the split fixes.)

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
