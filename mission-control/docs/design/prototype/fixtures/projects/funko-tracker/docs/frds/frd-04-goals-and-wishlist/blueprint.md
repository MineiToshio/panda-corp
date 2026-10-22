# Blueprint — FRD-04 Goals and wishlist

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-04-view** — the screen that renders the feature with the shared primitives.
- **CMP-04-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-04-read** — `readGoalsandwishlist()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-04-001 — Goal model per series
- WO-04-002 — Missing figures view
- WO-04-003 — Wishlist toggle and list
- WO-04-004 — Goal progress ring
