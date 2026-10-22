# Blueprint — FRD-10 Achievements hall

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-10-view** — the screen that renders the feature with the shared primitives.
- **CMP-10-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-10-read** — `readAchievementshall()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-10-001 — Trophy catalogue
- WO-10-002 — Secret achievements
- WO-10-003 — Mission chains
- WO-10-004 — Seals by axis
- WO-10-005 — Stats panel
- WO-10-006 — Radar of guild attributes
- WO-10-007 — Weekly flow chart
- WO-10-008 — Funnel and flow
- WO-10-009 — Phase transitions list
- WO-10-010 — Informe verdict
