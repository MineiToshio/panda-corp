---
id: WO-15-001
type: work-order
slug: sync-readers
title: 'WO-15-001 — `lib/plugin-sync` version readers (installed version, source version)'
status: DRAFT
parent: FRD-15
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-22'
---
# WO-15-001 — `lib/plugin-sync` version readers (installed version, source version)

> **Amended 2026-06-22 (version-based).** This WO originally read git **commit SHAs** + an
> uncommitted-changes (`git status --porcelain`) check. The shipped readers read the semver `version`
> from the two manifests instead — the SHA model produced a permanent false "behind" alarm (the
> installed `gitCommitSha` is frozen at install time). The SHA framing below is historical; the scope,
> ACs and status note describe the semver behaviour that actually shipped. See the FRD amendment and
> `docs/decision-log.md`.

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-15-sync`) · [architecture §4.7, §6, §7](../../../product/architecture.md).

## Goal
The two primitive read functions of `lib/plugin-sync/plugin-sync.ts`, each defensive (unreadable/
unparseable → `null`, never throws). No verdict yet (that is WO-15-002).

## Scope
- `readInstalledVersion(claudeHome): string | null` — parse `~/.claude/plugins/installed_plugins.json`,
  locate the `pandacorp@panda-corp` entry, return its semver `version` (the version `claude plugin update`
  maintains). Tolerates both an array-of-entries and a single-object entry shape.
- `readPluginSourceVersion(factoryRoot): string | null` — parse
  `plugin/.claude-plugin/plugin.json`, return its `version` (the authoritative "latest published").
- Both trim the value and return `null` on a missing/empty/non-string `version`, or on a
  missing/malformed JSON file. Read-only file reads only — no git, no `child_process`.

## Acceptance criteria (from REQ-15-002, evidence for the verdict)
- **AC-15-001.1** GIVEN a fixture `installed_plugins.json` with `pandacorp@panda-corp` → `version`,
  `readInstalledVersion` returns that version string (trimmed).
- **AC-15-001.2** GIVEN the file is missing, malformed JSON, or has no `pandacorp@panda-corp` entry →
  returns `null` (no throw). Same for an entry with a missing/empty `version`.
- **AC-15-001.3** GIVEN the entry is the canonical array-of-entries form OR a single-object form,
  `readInstalledVersion` reads the `version` from either (lenient, no throw).
- **AC-15-001.4** `readPluginSourceVersion` returns the `version` from `plugin/.claude-plugin/plugin.json`
  under a fixture factory root; returns `null` when the manifest is missing or has no usable `version`.

## TDD
Write `lib/plugin-sync/plugin-sync.test.ts` first. Fixtures: a small `installed_plugins.json` and a
`plugin/.claude-plugin/plugin.json` under a `PANDACORP_FACTORY_ROOT`-style fixture tree, plus malformed
variants (bad JSON, missing entry, empty `version`). Reads are pure given inputs.

## Definition of done
- RED → GREEN → refactor; all ACs covered.
- Two `fs.readFileSync` + `JSON.parse` reads only — no shell, no git.
- No `any`, no `@ts-ignore`. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-01 `lib/config.ts` (`resolveFactoryRoot`, `PANDACORP_FACTORY_ROOT`) — shipped.

## Status Note

**What was built:** `lib/plugin-sync/plugin-sync.ts` — the two defensive version-reader primitives for
FRD-15. (Version-based per the 2026-06-22 amendment; the SHA/dirty readers an earlier draft described
do not ship.)

**Interfaces/contracts exposed (`IF-15-sync`, partial — readers only, no verdict):**

```ts
// lib/plugin-sync/plugin-sync.ts
export function readInstalledVersion(claudeHome: string): string | null;
// Reads ~/.claude/plugins/installed_plugins.json → semver `version` of pandacorp@panda-corp.
// Tolerates the array-of-entries OR single-object entry shape. Returns the trimmed version string,
// or null on any failure (missing file, bad JSON, no entry, missing/empty version). Never throws.

export function readPluginSourceVersion(factoryRoot: string): string | null;
// Reads <factoryRoot>/plugin/.claude-plugin/plugin.json → its `version` (latest published).
// Returns the trimmed version string, or null on missing/malformed manifest or empty version. Never throws.
```

**Integration seams for WO-15-002 (`getPluginSyncState`):**
- Both readers return a whitespace-trimmed `version` string, or `null` on any unreadable/unparseable
  input. The verdict (`WO-15-002`) composes them: `behind` iff the installed semver is strictly older
  than the source semver; `in-sync` when equal or ahead; `unknown` when either is `null`/unparseable.
- Defensive contract: unknown state (any `null`) does NOT raise the alarm — no false positives.

**Test files covering this WO:**
- `lib/plugin-sync/plugin-sync.test.ts` — primary suite: AC-15-001.1 through AC-15-001.4 + version
  hygiene + read-only invariant (REQ-15-005). Uses real `tmp` dirs with fixture manifests.
- Adversarial suites: malformed JSON shapes, missing/empty `version`, array-vs-object entry shapes,
  EISDIR on a JSON path — every reader fails loud-to-`null`, never throws.

**Gate (shipped):** tests GREEN. tsc --noEmit clean. biome clean. verify.sh green.
