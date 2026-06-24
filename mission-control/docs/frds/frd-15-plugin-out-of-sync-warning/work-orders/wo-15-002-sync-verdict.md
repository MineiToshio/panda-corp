---
id: WO-15-002
type: work-order
slug: sync-verdict
title: WO-15-002 — `getPluginSyncState` verdict (drift / reason / detail)
status: DRAFT
parent: FRD-15
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-15-001]
last_updated: '2026-06-17'
---
# WO-15-002 — `getPluginSyncState` verdict (drift / reason / detail)

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-15-sync`) · [architecture §4.7, §7](../../../product/architecture.md).

## Goal
Compose the three readers into the `PluginSyncState` verdict, with correct drift logic, the SHA
prefix-equality rule, and the Spanish `detail` one-liner.

## Scope
`getPluginSyncState(): PluginSyncState` composing `readInstalledSha`, `readPluginHeadSha`,
`readPluginDirty`. Computes `drift`, `reason` (`uncommitted | behind | both | in-sync | unknown`),
and `detail`.

## Acceptance criteria
- **AC-15-002.1** (REQ-15-001) WHEN `dirty === true` and SHAs equal → `drift === true`, `reason === "uncommitted"`.
- **AC-15-002.2** (REQ-15-002) WHEN clean and `installedSha !== pluginHeadSha` (both known) → `drift === true`, `reason === "behind"`.
- **AC-15-002.3** WHEN `dirty` AND SHAs differ → `reason === "both"`, `drift === true`.
- **AC-15-002.4** (REQ-15-004) WHEN clean AND SHAs equal → `drift === false`, `reason === "in-sync"`.
- **AC-15-002.5** WHEN `installedSha` or `pluginHeadSha` is `null` AND not dirty → `reason === "unknown"`,
  `drift === false` (no false alarm — read-only/honest, REQ-15-005). A `null` SHA NEVER produces `behind`.
- **AC-15-002.6** SHA comparison is **prefix-safe**: an abbreviated installed SHA that is a prefix of the
  full plugin HEAD SHA counts as equal (no spurious `behind`).
- **AC-15-002.7** `detail` is a non-empty Spanish string echoing the short installed SHA and the cause
  (e.g. `"instalado 18a9389 · hay cambios sin commitear"`); covered by a snapshot/assert.

## TDD
Extend `lib/plugin-sync.test.ts`. Drive the three readers with mocks/fixtures to exercise every
`reason` branch including `unknown`.

## Definition of done
- All ACs RED → GREEN. Full `reason` matrix tested.
- `.pandacorp/verify.sh` green.

## Dependencies
- WO-15-001.

## Status Note

**What was built:** `getPluginSyncState(): PluginSyncState` in `lib/plugin-sync.ts` — the verdict composer for FRD-15. Composes `readInstalledSha`, `readPluginHeadSha`, and `readPluginDirty` (all from WO-15-001) into the full drift verdict with all five `reason` values and a Spanish `detail` one-liner.

**Interfaces/contracts exposed (`IF-15-sync`, complete):**

```ts
// lib/plugin-sync.ts

export type PluginSyncState = {
  installedSha: string | null;   // gitCommitSha of pandacorp@panda-corp, or null
  pluginHeadSha: string | null;  // git log -1 --format=%H -- plugin/, or null
  dirty: boolean;                // git status --porcelain -- plugin/ non-empty
  drift: boolean;                // true only on positive signal (dirty or SHAs differ)
  reason: "uncommitted" | "behind" | "both" | "in-sync" | "unknown";
  detail: string;                // non-empty Spanish one-liner for the banner
};

export function getPluginSyncState(): PluginSyncState;
// Reads env: PANDACORP_FACTORY_ROOT (or ../cwd) and HOME/.claude.
// Never throws. Read-only.
```

**Reason matrix (full coverage):**

| Condition | `reason` | `drift` |
|---|---|---|
| `dirty && SHAs differ` | `"both"` | `true` |
| `dirty && SHAs equal` | `"uncommitted"` | `true` |
| `clean && SHAs differ (both known)` | `"behind"` | `true` |
| `clean && SHAs equal (both known)` | `"in-sync"` | `false` |
| `any null SHA && not dirty` | `"unknown"` | `false` |
| `dirty && installedSha null` | `"uncommitted"` | `true` |

**SHA equality rule:** `shaEqual(installed, head)` — prefix-safe: `installed.startsWith(head) || head.startsWith(installed)` covers abbreviated SHAs (AC-15-002.6).

**Detail Spanish one-liners (examples):**
- `"uncommitted"`: `"instalado 18a9389 · hay cambios sin commitear"`
- `"behind"`: `"instalado aaaaaaa · el plugin instalado está atrás del HEAD (eb76145)"`
- `"in-sync"`: `"instalado eb76145 · plugin al día"`
- `"unknown"`: `"estado desconocido (plugin no instalado o repo no disponible)"`

**Integration seam for WO-15-003 (route handler):**
```ts
import { getPluginSyncState } from "@/lib/plugin-sync";
// GET /api/plugin-sync → JSON.stringify(getPluginSyncState())
```

**Integration seam for WO-15-004 (banner component):**
```ts
import type { PluginSyncState } from "@/lib/plugin-sync";
// Poll /api/plugin-sync → render banner only when state.drift === true
// state.reason selects banner copy; state.detail is the subtitle one-liner
```

**Test files covering this WO:**
- `lib/plugin-sync.test.ts` — 48 tests total (32 WO-15-001 + 16 WO-15-002): AC-15-002.1 through AC-15-002.7, dirty-wins-over-null-SHA edge case, shape invariants, full reason matrix.

**Gate:** 48/48 tests GREEN (plugin-sync.test.ts). All 69/69 plugin-sync tests GREEN (including WO-15-001 adversarial suites). verify.sh green: 125 files, 3548 tests, tsc clean, biome clean.
