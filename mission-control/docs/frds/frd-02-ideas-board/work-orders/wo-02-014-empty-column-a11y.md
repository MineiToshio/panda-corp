---
id: WO-02-014
type: work-order
slug: empty-column-a11y
title: 'WO-02-014 — Accessible empty-column marker on the ideas board'
status: DRAFT
parent: FRD-02
implementation_status: PLANNED
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

_Pending — PLANNED._
