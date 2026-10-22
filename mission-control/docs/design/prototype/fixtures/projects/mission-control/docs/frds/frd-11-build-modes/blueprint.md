# Blueprint — FRD-11 Build modes

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-11-view** — the screen that renders the feature with the shared primitives.
- **CMP-11-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-11-read** — `readBuildmodes()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-11-001 — Build mode catalogue
- WO-11-002 — Mode switch with memory
