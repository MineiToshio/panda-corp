# Blueprint — FRD-03 Portfolio

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-03-view** — the screen that renders the feature with the shared primitives.
- **CMP-03-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-03-read** — `readPortfolio()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-03-001 — Portfolio rail with phases
- WO-03-002 — Release snapshot columns
- WO-03-003 — Last sync formatting
