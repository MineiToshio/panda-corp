# Blueprint — FRD-21 Pending merge

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-21-view** — the screen that renders the feature with the shared primitives.
- **CMP-21-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-21-read** — `readPendingmerge()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-21-001 — Unmerged branch reader
- WO-21-002 — Pending work indicator
