---
id: WO-15-001
type: work-order
slug: sync-readers
title: 'WO-15-001 — `lib/plugin-sync` readers (installed SHA, plugin HEAD SHA, dirty)'
status: DRAFT
parent: FRD-15
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
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
