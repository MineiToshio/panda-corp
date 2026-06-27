---
id: WO-21-001
type: work-order
title: 'Pending-merge data reader (lib + snapshot wiring)'
frd: FRD-21
status: ACTIVE
implementation_status: PLANNED
artifacts:
  - 'src/lib/pendingMerge/**'
  - 'src/lib/constants.ts'
dependsOn: []
difficulty: medium
---
# WO-21-001 — Pending-merge data reader

## In-Scope
- `src/lib/pendingMerge/` reader (per the blueprint): Zod `PendingItemSchema` (status = discriminated
  `'in-progress' | 'ready' | 'stale'`), `readProjectPending(projectRoot)` returning a `Result` union
  (`ok` | `empty` | `error`), and `getPendingMerge()` aggregate wrapped in `React.cache()` (single source,
  DR-092) that iterates project roots (reuse existing project discovery from FRD-01/FRD-03), unions the
  `.pandacorp/run/pending-work.json` snapshot with `.pandacorp/run/worktrees/*.json`, dedups by branch,
  derives status/age, sorts stale→ready→in-progress.
- **Fail-loud (DR-078):** an unreadable/malformed source returns `{ kind: 'error', reason }`, never `[]`.
- `PANDACORP_STALE_HOURS` constant (default 3) in `src/lib/constants.ts`, shared semantics with the check.
- Snapshot wiring: ensure the factory check writes `.pandacorp/run/pending-work.json` (the `--json`
  snapshot) — a tiny addition to `pending-work.sh`/its driver (gitignored runtime); document it in the FRD.

## Tests (RED first)
- Reader against REAL fixtures (populated snapshot · manifest-only · gitignored/foreign-language variant)
  AND a MALFORMED fixture that must fail loud (assert the error result, not empty).
- Status/age derivation + union/dedup (property-test the dedup invariant where cheap).

## Status Note
(to be filled by the implementer: exported `getPendingMerge()` + `PendingItem` type + the `Result` union
shape the UI WO consumes.)
