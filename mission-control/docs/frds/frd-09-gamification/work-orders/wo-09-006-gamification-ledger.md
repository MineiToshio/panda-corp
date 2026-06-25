---
id: WO-09-006
type: work-order
slug: gamification-ledger
title: 'WO-09-006 — Gamification ledger: persistent XP accumulator'
status: DRAFT
parent: FRD-09
implementation_status: PLANNED
source_requirements: [AC-09-006.1, AC-09-006.2, AC-09-006.3]
dependsOn: [WO-09-001]
last_updated: '2026-06-25'
---
# WO-09-006 — Gamification ledger: persistent XP accumulator

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [§5 read-only posture (controlled exception)](../blueprint.md#5-read-only--security-posture).

## Goal

Add a persistent ledger (`factory/gamification-ledger.json`, gitignored) that records the maximum
guild outcomes ever seen (workOrdersDone, phasesCompleted, releases). Mission Control merges the
ledger with the live statuses using `MAX(live, ledger)` so that **deleting a project never
decreases the guild's XP or level**.

## Context

Today `deriveGuildOutcomes` derives everything from the live `status.yaml` files of portfolio
projects. If a project is deleted, its contribution disappears and the guild can lose level and XP.
The ledger fixes this by "burning in" the historical maximum: once earned, XP is never lost.

## Acceptance criteria (EARS, from FRD-09 AC-09-006)

- **AC-09-006.1** — WHEN Mission Control computes guild outcomes THEN it SHALL read
  `factory/gamification-ledger.json` (if present) and use `MAX(live, ledger)` for each metric
  (workOrdersDone, phasesCompleted, releases) so that deleting a project NEVER decreases XP or level.
- **AC-09-006.2** — WHEN a live metric exceeds the stored ledger value THEN Mission Control SHALL
  update the ledger to the new maximum (snapshot-on-exceed). The write is **fire-and-forget** and
  MUST NOT block the render or increase Time to First Byte.
- **AC-09-006.3** — `factory/gamification-ledger.json` SHALL be added to `.gitignore` (personal
  data, DR-033). The app MUST handle its absence gracefully (cold start = empty ledger = no XP
  loss because live data is sufficient).

## In scope

1. **`lib/gamification/ledger.ts`** — new pure module:
   - `GamificationLedger` type: `{ version: 1, updatedAt: string, totals: { workOrdersDone: number, phasesCompleted: number, releases: number } }`
   - `readLedger(ledgerPath?: string): GamificationLedger` — reads JSON; returns zero-totals if absent/malformed (never throws)
   - `mergeLedgerOutcomes(live: GuildOutcomes, ledger: GamificationLedger): GuildOutcomes` — returns `MAX(live, ledger)` for each metric; pure
   - `needsSnapshot(live: GuildOutcomes, ledger: GamificationLedger): boolean` — true if any live metric > ledger (avoids unnecessary writes)

2. **`app/_actions/snapshotLedger.ts`** — Server Action:
   - `snapshotGamificationLedger(live: GuildOutcomes): Promise<void>`
   - Reads ledger, compares, writes if `needsSnapshot` returns true (atomic: read → compare → write)
   - Resolves `factory/gamification-ledger.json` via `resolveFactoryRoot()`

3. **`page.tsx`** — Server Component updates:
   - Read ledger via `readLedger()` before passing to `deriveGuildOutcomes`
   - Pass `mergeLedgerOutcomes(liveOutcomes, ledger)` as the outcomes argument
   - Render `<GamificationLedgerSync liveOutcomes={liveOutcomes} />` (see below)

4. **`components/dashboard/GamificationLedgerSync/GamificationLedgerSync.tsx`** — `"use client"` component:
   - Receives `liveOutcomes` as a prop
   - On mount (`useEffect`), calls `snapshotGamificationLedger(liveOutcomes)` — fire-and-forget
   - No visible UI, no loading state — transparent to the user

5. **`.gitignore`** — add `factory/gamification-ledger.json`

## Out of scope

- Ledger entries per project (the totals are sufficient for the MAX pattern)
- Writing the ledger from the plugin's `implement` skill (the snapshot-on-read pattern in MC is sufficient; plugin writes are a future enhancement)
- Migrating existing entries when a project is renamed

## Tests (RED first)

- `lib/gamification/ledger.ts` unit tests:
  - `readLedger` returns zero-totals when file absent
  - `readLedger` returns zero-totals when file malformed (negative AC — never throws)
  - `mergeLedgerOutcomes` returns MAX(live, ledger) for each metric
  - `mergeLedgerOutcomes` preserves live value when ledger has higher value (core invariant)
  - `needsSnapshot` returns false when live ≤ ledger on all metrics
  - `needsSnapshot` returns true when any live metric > ledger
- `snapshotLedger` server action: integration test that it writes only when `needsSnapshot` is true
- `GamificationLedgerSync`: mounts and calls the server action exactly once

## Dependencies

| ID | Title | Status |
|---|---|---|
| WO-09-001 | Guild XP engine (`deriveGuildOutcomes`) | VERIFIED |
