---
id: WO-09-006
type: work-order
slug: gamification-ledger
title: 'WO-09-006 — Gamification ledger: persistent XP accumulator'
status: DRAFT
parent: FRD-09
implementation_status: VERIFIED
reopen_count: 0
source_requirements: [AC-09-006.1, AC-09-006.2, AC-09-006.3]
dependsOn: [WO-09-001]
last_updated: '2026-06-30'
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

## Status Note

**What was built:**

Three new artifacts implementing the persistent XP accumulator (AC-09-006.1–3):

1. **`src/lib/gamification/ledger.ts`** — pure module (no I/O side effects):
   - `GamificationLedger` type: `{ version: 1, updatedAt: string, totals: { workOrdersDone, phasesCompleted, releases } }`
   - `readLedger(ledgerPath?: string): GamificationLedger` — reads + coerces JSON; returns zero-totals on absent/malformed/wrong-shape (DR-078 — never throws, never returns null)
   - `mergeLedgerOutcomes(live, ledger): GuildOutcomes` — MAX per metric; preserves `greenTestRuns`/`weeklyStreak` from live; pure
   - `needsSnapshot(live, ledger): boolean` — true when any live metric > ledger; avoids unnecessary writes; pure

2. **`src/app/_actions/snapshotLedger.ts`** — Server Action `"use server"`:
   - `snapshotGamificationLedger(live: GuildOutcomes): Promise<void>`
   - Resolves ledger path via `resolveFactoryRoot()` + `"factory/gamification-ledger.json"`
   - Read → compare via `needsSnapshot` → write MAX-merged ledger only when needed
   - Fire-and-forget: resolves `void`; silently swallows I/O errors

3. **`src/components/dashboard/GamificationLedgerSync/GamificationLedgerSync.tsx`** — `"use client"` invisible component:
   - Props: `{ liveOutcomes: GuildOutcomes }`
   - `useEffect([liveOutcomes])`: calls `snapshotGamificationLedger(liveOutcomes)` once after hydration; errors silently swallowed
   - Returns `null` — no visible UI, no loading state

**Integration decisions made:**

- **Ledger merge in `guildState.ts`, not `page.tsx`**: The WO spec mentioned `page.tsx` but `guildState.ts` is the single source of truth (blueprint §3 `IF-09-guild-state`). Integrating there ensures all three surfaces (GuildBar, dashboard, Logros hero) pick up the ledger floor at once, preventing divergence. This is explicitly called out in the blueprint: "This is also the one place a future ledger merge — MAX(live, ledger) — must live."
- **`GuildState` now exposes `liveOutcomes`** (pre-merge, for the snapshot action) in addition to `outcomes` (post-merge, feeds `level`). The snapshot action must receive the raw live values — passing already-merged outcomes would cause `needsSnapshot` to never fire after the first write.
- **`GamificationLedgerSync` dep array is `[liveOutcomes]`**: Biome enforced this. Since `liveOutcomes` arrives from a Server Component (stable reference per page load), this behaves identically to mount-once in production.
- **Cold start / zero-outcomes**: `needsSnapshot` returns `false` when all live metrics are 0, so the ledger file is NOT created on a fresh factory with no work done. The file is only created after real outcomes exist.
- **Ledger schema**: `version: 1`, `updatedAt` ISO string, `totals` with the three metrics. `greenTestRuns` and `weeklyStreak` are intentionally omitted from the ledger (ephemeral signals, not historical maximums).

**Interfaces/contracts exposed:**

```ts
// src/lib/gamification/ledger.ts
export type GamificationLedger = {
  readonly version: 1;
  readonly updatedAt: string;
  readonly totals: {
    readonly workOrdersDone: number;
    readonly phasesCompleted: number;
    readonly releases: number;
  };
};

export function readLedger(ledgerPath?: string): GamificationLedger;
export function mergeLedgerOutcomes(live: GuildOutcomes, ledger: GamificationLedger): GuildOutcomes;
export function needsSnapshot(live: GuildOutcomes, ledger: GamificationLedger): boolean;

// src/app/_actions/snapshotLedger.ts
export async function snapshotGamificationLedger(live: GuildOutcomes): Promise<void>;

// src/components/dashboard/GamificationLedgerSync/GamificationLedgerSync.tsx
export function GamificationLedgerSync({ liveOutcomes }: { liveOutcomes: GuildOutcomes }): null;

// src/lib/gamification/guildState.ts (updated)
export type GuildState = {
  readonly statuses: readonly StatusResult[];
  readonly eventsSnapshot: EventsSnapshot;
  readonly liveOutcomes: GuildOutcomes;  // NEW: pre-ledger-merge (for snapshot action)
  readonly outcomes: GuildOutcomes;       // ledger-merged MAX(live, ledger)
  readonly level: GuildLevel;
};
```

**Integration seam for consumers:** Any Server Component that calls `getGuildState()` now automatically gets ledger-merged outcomes in `outcomes`/`level`. To pass to `GamificationLedgerSync`, destructure `liveOutcomes` from `getGuildState()`. The `page.tsx` dashboard is the only mount point — no other route needs it since `guildState.ts` applies the floor server-side.

**`.gitignore` change:** `factory/gamification-ledger.json` added to the factory root `.gitignore` (AC-09-006.3, DR-033 personal data).

**Test files:**
- `src/lib/gamification/_tests/ledger.test.ts` — 26 unit tests (readLedger: absent/real/malformed fixtures; mergeLedgerOutcomes: MAX semantics + purity + no mutation; needsSnapshot: all branches)
- `src/app/_tests/wo-09-006-snapshotLedger.test.ts` — 7 integration tests (writes on first snapshot; ISO date; no-write on zero; no-write when already above; updates on exceed; MAX invariant; void return)
- `src/components/dashboard/GamificationLedgerSync/_tests/GamificationLedgerSync.test.tsx` — 7 component tests (renders null; calls action once; passes liveOutcomes; cold start; no re-call on re-render; no interactive elements; survives action rejection)

**Gate verdict (2026-06-29, DR-073 patch-in-place):** A reviewer RED test (`src/app/achievements/_tests/page.ledger-hermeticity.reviewer.test.tsx`) proved the achievements page render was non-hermetic: `getGuildState()`'s `readLedger()` (guildState.ts:79) hit the real on-disk `factory/gamification-ledger.json` (workOrdersDone:91), so `mergeLedgerOutcomes(emptyLive, realLedger)` floored the empty-factory outcomes and the honest-zero XP bar rendered a fabricated ~66% fill (violating FRD-09 honest-zero + AC-10-005.3). Fix (test-only, no production-behavior change): `src/app/achievements/_tests/page.test.tsx` now mocks `@/lib/gamification/ledger`'s `readLedger` to zero-totals, neutralizing the ledger floor while keeping the real `mergeLedgerOutcomes` MAX semantics under test. Whole-project gate clean (vitest 359 files / 7180+2xfail, tsc 0, knip 0, biome 0). WO promoted to VERIFIED, reopen_count reset to 0.

## Status Note — 2026-06-30 addendum: `readGuildState`'s per-project status read is now live-decisions-aware (DR-092)

**Bug found by the owner:** `readGuildState()` (`guildState.ts`) builds `state.statuses` via
`readPortfolio().map(entry => readStatus(...))` — every consumer of `state.statuses[i].pendingDecisions`
(the "Tu turno" pending-decisions sum on the Inicio dashboard, `app/page.tsx::deriveTurnItems`) was
reading the same stale `pending_decisions` YAML counter as the portfolio rail badge (WO-03-001).

**Fix:** swapped `readStatus` → `readStatusWithLiveDecisions` (WO-01-005) at this one call site.
No other `GuildState` field changed; `readStatus()` itself untouched.

**New test:** `readGuildState — single source of truth` gained
`"pendingDecisions is the live decisions.md count, not the stale status.yaml counter (DR-092)"` in
`guildState.test.ts` — same stale-counter-vs-live-count pattern as WO-03-001's regression test.
`src/app/achievements/_tests/page.test.tsx`'s `@/lib/status/status` mock updated to also stub
`readStatusWithLiveDecisions` (it previously only stubbed `readStatus`, which this call site no
longer calls).

**verify.sh at this addendum:** GREEN (same run as WO-04-001's addendum).
