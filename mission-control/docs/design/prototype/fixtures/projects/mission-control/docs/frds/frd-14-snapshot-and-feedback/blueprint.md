# Blueprint — FRD-14 Snapshot and feedback

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-14-view** — the screen that renders the feature with the shared primitives.
- **CMP-14-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-14-read** — `readSnapshotandfeedback()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-14-001 — Snapshot export
- WO-14-002 — Feedback channel links
- WO-14-003 — Copy command buttons
- WO-14-004 — Toast notices
