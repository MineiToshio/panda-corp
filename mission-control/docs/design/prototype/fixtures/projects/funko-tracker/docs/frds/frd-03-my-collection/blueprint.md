# Blueprint — FRD-03 Account and private collection

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-03-view** — the screen that renders the feature with the shared primitives.
- **CMP-03-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-03-read** — `readAccountandprivatecollection()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-03-001 — Email sign-in with magic links
- WO-03-002 — Collection item model and migrations
- WO-03-003 — Mark as owned from any card
- WO-03-004 — Collection page with filters
- WO-03-005 — Condition and box notes per item
- WO-03-006 — Account deletion and data export
- WO-03-007 — Session hardening and rate limits
- WO-03-008 — Collection counters per franchise
