---
id: WO-03-006
type: work-order
slug: last-sync-chip
title: 'WO-03-006 — Portfolio row: relative "last sync" chip'
status: ACTIVE
parent: FRD-03
implementation_status: PLANNED
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

_Pending — PLANNED._
