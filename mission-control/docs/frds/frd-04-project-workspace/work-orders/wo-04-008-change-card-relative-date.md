---
id: WO-04-008
type: work-order
slug: change-card-relative-date
title: 'WO-04-008 — Changes tab: relative date on the change card'
status: ACTIVE
parent: FRD-04
implementation_status: PLANNED
difficulty: low
reopen_count: 0
artifacts:
  - 'src/lib/changes/formatChangeDate.ts'
  - 'src/lib/changes/_tests/formatChangeDate.test.ts'
  - 'src/app/projects/[slug]/_components/tab-changes/ChangeCard.tsx'
  - 'src/app/projects/[slug]/_components/tab-changes/_tests/ChangeCard.test.tsx'
source_requirements: [REQ-04-011, REQ-04-007]
dependsOn: [WO-04-004]
last_updated: '2026-09-24'
change_ref: canario-d-paralelismo-portfolio-board-changes-wo.md
---
# WO-04-008 — Changes tab: relative date on the change card

**Change:** `.pandacorp/inbox/changes/canario-d-paralelismo-portfolio-board-changes-wo.md` (item 3).
**IDs touched:** REQ-04-011; `CMP-04-change-card`.

## Problem

`src/app/projects/[slug]/_components/tab-changes/ChangeCard.tsx` builds its metadata line with
`[item.date, item.frd].filter((part) => part !== "").join(" · ")` — the raw ISO date is shown as-is.

## Scope

- New pure helper `src/lib/changes/formatChangeDate.ts`: Spanish relative label ("hoy", "ayer",
  "hace N días", "hace N meses", "hace N años") with an injectable `now`. Compare with `Date.parse`,
  never lexicographically (LESSON-0009). Invalid input fails loud with an explicit result/throw —
  never `null`/`""` (DR-078).
- **Deliberately NOT shared with FRD-03's `formatLastSync`** (owner's change card: distinct domain,
  and keeping the artifacts disjoint lets the two WOs build in the same wave, DR-060). Do not import
  from `src/lib/portfolio/**`.
- `ChangeCard.tsx`: use the helper for the date part of the metadata line (keep the ` · ` join and the
  FRD part). Keep the raw ISO date available as a `title` on the date text. WHEN the date is invalid,
  show the raw string (honest) rather than hiding it — the card itself must never crash on a bad date
  (the reader already validated the file's shape; the date text is display-only).
- The detail modal (`ChangeDetail.tsx`) is out of scope — it keeps the raw date.

## Acceptance criteria

- AC-04-011.1 — `formatChangeDate(date, now)` returns "hoy" / "ayer" / "hace N días" / "hace N meses"
  / "hace N años" with correct singulars.
- AC-04-011.2 — An unparseable date produces an explicit error result / throw, never `null`/`""`.
- AC-04-011.3 — The change card's metadata line shows the relative label (plus the FRD when present)
  instead of the raw ISO date; an invalid date falls back to the raw string visibly.

## Tests (RED first)

- `src/lib/changes/_tests/formatChangeDate.test.ts` — today, yesterday, N days, N months, N years,
  invalid (fails loud).
- `src/app/projects/[slug]/_components/tab-changes/_tests/ChangeCard.test.tsx` (new) — metadata line
  renders the relative label + FRD; invalid date shows the raw string. Existing `ChangesPanel.test.tsx`
  must stay green (update only an assertion that pinned the raw ISO date on the card, if any).

## Visual reference

`docs/design/prototype/index.html` (workspace Changes tab card). Same metadata line, relative text only.

## Status Note

_Pending — PLANNED._
