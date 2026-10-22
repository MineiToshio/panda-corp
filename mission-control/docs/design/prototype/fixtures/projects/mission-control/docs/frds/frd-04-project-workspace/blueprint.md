# Blueprint — FRD-04 Project workspace

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-04-view** — the screen that renders the feature with the shared primitives.
- **CMP-04-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-04-read** — `readProjectworkspace()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-04-001 — Workspace route by slug
- WO-04-002 — Summary tab
- WO-04-003 — Documents tab with index
- WO-04-004 — Commands tab
- WO-04-005 — Not-found project state
