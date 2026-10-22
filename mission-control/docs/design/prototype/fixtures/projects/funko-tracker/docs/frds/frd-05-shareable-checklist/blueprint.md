# Blueprint — FRD-05 Shareable checklist

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-05-view** — the screen that renders the feature with the shared primitives.
- **CMP-05-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-05-read** — `readShareablechecklist()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-05-001 — Checklist export model
- WO-05-002 — Image renderer worker
- WO-05-003 — Export modes for all, owned and missing
- WO-05-004 — Poster layout for long lists
- WO-05-005 — Share link with expiry
- WO-05-006 — Export history page
