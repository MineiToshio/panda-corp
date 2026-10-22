# Blueprint — FRD-04 Story encyclopedia

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-04-view** — the screen that renders the feature with the shared primitives.
- **CMP-04-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-04-read** — `readStoryencyclopedia()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-04-001 — Entry and revision model
- WO-04-002 — Entry page bounded by progress
- WO-04-003 — Characters, places and factions index
- WO-04-004 — Search inside the encyclopedia
- WO-04-005 — Bookmarks for entries
