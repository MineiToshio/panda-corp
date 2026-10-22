# Blueprint — FRD-15 Plugin out-of-sync warning

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-15-view** — the screen that renders the feature with the shared primitives.
- **CMP-15-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-15-read** — `readPluginoutofsyncwarning()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-15-001 — Installed version reader
- WO-15-002 — Source version reader
- WO-15-003 — Drift banner
- WO-15-004 — Update command copy
