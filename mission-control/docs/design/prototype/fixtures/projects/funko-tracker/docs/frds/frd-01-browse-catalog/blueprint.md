# Blueprint — FRD-01 Browse the catalog

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-01-view** — the screen that renders the feature with the shared primitives.
- **CMP-01-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-01-read** — `readBrowsethecatalog()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-01-001 — Catalog read model and seed loader
- WO-01-002 — Franchise index page
- WO-01-003 — Series grid with lazy images
- WO-01-004 — Figure card component
- WO-01-005 — Search box with debounced query
- WO-01-006 — Filter chips by series and year
- WO-01-007 — Variant badges for chase and exclusive pieces
- WO-01-008 — Empty and error states for the catalog
- WO-01-009 — Pagination with stable URLs
- WO-01-010 — Sort by release date and box number
- WO-01-011 — Image fallback and alt text policy
- WO-01-012 — Catalog loading budget
- WO-01-013 — Franchise header with counts
- WO-01-014 — Keyboard navigation across the grid
- WO-01-015 — Phone layout for the series grid
- WO-01-016 — Catalog smoke and visual baselines
