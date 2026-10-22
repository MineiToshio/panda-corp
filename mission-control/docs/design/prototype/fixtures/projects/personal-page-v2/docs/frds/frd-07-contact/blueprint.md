# Blueprint — FRD-07 Contact

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-07-view** — the screen that renders the feature with the shared primitives.
- **CMP-07-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-07-read** — `readContact()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-07-001 — Contact form with a hosted form service
