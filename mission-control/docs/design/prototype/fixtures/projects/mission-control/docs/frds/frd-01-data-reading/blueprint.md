# Blueprint — FRD-01 Data reading

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-01-view** — the screen that renders the feature with the shared primitives.
- **CMP-01-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-01-read** — `readDatareading()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-01-001 — Factory root resolution
- WO-01-002 — Idea card reader
- WO-01-003 — Portfolio table parser
- WO-01-004 — Status file reader
- WO-01-005 — Project path existence check
- WO-01-006 — Docs tree listing
- WO-01-007 — Decision inbox parser
- WO-01-008 — Activity log reader
- WO-01-009 — Events tail reader
- WO-01-010 — Reader fixtures and malformed cases
