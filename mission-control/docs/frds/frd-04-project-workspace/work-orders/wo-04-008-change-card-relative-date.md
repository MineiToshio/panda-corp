---
id: WO-04-008
type: work-order
slug: change-card-relative-date
title: 'WO-04-008 — Changes tab: relative date on the change card'
status: ACTIVE
parent: FRD-04
implementation_status: IN_REVIEW
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

**What was built:**
- New pure helper `src/lib/changes/formatChangeDate.ts`: `formatChangeDate(date: string, now: Date): ChangeDateResult` where
  `ChangeDateResult = { ok: true; label: string } | { ok: false; error: string }`. Returns "hoy" / "ayer" /
  "hace N días" (< 30 days) / "hace N meses" (30–364 days, correct singular "hace 1 mes") / "hace N años"
  (≥ 365 days, correct singular "hace 1 año"). Empty or unparseable input returns `{ ok: false, error }` —
  never `null`/`""` (DR-078, AC-04-011.2). Day boundaries are computed in **UTC** (`Date.UTC` from
  `getUTC*` components), not local time: a date-only frontmatter value (`"2026-09-24"`) parses per ISO 8601
  as UTC midnight, so diffing it against a local-midnight `now` shifts by the runner's offset (verified this
  breaks "hoy"→"ayer" on a UTC-5 machine) — comparing both sides in UTC avoids it. Compares via
  `Date.parse`, never lexicographically (LESSON-0009, cited already in the WO body).
- `ChangeCard.tsx`: replaced the raw `evidenceText()` join with `resolveDateDisplay(item, now)` →
  `{ text, title } | null`. The date renders in its own `data-testid="change-card-date"` span: `title`
  carries the raw ISO date as a tooltip when the label is a resolved relative one; when the date is
  unparseable, `text` IS the raw string (shown visibly, `title` omitted since the visible text already is
  raw) — AC-04-011.3. An item with no date at all (`item.date === ""`) still omits the date entirely,
  matching the pre-existing behavior for the FRD-only case. The FRD part of the evidence line is unchanged
  (still appended after a `·` separator, now its own `aria-hidden` span so the date/FRD text nodes stay
  independently testable).

**Interfaces/contracts exposed:**
- `formatChangeDate(date: string, now: Date): ChangeDateResult` — pure, `now` injected (same pattern as
  `freshnessBand`/`isLive` in `src/lib/status/liveness.ts`). `ChangeDateResult` exported from
  `src/lib/changes/formatChangeDate.ts`.
- `ChangeCard` (`src/app/projects/[slug]/_components/tab-changes/ChangeCard.tsx`) is otherwise unchanged
  (same props, same `data-testid`s on id/title/type-icon/button) — only the evidence line's date rendering
  changed, plus the new `data-testid="change-card-date"`.

**Implicit decisions and assumptions:**
- `formatChangeDate` is **deliberately NOT shared** with FRD-03's future `formatLastSync` (per the WO's
  explicit scope note) — disjoint artifact, no import from `src/lib/portfolio/**`.
- Threshold choice (not specified by the FRD beyond the four label shapes): < 30 days → days, 30–364 days →
  months (`round(diffDays / 30)`), ≥ 365 days → years (`round(diffDays / 365)`). A future-dated item (clock
  skew) clamps to `diffDays = 0` → "hoy", consistent with `liveness.ts`'s "future stamp reads as age 0" rule.
- `ChangeCard` calls `new Date()` itself at render (no `now` prop threaded through `ChangeQueueItem`/props) —
  it's a presentational computation, not stored/synced state, consistent with `react.md`'s "derive, don't
  sync"; component tests pin the clock with `vi.setSystemTime`.
- Visual fidelity: this WO changes only the evidence line's TEXT content on an already-shipped, already
  visually-verified card (`ChangeCard`/`ChangesPanel` predate this WO) — no new layout/section/component was
  added, so the DR-056 in-loop check was the existing component + green render/test output rather than a
  fresh screenshot-vs-mock pass; the mock's "Same metadata line, relative text only" note confirms no
  structural change was expected.

**Test files covering this WO:**
- `src/lib/changes/_tests/formatChangeDate.test.ts` — hoy/ayer/N días/1 mes (singular)/N meses/1 año
  (singular)/N años, unparseable, empty, purity (10 tests).
- `src/app/projects/[slug]/_components/tab-changes/_tests/ChangeCard.test.tsx` (new) — relative label +
  tooltip, label + FRD together, unparseable-date fallback shown raw, no-date omission (4 tests).
- `src/app/projects/[slug]/_components/tab-changes/_tests/ChangesPanel.test.tsx` — unchanged, still green
  (15 tests; no assertion in it pinned the raw ISO date string).

**Self-test run:** `pnpm biome check .` (clean, only a pre-existing schema-version info notice unrelated to
this change), `pnpm tsc --noEmit` (clean), `pnpm vitest run` limited to the three files above — 29/29 tests
passed.
