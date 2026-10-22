# Blueprint — FRD-04 About and now

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-04-view** — the screen that renders the feature with the shared primitives.
- **CMP-04-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-04-read** — `readAboutandnow()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-04-001 — About and now pages
