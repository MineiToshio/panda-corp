# Blueprint — FRD-05 Blog in MDX

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-05-view** — the screen that renders the feature with the shared primitives.
- **CMP-05-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-05-read** — `readBloginMDX()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-05-001 — Content collection for posts
- WO-05-002 — Post page with reading time
- WO-05-003 — Tag pages and RSS feed
