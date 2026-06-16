# WO-04-006 — Documents tab: nav + rendered markdown

**Feature:** FRD-04 · **Implements:** CMP-04-tab-documents · **REQ-04-006**
**Deploy unit:** `app/projects/[slug]/_components/tab-documents.tsx` + colocated tests.

## Acceptance criteria (copied)
- **AC-04-006.1** The Documents tab SHALL render the feature-centric document tree (nav) from `lib/docs.ts`.
- **AC-04-006.2** WHEN a document is selected, the Documents tab SHALL render its markdown body; the first available document is selected by default.
- **AC-04-006.3** WHEN the project has no readable documents, the Documents tab SHALL show a graceful empty state.

## Scope
- `CMP-04-tab-documents` (Server): two-pane layout — a grouped nav (`DocNode[]` from
  `listProjectDocs`, grouped by `group`) + the rendered markdown body of the selected doc
  (`readDoc` + `react-markdown`). Selected doc via a search param (e.g. `?doc=<id>`); default = first.
- Empty state when `listProjectDocs` returns `[]` (AC-04-006.3).
- **Out of scope:** the doc readers (WO-04-001); the per-FRD work-orders documents (FRD-05).

## Dependencies
- **Intra:** WO-04-001 (`listProjectDocs`, `readDoc`), WO-04-004 (shell mounts this tab).
- **Cross:** stack: `react-markdown` (architecture §2).

## TDD (RED → GREEN → refactor)
Component tests:
1. Renders the grouped nav from fixture `DocNode[]` (AC-04-006.1).
2. Default selects the first doc and renders its markdown body (AC-04-006.2).
3. Selecting another doc (via param) renders that body (AC-04-006.2).
4. Empty doc set → graceful empty state, no crash (AC-04-006.3).

## Definition of done
- [ ] Component tests written first and green.
- [ ] Server Component (selection is URL-driven, no client state); `react-markdown` renders the body.
- [ ] Spanish copy via i18n; tokens only; nav items have `data-testid`.
- [ ] `bash .pandacorp/verify.sh` passes.
