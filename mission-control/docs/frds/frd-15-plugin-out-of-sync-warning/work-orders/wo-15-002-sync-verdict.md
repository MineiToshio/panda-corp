---
id: WO-15-002
type: work-order
slug: sync-verdict
title: WO-15-002 — `getPluginSyncState` semver verdict (drift / reason / detail)
status: DRAFT
parent: FRD-15
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-15-001]
last_updated: '2026-06-22'
---
# WO-15-002 — `getPluginSyncState` semver verdict (drift / reason / detail)

> **Amended 2026-06-22 (version-based).** The verdict originally combined a SHA-mismatch with an
> uncommitted-changes (`dirty`) check across five reasons (`uncommitted | behind | both | in-sync |
> unknown`). The shipped verdict compares the two semver `version`s and has **three** reasons
> (`behind | in-sync | unknown`); `dirty`/`both`/`uncommitted` no longer exist. See the FRD amendment
> and `docs/decision-log.md`.

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-15-sync`) · [architecture §4.7, §7](../../../product/architecture.md).

## Goal
Compose the two readers into the `PluginSyncState` verdict, with correct semver drift logic and the
Spanish `detail` one-liner.

## Scope
`getPluginSyncState(): PluginSyncState` composing `readInstalledVersion` and `readPluginSourceVersion`.
Parses each as semver (`MAJOR.MINOR.PATCH`, stripping a leading `v` and any pre-release/build suffix)
and computes `drift`, `reason` (`behind | in-sync | unknown`), and the Spanish `detail`.

## Acceptance criteria
- **AC-15-002.1** (REQ-15-002) WHEN the installed `version` is strictly behind the source `version`
  (semver) → `drift === true`, `reason === "behind"`.
- **AC-15-002.2** (REQ-15-002, REQ-15-004) WHEN the installed `version` equals OR is newer than the
  source `version` → `drift === false`, `reason === "in-sync"` (the up-to-date state, no banner).
- **AC-15-002.3** WHEN `installedVersion` or `sourceVersion` is `null` OR either is an unparseable
  semver → `reason === "unknown"`, `drift === false` (no false alarm — read-only/honest, REQ-15-005).
  A `null`/unparseable version NEVER produces `behind`.
- **AC-15-002.4** Semver comparison is **numeric per component** (`1.10.0` is newer than `1.9.0`); a
  leading `v` and any `-pre`/`+build` suffix are stripped before comparison.
- **AC-15-002.5** `detail` is a non-empty Spanish string echoing the installed/source versions and the
  state (e.g. `"instalado v9.0.0 · hay una versión más nueva del plugin (v9.26.0)"`); covered by a
  snapshot/assert.

## TDD
Extend `lib/plugin-sync/plugin-sync.test.ts`. Drive the two readers with mocks/fixtures to exercise
every `reason` branch including `unknown` (null + unparseable) and the newer-than-source case.

## Definition of done
- All ACs RED → GREEN. Full `reason` matrix tested.
- `.pandacorp/verify.sh` green.

## Dependencies
- WO-15-001.

## Status Note

**What was built:** `getPluginSyncState(): PluginSyncState` in `lib/plugin-sync/plugin-sync.ts` — the
semver verdict composer for FRD-15. Composes `readInstalledVersion` and `readPluginSourceVersion` (from
WO-15-001) into the drift verdict with three `reason` values and a Spanish `detail` one-liner.

**Interfaces/contracts exposed (`IF-15-sync`, complete):**

```ts
// lib/plugin-sync/plugin-sync.ts

export type PluginSyncState = {
  installedVersion: string | null;  // semver version of pandacorp@panda-corp, or null
  sourceVersion: string | null;     // version from plugin/.claude-plugin/plugin.json, or null
  drift: boolean;                    // true ONLY when installed is strictly behind source
  reason: "behind" | "in-sync" | "unknown";
  detail: string;                    // non-empty Spanish one-liner for the banner
};

export function getPluginSyncState(): PluginSyncState;
// Reads env: PANDACORP_FACTORY_ROOT (or ../cwd) and HOME/.claude.
// Never throws. Read-only (two JSON file reads).
```

**Reason matrix (full coverage):**

| Condition | `reason` | `drift` |
|---|---|---|
| installed semver strictly < source semver | `"behind"` | `true` |
| installed semver equals source | `"in-sync"` | `false` |
| installed semver > source (installed ahead) | `"in-sync"` | `false` |
| either version `null` or unparseable | `"unknown"` | `false` |

**Semver rule:** `compareVersions(installed, source)` parses each as `[major, minor, patch]` (strips a
leading `v` and any `-pre`/`+build` suffix); `behind` iff the installed tuple is strictly less than the
source tuple component-by-component; equal or ahead → `in-sync`; unparseable → `unknown` (AC-15-002.4).

**Detail Spanish one-liners (examples):**
- `"behind"`: `"instalado v9.0.0 · hay una versión más nueva del plugin (v9.26.0)"`
- `"in-sync"`: `"instalado v9.26.0 · plugin al día"`
- `"unknown"`: `"estado desconocido (plugin no instalado o versión no disponible)"`

**Integration seam for WO-15-003 (route handler):**
```ts
import { getPluginSyncState } from "@/lib/plugin-sync/plugin-sync";
// GET /api/plugin-sync → Response.json(getPluginSyncState())
```

**Integration seam for WO-15-004 (banner component):**
```ts
import type { PluginSyncState } from "@/lib/plugin-sync/plugin-sync";
// Poll /api/plugin-sync → render banner only when state.drift === true (reason "behind")
// state.detail is the subtitle one-liner
```

**Test files covering this WO:**
- `lib/plugin-sync/plugin-sync.test.ts` — AC-15-002.1 through AC-15-002.5: behind / in-sync / newer-
  than-source / null / unparseable, the numeric per-component comparison, shape invariants, full reason matrix.

**Gate (shipped):** plugin-sync tests GREEN (incl. WO-15-001 adversarial suites). verify.sh green: tsc clean, biome clean.
