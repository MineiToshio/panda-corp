# Blueprint — FRD-01 Reader account and progress

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-01-view** — the screen that renders the feature with the shared primitives.
- **CMP-01-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-01-read** — `readReaderaccountandprogress()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-01-001 — Guest context on first visit
- WO-01-002 — Email account with magic link
- WO-01-003 — Merge guest progress into an account
- WO-01-004 — Progress model per release
- WO-01-005 — Mark a chapter as read
- WO-01-006 — Progress bar per work
- WO-01-007 — Continue-reading shelf
- WO-01-008 — Reading history page
- WO-01-009 — Export my progress
- WO-01-010 — Delete my account
- WO-01-011 — Session and device list
- WO-01-012 — Progress sync across devices
- WO-01-013 — Account smoke and visual baselines
