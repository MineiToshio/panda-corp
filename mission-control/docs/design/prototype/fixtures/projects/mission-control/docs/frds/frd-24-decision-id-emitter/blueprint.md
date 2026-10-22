# Blueprint — FRD-24 Decision id emitter

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-24-view** — the screen that renders the feature with the shared primitives.
- **CMP-24-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-24-read** — `readDecisionidemitter()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-24-001 — Stable decision ids
- WO-24-002 — Decide command with ids
