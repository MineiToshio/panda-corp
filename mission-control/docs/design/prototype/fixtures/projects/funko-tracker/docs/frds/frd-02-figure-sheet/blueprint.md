# Blueprint — FRD-02 Figure detail sheet

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-02-view** — the screen that renders the feature with the shared primitives.
- **CMP-02-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-02-read** — `readFiguredetailsheet()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-02-001 — Figure detail route
- WO-02-002 — Variant switcher on the sheet
- WO-02-003 — Release history table
- WO-02-004 — Official image gallery with credits
- WO-02-005 — Related figures strip
