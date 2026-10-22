# Blueprint — FRD-06 Chapter explorer

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-06-view** — the screen that renders the feature with the shared primitives.
- **CMP-06-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-06-read** — `readChapterexplorer()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-06-001 — Chapter list per release
- WO-06-002 — Chapter page with what changed
