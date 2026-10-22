# Blueprint — FRD-06 Party

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-06-view** — the screen that renders the feature with the shared primitives.
- **CMP-06-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-06-read** — `readParty()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-06-001 — Party scene layout
- WO-06-002 — Agent tokens by station
- WO-06-003 — Live event mapping
- WO-06-004 — Relay animation
- WO-06-005 — Idle and empty states
- WO-06-006 — Reduced-motion variant
- WO-06-007 — Party legend
