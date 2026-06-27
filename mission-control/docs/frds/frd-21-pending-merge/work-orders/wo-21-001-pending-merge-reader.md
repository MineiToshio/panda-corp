---
id: WO-21-001
type: work-order
title: 'Pending-merge data reader (lib + snapshot wiring)'
frd: FRD-21
status: ACTIVE
implementation_status: VERIFIED
artifacts:
  - 'src/lib/pendingMerge/**'
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
Built (IN_REVIEW). As-built differs from the spec in two deliberate ways, both simpler: the reader reads
git state **live on the server** (`execFileSync` of `git worktree list` + `git branch --no-merged`, like
`build-track`) instead of a `pending-work.json` snapshot — so there is **no snapshot file and no
background job** (aligns with the owner's "no always-running loop"). No Zod: the typed `PendingResult`
discriminated union (`ok` | `empty` | `error`) is enough (no external untyped input beyond git stdout).
Exposes for the UI WO: `getPendingMerge(): PendingResult` (React.cache single source, DR-092), the
`PendingItem` + `PendingResult` types, and `readPending(repoRoot, now?, run?)` (git runner injected for
tests, DR-078 fail-loud). The stale threshold lives here (`PANDACORP_STALE_HOURS`, default 3), not in
`constants.ts`. Tests: `_tests/pendingMerge.test.ts` (empty vs error distinct, in-progress/stale derivation).
Verified: tsc + biome + knip clean, unit tests green. Awaiting the FRD-21 review gate for VERIFIED.
