# Blueprint — FRD-02 Ideas board

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-02-view** — the screen that renders the feature with the shared primitives.
- **CMP-02-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-02-read** — `readIdeasboard()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-02-001 — Column derivation from status
- WO-02-003 — Next-step hint per column
- WO-02-004 — Discard with confirmation
- WO-02-005 — Board view with search
- WO-02-007 — Card detail with tabs
- WO-02-011 — Phase taken from the project status
- WO-02-012 — Favourite flag on cards
- WO-02-013 — Idea name inside next-step hints
- WO-02-014 — Accessible empty-column marker
