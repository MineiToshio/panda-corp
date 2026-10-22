# Blueprint — FRD-03 Projects and case studies

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-03-view** — the screen that renders the feature with the shared primitives.
- **CMP-03-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-03-read** — `readProjectsandcasestudies()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-03-001 — Project index from content files
- WO-03-002 — Case study template
- WO-03-003 — Case study image gallery
