# Blueprint — FRD-08 Help, contact and legal

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-08-view** — the screen that renders the feature with the shared primitives.
- **CMP-08-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-08-read** — `readHelpcontactandlegal()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-08-001 — Help and FAQ pages
- WO-08-002 — Contact form and legal pages
