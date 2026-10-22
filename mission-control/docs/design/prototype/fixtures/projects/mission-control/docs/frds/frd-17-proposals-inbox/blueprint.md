# Blueprint — FRD-17 Proposals inbox

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-17-view** — the screen that renders the feature with the shared primitives.
- **CMP-17-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-17-read** — `readProposalsinbox()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-17-001 — Lesson reader
- WO-17-002 — Promotion queue
- WO-17-003 — Prune list
- WO-17-004 — Memory health
- WO-17-005 — Self-suggestions
- WO-17-006 — Backlog reader
- WO-17-007 — Proposals summary
