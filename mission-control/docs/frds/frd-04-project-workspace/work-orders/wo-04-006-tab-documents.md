---
id: WO-04-006
type: work-order
slug: tab-documents
title: 'WO-04-006 — Documents tab: nav + rendered markdown'
status: DRAFT
parent: FRD-04
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
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
- [x] Component tests written first and green.
- [x] Server Component (selection is URL-driven, no client state); `react-markdown` renders the body.
- [x] Spanish copy via i18n; tokens only; nav items have `data-testid`.
- [x] `bash .pandacorp/verify.sh` passes.

## Status Note

**What it built:** `CMP-04-tab-documents` — a Server Component implementing the Documents tab for
FRD-04. Two-pane layout: grouped navigation tree (left) + rendered markdown body (right).

**Interfaces / contracts exposed:**

```tsx
// app/projects/[slug]/_components/tab-documents.tsx
export interface TabDocumentsProps {
  nodes: DocNode[];       // from listProjectDocs(projectPath) — IF-04-docs
  selectedId: string | null;  // from ?doc=<id> search param; null = first node
  content: string | null;     // from readDoc(projectPath, relPath); null = loading state
}
export function TabDocuments(props: TabDocumentsProps): React.JSX.Element
```

**Integration seams:**
- Consumed by `app/projects/[slug]/page.tsx` in the `documents` tab branch: calls
  `listProjectDocs(projectPath)` + `readDoc(projectPath, relPath)` and passes results as props.
  URL param `?doc=<id>` drives `selectedId`; defaults to first node if absent or invalid.
- Consumes `DocNode` from `@/lib/docs` (IF-04-docs, WO-04-001).
- Renders markdown via `react-markdown` (no `"use client"` — pure Server Component).

**data-testid contract:**
- `documents-empty` — empty state (AC-04-006.3); `role="status"`, `aria-label` in Spanish
- `documents-nav` — left nav pane (AC-04-006.1); `aria-label="Árbol de documentos"`
- `doc-nav-item` — each nav link; `aria-current="page"` on selected; `href="?doc=<id>"`
- `documents-body` — right body pane with markdown (AC-04-006.2)
- `documents-loading` — loading state when `content=null` but nodes are present; `role="status"`

**Test files:** `app/projects/[slug]/_components/tab-documents.test.tsx` — 17 tests RED→GREEN
covering AC-04-006.1 (5 tests), AC-04-006.2 (3 tests), AC-04-006.3 (4 tests), loading state (3 tests).

**verify.sh:** VERDE — 120 test files, 3440 tests pass, biome clean, tsc clean.
