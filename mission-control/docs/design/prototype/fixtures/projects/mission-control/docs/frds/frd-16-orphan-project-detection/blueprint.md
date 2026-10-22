# Blueprint — FRD-16 Orphan project detection

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-16-view** — the screen that renders the feature with the shared primitives.
- **CMP-16-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-16-read** — `readOrphanprojectdetection()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-16-001 — Sibling folder scan
- WO-16-002 — Orphan classification
- WO-16-003 — Orphan list view
- WO-16-004 — Adopt command hint
