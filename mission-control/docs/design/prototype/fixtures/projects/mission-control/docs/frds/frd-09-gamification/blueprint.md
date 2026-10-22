# Blueprint — FRD-09 Gamification

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-09-view** — the screen that renders the feature with the shared primitives.
- **CMP-09-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-09-read** — `readGamification()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-09-001 — Guild level from outcomes
- WO-09-002 — Rank catalogue
- WO-09-003 — Ledger snapshot
- WO-09-004 — Level-up celebration
- WO-09-005 — XP bar
- WO-09-006 — Durable outcome merge
