---
id: WO-15-002
type: work-order
slug: sync-verdict
title: WO-15-002 — `getPluginSyncState` verdict (drift / reason / detail)
status: DRAFT
parent: FRD-15
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
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
