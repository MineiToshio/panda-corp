# Blueprint — FRD-01 Site shell, languages and themes

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-01-view** — the screen that renders the feature with the shared primitives.
- **CMP-01-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-01-read** — `readSiteshelllanguagesandthemes()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-01-001 — Layout shell with skip link
- WO-01-002 — Two-language routing
- WO-01-003 — Light and dark themes without flash
- WO-01-004 — Shared header and footer
