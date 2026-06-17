---
id: WO-15-001
type: work-order
slug: sync-readers
title: 'WO-15-001 — `lib/plugin-sync` readers (installed SHA, plugin HEAD SHA, dirty)'
status: DRAFT
parent: FRD-15
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-15-001 — `lib/plugin-sync` readers (installed SHA, plugin HEAD SHA, dirty)

> **STATUS: BLOCKED** — WO-15-001 implementation is APPROVED (53/53 tests green, review at `docs/reviews/wo-15-001-review.md`) but `verify.sh` global is RED due to unrelated FRD-12 `rate.ts` prototype-pollution bug (10 failing tests in `rate.test.ts` reviewer adversarial suite) and a Biome import-order error in `timeline.adversarial.test.ts`. No commit will be made until `verify.sh` is green. See `.pandacorp/comms/progress.md` for the full notification and `.pandacorp/status.yaml` for blocked state.

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-15-sync`) · [architecture §4.7, §6, §7](../../../product/architecture.md).

## Goal
The three primitive read functions of `lib/plugin-sync.ts`, each defensive (unreadable → `null`/`false`,
never throws). No verdict yet (that is WO-15-002).

## Scope
- `readInstalledSha(claudeHome): string | null` — parse `~/.claude/plugins/installed_plugins.json`,
  locate the `pandacorp@panda-corp` entry, return its `gitCommitSha`. Reads the `gitCommitSha`, NEVER
  the semver `version`.
- `readPluginHeadSha(factoryRoot): string | null` — `git log -1 --format=%H -- plugin/` via
  read-only `execFileSync('git', …)`, cwd = factoryRoot.
- `readPluginDirty(factoryRoot): boolean` — `git status --porcelain -- plugin/`, `true` iff output non-empty.

## Acceptance criteria (from REQ-15-001/002, evidence for the verdict)
- **AC-15-001.1** GIVEN a fixture `installed_plugins.json` with `pandacorp@panda-corp` → `gitCommitSha`,
  `readInstalledSha` returns that SHA.
- **AC-15-001.2** GIVEN the file is missing, malformed JSON, or has no `pandacorp@panda-corp` entry →
  returns `null` (no throw).
- **AC-15-001.3** GIVEN the entry has a `version` but the test asserts it is NOT returned (guards the
  "never compare version" invariant) → only `gitCommitSha` is read.
- **AC-15-001.4** `readPluginHeadSha` returns the 40-char SHA from `git log -1 … -- plugin/` in a
  fixture/temp git repo; returns `null` when cwd is not a git repo or git is unavailable.
- **AC-15-001.5** `readPluginDirty` returns `true` when `git status --porcelain -- plugin/` is non-empty,
  `false` when clean, `false` (not throw) when not a repo.

## TDD
Write `lib/plugin-sync.test.ts` first. Fixtures: a small `installed_plugins.json` tree under a
`PANDACORP_FACTORY_ROOT`-style fixture; for git, a throwaway temp repo created in the test
(`git init`, a commit touching `plugin/`) or mock `execFileSync`. Reads are pure given inputs.

## Definition of done
- RED → GREEN → refactor; all ACs covered.
- `execFileSync` uses the arg-array form (no shell) and read-only git verbs only.
- No `any`, no `@ts-ignore`. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-01 `lib/config.ts` (`resolveFactoryRoot`, `PANDACORP_FACTORY_ROOT`) — shipped.

## Status Note

**What was built:** `lib/plugin-sync.ts` — the three defensive reader primitives for FRD-15. Previously implemented but held in BLOCKED state because the global `verify.sh` was red due to unrelated FRD-12 issues. Those issues are now resolved; `verify.sh` is fully green (125 files, 3532 tests, tsc clean, biome clean).

**Interfaces/contracts exposed (`IF-15-sync`, partial — readers only, no verdict):**

```ts
// lib/plugin-sync.ts
export function readInstalledSha(claudeHome: string): string | null;
// Reads ~/.claude/plugins/installed_plugins.json → gitCommitSha of pandacorp@panda-corp.
// Returns trimmed SHA string, or null on any failure. Never throws. Never reads semver version.

export function readPluginHeadSha(factoryRoot: string): string | null;
// Runs: git log -1 --format=%H -- plugin/  (arg-array, no shell, read-only)
// Returns 40-char hex SHA, or null when not a git repo / plugin/ never touched. Never throws.

export function readPluginDirty(factoryRoot: string): boolean;
// Runs: git status --porcelain -- plugin/  (arg-array, no shell, read-only)
// Returns true when output is non-empty (uncommitted changes under plugin/).
// Returns false on clean tree, non-repo, or any error. Never throws.
```

**Integration seams for WO-15-002 (`getPluginSyncState`):**
- `readInstalledSha` output is whitespace-trimmed (SHA hygiene) — safe for direct string equality in the drift verdict.
- `readPluginHeadSha` output is also trimmed (`.trim()` on `execFileSync` output).
- Both return `null` on any unreadable input; `readPluginDirty` returns `false`. The verdict (`WO-15-002`) composes these: `drift = dirty || (installedSha && pluginHeadSha && installedSha !== pluginHeadSha)`.
- Defensive contract: unknown state (any `null`) does NOT raise the alarm — no false positives.

**Test files covering this WO:**
- `lib/plugin-sync.test.ts` — 37 tests, primary suite: AC-15-001.1 through AC-15-001.5 + SHA hygiene + read-only invariant (REQ-15-005). Uses real `tmp` dirs and a minimal `git init` temp repo.
- `lib/plugin-sync.adversarial.test.ts` — 16 tests, reviewer adversarial round 1: SHA whitespace hygiene (A), malformed JSON shapes (B), unusual git repo states (C — bare repo, deleted plugin/, file-as-path), argument-injection hardening (D).
- `lib/plugin-sync.adversarial2.test.ts` — 9 tests, reviewer adversarial round 2: trim mutation sentinels (E — CR-pollution, internal-whitespace edge-only), bare repo graceful degradation (F), EISDIR on JSON path (G), cross-reader consistency for false-drift scenario (H).

**Gate:** 53/53 tests GREEN. tsc --noEmit clean. biome clean. verify.sh green (125 files, 3532 passing, 2 expected-fail, 5 skipped).
