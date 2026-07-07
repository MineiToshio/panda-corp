# ADR-0004 — Materialized stats read-model (git at safe points, not at render time)

- **Status:** Accepted
- **Date:** 2026-07-06
- **Scope:** Platform-level (cross-feature), Mission Control
- **Decided by:** owner request (design agreed in full, change `materialized-stats-read-model`),
  implemented via FRD-23. Relates to FRD-10 (Informe), FRD-21 (pending-merge), DR-078, DR-115.

## Context

`/achievements` › Informe derives its metrics with `execSync` of git in the Server Component, on every
navigation, and is **O(N projects)**: `phaseTransitions` iterates the whole portfolio with a `git log -p`
per project; `weeklyFlow` and `scalars` also go to git. With 3 projects ≈140 ms today (already down from
~2.5 s to ~0.45 s in `ca82bbba`, which collapsed the per-row subprocesses to one per project). But it
projects linearly: **~1.4 s at 30 projects, ~4.7 s at 100**. The previous fix lowered the *constant*,
not the *complexity*: git-in-render does not scale.

Git remains the **atomic source** — it is the only complete, retroactive history; the event stream does
not have it. So the answer is not "stop using git" but "stop reading git in the render".

## Decision

Materialize a **read-model ("portada")** per project — `.pandacorp/stats.json` — that Mission Control
only **reads**. The cost of git is paid **once per project when it changes**, not per navigation.

1. **Portada per project** (`stats.json`) — an **honest cache** (DR-115): single writer, re-derived from
   git at safe points, never maintained by incremental `+1/-1` writes.
2. **Aggregate index** — `sync-portfolio` joins the N portadas into one file MC reads in **O(1)**.
3. **Self-validating freshness seal** — each portada stores `seal = git log -1 --format=%H -- docs/frds
   .pandacorp/status.yaml` (O(1)). On read MC compares the seal to git's current state: match → use the
   portada; mismatch/missing/corrupt → stale → fall back to live git. **Correctness does not depend on
   any particular writer having run.**
4. **Universal write point** — regenerated from the Claude Code **Stop hook** and/or a git **`post-commit`**.
   Every change that affects the Informe ends in a commit, so the commit is the correct trigger and covers
   all paths (direct hand edits, ideas/decisions/phases, single-FRD builds).
5. **Honest fallback (fail-loud, DR-078)** — missing/stale/corrupt portada → fall back to the live git
   reader for that project (current, correct, only slower). Atomic write (tmp + rename) so a crash never
   leaves corrupt JSON; a corrupt JSON is rejected by the fail-loud reader → fallback.
6. **Backfill** — a one-shot command walks git once per existing project to seed its portada.

**Read-only invariant, refined.** The **writers** live in the **factory tooling** (Stop hook /
`post-commit` / `sync-portfolio` / backfill), NOT in the Mission Control app. The MC app stays read-only
over `stats.json` + the aggregate + (fallback) live git. MC's bounded write set (`lib/discard/`,
ADR-0002/0003) is unchanged.

**Explicitly excluded from materialization:** `getPendingMerge` (FRD-21, un-merged worktrees/branches)
stays **live** — it is state that must be fresh; caching it would show stale info exactly where freshness
matters most.

## SSOT correction (2026-07-06, change `stats-ssot-split-factory-facts`)

The FRD-23 gate surfaced a DR-115 defect in decision §1 above: the **per-project** portada stored
**factory-wide** facts — `phaseTransitions` (walks the whole portfolio), `scalars.projects`
(`readPortfolio().length`), `scalars.decisions` (the factory decision registry) and `lessons` (over
`factory/memory/`). Two failures follow:

1. **N writers for one fact.** The portada writer runs once per project, so each factory-wide fact is
   re-derived and stored N times — the DR-115 single-writer rule violated.
2. **The seal cannot validate what it guards.** The per-project seal (`git log -1 -- docs/frds
   .pandacorp/status.yaml` of that project) does not watch the factory-wide routes. A phase change in
   project B invalidates the `phaseTransitions` embedded in A's portada, but A's seal is unchanged → A is
   served **fresh with stale data from B**. Latent while nothing is materialized (MC falls back to live
   git); it surfaces at ≥2 materialized projects.

**Corrected decision:** split the read-model by **scope**.

- **Factory-scoped store** `<factory-root>/.pandacorp/stats-factory.json` holds the factory-wide facts,
  written by **one** writer, with its **own factory-wide seal** = the last commit touching
  `factory/portfolio.md` + `factory/decisions/` + `factory/memory/` + every project's `status.yaml`.
- **Per-project portada** keeps only per-project facts (`weeklyFlow`, `scalars.frds`/`scalars.commits`,
  `funnel`); its per-project seal now validates 100% of its contents.
- **The reader composes both**, each with an **independent** fail-loud fallback to live git (DR-078): a
  factory-seal mismatch re-derives / falls back for the factory-wide facts only, leaving valid per-project
  facts untouched, and vice-versa. Never a fabricated zero.

This **supersedes** decision §1 (portada as the sole honest cache of *all* Informe facts). §2 (aggregate
index of per-project portadas), §3–§6 and the read-only invariant are unchanged; the factory store is a
second honest cache under the same DR-115/DR-078 contract. Implemented via FRD-23 REQ-23-006/007.

## Consequences

- Informe becomes practically independent of N: ~5 ms via the aggregate index (~35 ms reading N portadas
  at 100 projects) vs ~4.7 s of git-in-render at 100.
- The live git readers (`src/lib/achievements/report/*`, WO-10-014) are **kept** — as the fallback path
  and the equivalence reference; the writer derives against their pure cores (DR-092, no re-implementation).
- A new artifact (`stats.json`) per project + one aggregate; both governed by the fail-loud contract
  (DR-078) and the single-writer / honest-cache contract (DR-115).
- Supersedes the FRD-10 blueprint §3 "git-at-read-time in the render" contract for the Informe.
