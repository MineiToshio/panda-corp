# Blueprint — FRD-05 Work orders

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-05-view** — the screen that renders the feature with the shared primitives.
- **CMP-05-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-05-read** — `readWorkorders()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-05-001 — Work-order discovery
- WO-05-002 — Kanban by state
- WO-05-003 — Work-order detail tabs
- WO-05-004 — Full document view
