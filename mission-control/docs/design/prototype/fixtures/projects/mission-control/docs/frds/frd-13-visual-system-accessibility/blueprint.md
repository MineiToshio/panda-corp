# Blueprint — FRD-13 Visual system and accessibility

## Approach

A thin reader in `src/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-13-view** — the screen that renders the feature with the shared primitives.
- **CMP-13-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-13-read** — `readVisualsystemandaccessibility()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-13-001 — Design token registry
- WO-13-002 — Light and dark themes
- WO-13-003 — Focus ring and skip link
- WO-13-004 — Dialog focus trap
- WO-13-005 — Tab strip with arrows
- WO-13-006 — Touch target floor
- WO-13-007 — Reduced motion
- WO-13-008 — Contrast audit fixes
- WO-13-009 — Responsive shell
