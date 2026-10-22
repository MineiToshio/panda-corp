# Blueprint — FRD-08 Blog writer skill

## Approach

A thin reader in `src/app/lib` feeds one server component; client state is limited to what the interaction needs.

## Components

- **CMP-08-view** — the screen that renders the feature with the shared primitives.
- **CMP-08-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-08-read** — `readBlogwriterskill()` returns `{ ok: true, value } | { ok: false, reason }`.

## Work orders

- WO-08-001 — Skill entry point and prompts
- WO-08-002 — Topic intake from notes
- WO-08-003 — Outline draft
- WO-08-004 — Draft in the house voice
- WO-08-005 — Fact and link checker
- WO-08-006 — Bilingual pass
- WO-08-007 — Front matter and slug
- WO-08-008 — Cover image brief
- WO-08-009 — Editorial review checklist
