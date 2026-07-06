---
id: WO-23-004
type: work-order
slug: aggregate-regen-backfill
title: 'WO-23-004 — Aggregate index + Stop/post-commit regeneration + one-shot backfill'
status: ACTIVE
parent: FRD-23
implementation_status: IN_REVIEW
reopen_count: 0
source_requirements: [REQ-23-003, REQ-23-004]
artifacts: [src/lib/achievements/read-model/**, scripts/**]
difficulty: high
dependsOn: [WO-23-002]
last_updated: '2026-07-06'
---
# WO-23-004 — Aggregate index, universal regeneration & backfill

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Contract in
[`frd.md`](../frd.md) (REQ-23-003, REQ-23-004); design in [`blueprint.md`](../blueprint.md) §3.

## Goal
The **O(1)** aggregate index (from `sync-portfolio`), the **universal write trigger** (Stop hook /
git `post-commit`) so any change that ends in a commit regenerates the portada, and the one-shot
**backfill** for existing projects.

## In scope
- Extend the `sync-portfolio` portfolio walk to write the aggregate index (`StatsAggregate`) from the N
  portadas; a malformed aggregate reader (WO-23-001) fails loud.
- Regeneration trigger: the Claude Code **Stop hook** and/or a git **`post-commit`** calls
  `writeStatsPortada` for the affected project(s). Commit = the correct universal trigger (covers direct
  hand edits, ideas/decisions/phases, single-FRD builds).
- One-shot **backfill** command over existing projects calling `writeStatsPortada` once each.

## Acceptance criteria (EARS)
- **AC-23-003.1** — aggregate joins every portada into one file read in O(1); Informe cost independent of N.
- **AC-23-003.2** — malformed aggregate → fail loud, never a silent empty.
- **AC-23-004.1** — backfill generates each project's initial portada equivalent to the live reader.

## TDD plan
RED: aggregate join test (N portadas → one file → O(1) read; malformed → fail loud); backfill
equivalence test. GREEN: implement. Refactor.

## Definition of done
`pnpm vitest run lib/achievements` green; tsc + biome clean; no `any`; `.pandacorp/verify.sh` passes.

## Status Note

**Built (IN_REVIEW).** The O(1) aggregate index (join of the N portadas), the universal write
trigger (commit-driven regeneration invoked by the Stop / `post-commit` hook), and the one-shot
backfill for existing projects. Builds on WO-23-001 (reader/seal/schema) and WO-23-002
(`writeStatsPortada`); re-uses them, never re-implements a derivation (DR-092/DR-115). Factory
tooling only — MC stays read-only over the read-model (architecture §7, ADR-0004).

### Files
- `src/lib/achievements/read-model/aggregate.ts` — the O(1) join: `buildStatsAggregate` (pure),
  `writeStatsAggregate` (atomic tmp+rename), `syncStatsAggregate` (walk N projects → one index).
- `src/lib/achievements/read-model/backfill.ts` — `runBackfill` (one portada write per project,
  fail-loud-tolerant).
- `src/lib/achievements/read-model/regen.ts` — `regenerateForCommit` (the universal write point;
  degrades honestly, never aborts the commit).
- `scripts/read-model/ts-loader.mjs` — zero-dep Node ESM resolve hook (resolves `@/` + extensionless
  `.ts` so the CLIs run the project TS via Node's native type-stripping; NO `tsx`/`ts-node`/`jiti`).
- `scripts/read-model/{regen,sync-aggregate,backfill}.mjs` — thin CLIs over the cores.
- `scripts/read-model/README.md` — hook-wiring doc (git `post-commit` + Stop hook snippets).
- `package.json` — `stats:regen` / `stats:sync-aggregate` / `stats:backfill` npm scripts.
- Tests: `_tests/{aggregate,backfill,regen}.test.ts` (20 new, RED-proven).

### Interfaces / contracts exposed (signatures)
```ts
// aggregate.ts
const STATS_AGGREGATE_FILENAME = "stats-aggregate.json"
type PortadaJoinEntry = { projectKey: string; portada: StatsPortada }
type AggregateSyncProject = { projectKey: string; projectPath: string }
type AggregateSyncSummary = { joined: number; skipped: { projectKey: string; reason: "missing"|"unparseable" }[] }
buildStatsAggregate(entries: readonly PortadaJoinEntry[]): StatsAggregate            // pure join
writeStatsAggregate(filePath: string, aggregate: StatsAggregate): void               // atomic tmp+rename
syncStatsAggregate(projects, aggregatePath, deps?): AggregateSyncSummary             // walk → join → write

// backfill.ts
type BackfillSummary = { written: readonly string[]; skipped: { projectPath; reason: string }[] }
runBackfill(projectPaths: readonly string[], deps?: { writePortada }): BackfillSummary

// regen.ts
type RegenOutcome = { ok: true; written: string } | { ok: false; reason: string }
regenerateForCommit(projectPath: string, deps?: { writePortada }): RegenOutcome      // never throws on a derive failure
```

### Integration seams (for WO-23-003 wiring, sync-portfolio, and the hooks)
- **`/pandacorp:sync-portfolio`** runs `pnpm stats:sync-aggregate` after its portfolio walk — it reads
  each portfolio row's project, joins the parseable portadas into
  `<factory-root>/.pandacorp/stats-aggregate.json`, which MC reads in O(1) via `readStatsAggregate`
  (WO-23-001). A skipped project is reported, never silently absorbed.
- **Universal write trigger**: a git `post-commit` hook (and/or the Claude Code Stop hook) runs
  `pnpm stats:regen` in the committed repo — see `scripts/read-model/README.md` for the exact snippet.
- **Backfill**: run `pnpm stats:backfill` once after FRD-23 ships to materialize existing projects.

### Decisions & assumptions the consumer inherits
- **Aggregate join does NOT seal-validate (staleness is a read-time concern).** `syncStatsAggregate`
  reads each portada with a **parse-only** reader (present+parseable → joined *even if stale*;
  `missing`/`unparseable` → skipped). Per-project freshness is validated at the point of use by
  `readStatsPortada` (WO-23-001 Status Note explicitly reserved seal validation for read time — a
  join may hold independently-stale entries). Consequence: the aggregate is a snapshot; MC still
  seal-checks each project on read and falls back to live git for a stale one.
- **`AggregateSyncSummary.skipped[].reason` is `"missing" | "unparseable"` only** (no `"stale"`, by
  the point above). `BackfillSummary`/`RegenOutcome` reasons are the raw `PortadaDeriveError.message`.
- **Aggregate location**: `<factory-root>/.pandacorp/stats-aggregate.json` (factory root =
  `resolveFactoryRoot()`); per-project portada stays `<projectPath>/.pandacorp/stats.json`. Both are
  **gitignored runtime caches** (re-derivable), never committed.
- **`projectKey`** = the portfolio row's raw path cell (verbatim) — the aggregate's `projects` record
  key; the resolved absolute path is used only to locate the portada file. Duplicate key →
  last-write-wins (the portfolio controls uniqueness).
- **Honest degrade (DR-078 + resilience).** `regenerateForCommit` and `runBackfill` catch ONLY
  `PortadaDeriveError` (git unavailable / a non-`ok` source) and report it as a skip — the commit is
  never aborted, the backfill never dies on one project; the reader's live-git fallback covers the
  gap. Any OTHER error (permissions, disk) is re-thrown, never swallowed (error-handling rule).
- **No new dependency (DR-052).** The CLIs run the project's TS through a hand-written 60-line Node
  resolve hook (`ts-loader.mjs`) + Node's native type-stripping (Node ≥ 23; the launchd/hook runtime
  here is Node 25). This avoids adding `tsx`/`ts-node`/`jiti`. `writeStatsAggregate` mirrors
  `writePortadaAtomic`'s tmp+rename (no `write-file-atomic` pkg).
- **`ui: false`** — no mock / visual-fidelity pass applies (pure data/tooling WO).

### Tests (all green, RED-proven) — `_tests/{aggregate,backfill,regen}.test.ts` (20 tests)
- **aggregate**: pure join keyed by project (AC-23-003.1); round-trips through the fail-loud parser;
  empty portfolio → explicit `{}`; duplicate key last-wins; atomic write → O(1) reader read;
  fail-loud on a malformed aggregate + missing vs. corrupt distinction (AC-23-003.2); `syncStatsAggregate`
  joins N on-disk portadas, skips missing, skips corrupt (real-fs fixtures + a corrupt one, DR-078).
- **backfill**: one write per project, once each (AC-23-004.1); skips an un-derivable project without
  aborting; re-throws an unexpected error; empty list no-op; **end-to-end** against the real MC repo
  → the reader reads it back fresh.
- **regen**: writes the affected project's portada; **degrades honestly** (never throws) on a derive
  failure; re-throws an unexpected error; **end-to-end** against the real MC repo.

### Self-test (green)
`pnpm biome check .` (785 files, clean) · `pnpm tsc --noEmit` (clean) · `pnpm vitest run
src/lib/achievements/read-model` (8 files, 65 tests) · knip (exit 0) · madge (no cycles). All three
CLIs verified end-to-end against real data (`regen` wrote MC's portada; `sync-aggregate` joined 1/3
with the other two correctly skipped `missing`; `backfill .` wrote 1/1). No `any`/`@ts-ignore`.
