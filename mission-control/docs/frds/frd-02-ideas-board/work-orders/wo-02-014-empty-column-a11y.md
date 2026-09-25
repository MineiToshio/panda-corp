---
id: WO-02-014
type: work-order
slug: empty-column-a11y
title: 'WO-02-014 — Accessible empty-column marker on the ideas board'
status: ACTIVE
parent: FRD-02
implementation_status: BLOCKED
blocked_reason: needs-owner
difficulty: low
reopen_count: 0
artifacts:
  - 'src/app/board/IdeaBoardView/**'
source_requirements: [REQ-02-014, REQ-02-002]
dependsOn: [WO-02-005]
last_updated: '2026-09-24'
change_ref: canario-d-paralelismo-portfolio-board-changes-wo.md
---
# WO-02-014 — Accessible empty-column marker on the ideas board

**Change:** `.pandacorp/inbox/changes/canario-d-paralelismo-portfolio-board-changes-wo.md` (item 2).
**IDs touched:** REQ-02-014; `CMP-02-board` (`IdeaBoardView`).

## Problem

In `src/app/board/IdeaBoardView/IdeaBoardView.tsx` an empty column renders
`<div style={EMPTY_COLUMN_STYLE} title="Columna vacía">—</div>`: the dash is purely decorative, has no
role and no screen-reader text; `title` is not reliably announced by assistive tech, and a dash alone
conveys meaning by shape only (`docs/rules/accessibility.md`).

## Scope

- Replace the marker with an element carrying `role="status"` (polite live region semantics) whose
  accessible text is **"Sin ideas en esta columna"**.
- Keep it visually discreet: the dash stays as decorative content with `aria-hidden="true"`, plus a
  visually-hidden `<span>` with the real text (the project's existing visually-hidden pattern — e.g.
  the `srOnly` style in `src/app/board/_components/CardDetail/CardDetail.styles.ts` or Tailwind's
  `sr-only`; reuse, do not invent a new one). Drop the `title` attribute (redundant once real text exists).
- Keep `EMPTY_COLUMN_STYLE` as the visual style — no layout change.

**Out of scope:** any other board behavior; files outside `src/app/board/IdeaBoardView/**`.

## Acceptance criteria

- AC-02-014.1 — WHEN a board column has no cards, it SHALL expose an element with role `status` whose
  accessible name/text is "Sin ideas en esta columna".
- AC-02-014.2 — The decorative dash SHALL be `aria-hidden`; the visual look of the empty column is
  unchanged.
- AC-02-014.3 — Non-empty columns render no empty-state status element.

## Tests (RED first)

- `src/app/board/IdeaBoardView/_tests/IdeaBoardView.test.tsx` (or a new sibling test) — render a board
  with one empty column: `getByRole("status", { name/text: "Sin ideas en esta columna" })`; assert the
  dash is aria-hidden; a populated column has no such status.

## Visual reference

`docs/design/prototype/index.html` (ideas board columns). Visually identical to today's empty column.

## Status Note

**Built:** `IdeaBoardView.tsx`'s empty-column marker (`colCards.length === 0` branch) now renders two
siblings inside `EMPTY_COLUMN_STYLE`'s wrapper `<div>`:
- `<span aria-hidden="true">—</span>` — the decorative dash, kept visually as-is (AC-02-014.2).
- `<span role="status" aria-label="Sin ideas en esta columna" className="sr-only">Sin ideas en esta
  columna</span>` — the accessible marker (AC-02-014.1). The `title="Columna vacía"` attribute was
  dropped (redundant once real accessible text exists, per WO scope).

**Interfaces / contracts exposed:** No prop/signature changes — this is an internal-markup-only
change to `IdeaBoardView`'s empty-column rendering; `IdeaBoardViewProps` is untouched.

**Integration seams:** None beyond the existing `IdeaBoardView` render tree; no consumer of
`IdeaBoardView` needs to change.

**Implicit decisions / assumptions:**
- Reused the project's existing `sr-only` Tailwind v4 utility class (already used with the same
  `role="status"` + `aria-label` + visible-text-duplicated-as-content pattern in
  `src/components/modules/ProjectRail/ProjectRail.tsx` and
  `src/app/projects/[slug]/_components/wo-board/wo-board.tsx`) rather than inventing a new
  visually-hidden style object — no new shared component needed (DR-057), so
  `docs/design/components.md` is unchanged.
- ARIA note: `role="status"` does not derive its accessible NAME from content per the accname spec
  (browsers/testing-library compute `Name ""` for a bare `<span role="status">text</text>`), so an
  explicit `aria-label="Sin ideas en esta columna"` was added alongside the identical visible text
  content — both mechanisms carry the same string, so AC-02-014.1 ("accessible name/text") is
  satisfied whichever computation an assistive-tech/test harness uses.
- The dash's plain-text node was wrapped in its own `<span aria-hidden="true">` (rather than adding
  `aria-hidden` to the outer `EMPTY_COLUMN_STYLE` div) so the div itself remains in the accessibility
  tree as the container for the sibling `role="status"` span — hiding the whole wrapper would have
  hidden the status marker too.
- `EMPTY_COLUMN_STYLE` (the visual style) is unchanged — no layout/visual regression (confirmed via a
  Playwright screenshot of `/board` before/after: empty columns render an identical dash).

**Test files:** `src/app/board/IdeaBoardView/_tests/IdeaBoardView.wo02014.test.tsx` (new, 3 tests:
role=status name/text match, dash aria-hidden, non-empty column has no status element). Full
`src/app/board` suite re-run green (21 files / 362 tests, including the reviewer acceptance suites
`frd-02.integration.reviewer.test.tsx` / `frd-02.shell-integration.reviewer.test.tsx` — untouched,
not edited per DR-080).

**Verification:** `pnpm biome check .` clean; `pnpm tsc --noEmit` clean; `pnpm vitest run
src/app/board` — 362/362 passing.
