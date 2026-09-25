---
id: WO-03-006
type: work-order
slug: last-sync-chip
title: 'WO-03-006 — Portfolio row: relative "last sync" chip'
status: ACTIVE
parent: FRD-03
implementation_status: VERIFIED
difficulty: low
reopen_count: 0
artifacts:
  - 'src/lib/portfolio/formatLastSync.ts'
  - 'src/lib/portfolio/_tests/formatLastSync.test.ts'
  - 'src/components/modules/PortfolioTable/**'
source_requirements: [REQ-03-007]
dependsOn: [WO-03-001, WO-03-002]
last_updated: '2026-09-24'
change_ref: canario-d-paralelismo-portfolio-board-changes-wo.md
---
# WO-03-006 — Portfolio row: relative "last sync" chip

**Change:** `.pandacorp/inbox/changes/canario-d-paralelismo-portfolio-board-changes-wo.md` (item 1).
**IDs touched:** REQ-03-007; `CMP-03-portfolio-table` (`ProjectRow`).

## Problem

`PortfolioEntry.lastSync` (`src/lib/portfolio/portfolio.ts`) is parsed from the portfolio markdown
table (`last sync` / `última sync` / `ultima sync` headers) but is never rendered anywhere in `src/`.

## Scope

- New pure helper `src/lib/portfolio/formatLastSync.ts` that turns the `lastSync` date string into a
  Spanish relative label ("hoy", "ayer", "hace N días", "hace N meses", "hace N años"). Takes `now`
  as an injectable parameter (default `new Date()`) so tests are deterministic.
- Compare with `Date.parse` at the comparison point — never lexicographic ISO comparison
  (LESSON-0009; `docs/rules/code-conventions.md` "Verified traps").
- Invalid / unparseable input fails loud with an explicit result (e.g. a discriminated
  `{ ok: true, label } | { ok: false, reason }` or a throw) — never a silent `null` / `""` (DR-078).
  A future date (clock skew) is handled explicitly too (e.g. treated as "hoy"), documented in the JSDoc.
- `src/components/modules/PortfolioTable/PortfolioTable.tsx` (`ProjectRow`): one extra chip next to
  the existing phase / building-stopped chips, rendered ONLY when `entry.lastSync` is present. Reuse
  the existing `CHIP_STYLE` constant (DR-057) — no new style. Carry `data-testid="portfolio-row-last-sync"`
  and a `title` with the raw date. When the helper reports an invalid date, the row shows an explicit
  "sync: fecha inválida" chip (text, not color alone) rather than hiding it.

**Out of scope:** mounting `PortfolioTable` somewhere new. Verified 2026-09-24: `PortfolioTable` has no
production importer today (only its own test) — this WO changes the component and its tests only; the
chip becomes visible wherever the table is (or later gets) mounted. Do not touch `src/app/portfolio/**`
or `ProjectRail`.

## Acceptance criteria

- AC-03-007.1 — `formatLastSync(date, now)` returns "hoy" for the same calendar day, "ayer" for the
  previous day, "hace N días" for 2..29 days, "hace N meses" for ≥ 30 days (< 12 months), "hace N años"
  beyond; singular forms ("hace 1 mes", "hace 1 año") are correct.
- AC-03-007.2 — An unparseable `lastSync` produces an explicit error result / throw, never `null`/`""`.
- AC-03-007.3 — WHEN `entry.lastSync` is present, `ProjectRow` renders the relative-sync chip with
  the shared `CHIP_STYLE`; WHEN absent, no chip renders.

## Tests (RED first)

- `src/lib/portfolio/_tests/formatLastSync.test.ts` — today, yesterday, N days, N months, N years,
  invalid date (fails loud), a date string with a different offset/precision (Date.parse path).
- `src/components/modules/PortfolioTable/_tests/PortfolioTable.test.tsx` — new cases: chip present
  with `lastSync`, absent without it, invalid-date chip. Query by role/name where possible.

## Visual reference

`docs/design/prototype/index.html` (portfolio rows). No new mock: the chip is one more instance of the
row's existing chip style, same size and tokens as the phase chip.

## Status Note

**Built.**

- `src/lib/portfolio/formatLastSync.ts` — pure helper `formatLastSync(date: string, now: Date = new
  Date()): FormatLastSyncResult`, where `FormatLastSyncResult = { ok: true; label: string } | { ok:
  false; reason: string }` (discriminated union, DR-078 fail-loud — never `null`/`""`). Buckets: 0 days
  → `"hoy"`, 1 → `"ayer"`, 2..29 → `"hace N días"`, 30..(<360) days → `"hace N meses"` (singular
  `"hace 1 mes"`), ≥360 days → `"hace N años"` (singular `"hace 1 año"`). Day counts are computed from
  UTC calendar-day boundaries (`Date.UTC(y,m,d)` on both sides), never wall-clock ms diff, so DST/hour
  offsets don't shift the bucket. Compared via `Date.parse`, never lexicographic string comparison
  (LESSON-0009, cited per `docs/rules/code-conventions.md` "Verified traps"). **Assumption**: a future
  `date` (now < date, e.g. clock skew between machines) clamps to `"hoy"` rather than a negative/invalid
  label — documented in the JSDoc, exercised by a dedicated test.
- **Deliberately NOT shared** with FRD-04's `src/lib/changes/formatChangeDate.ts` (same output shape,
  different domain) — kept disjoint per the WO's own scope note so both WOs could build in the same
  wave without a shared-artifact collision (DR-060).
- `src/components/modules/PortfolioTable/PortfolioTable.tsx` — new internal `LastSyncChip({ lastSync
  })` sub-component (not exported; same pattern as the existing `BusinessSnapshot`/`RecoveryHint`
  internals, so no new row in `docs/design/components.md` — `PortfolioTable` is already listed there).
  Reuses the existing `CHIP_STYLE` object verbatim (DR-057: no new chip primitive). Rendered in
  `ProjectRow`'s header row, next to the phase chip, only `when entry.lastSync !== undefined`.
  `data-testid="portfolio-row-last-sync"`, `title={lastSync}` (raw date, always the untranslated
  value regardless of ok/invalid). Label text: `` `sync: ${label}` `` when valid, literal
  `"sync: fecha inválida"` when `formatLastSync` returns `ok: false` — text-conveyed, not color alone
  (accessibility.md).
- **Integration seam**: `PortfolioTable` still has no production importer (verified again at
  build time — only its own test file imports it); the chip becomes visible the moment a future WO
  mounts the table. No route/page touched, per this WO's explicit out-of-scope note.
- Tests: `src/lib/portfolio/_tests/formatLastSync.test.ts` (14 cases — every AC-03-007.1 bucket
  boundary incl. singulars, the future-date clamp, a mixed-offset/precision `Date.parse` case, and
  three AC-03-007.2 fail-loud cases for garbage/empty input). `src/components/modules/PortfolioTable/
  _tests/PortfolioTable.test.tsx` — 6 new cases under "PortfolioTable — last-sync chip" (present/absent,
  relative label, `title` attribute, invalid-date chip text, `CHIP_STYLE` reuse guard).
- Self-test green: `pnpm biome check .` (0 errors; 1 pre-existing warning in `ChangeCard.tsx` belongs
  to the parallel WO-04-008, not touched here), `pnpm tsc --noEmit` (clean), `pnpm vitest run` on both
  new/changed test files (73/73 passed, including the 54 pre-existing `PortfolioTable` cases untouched).
