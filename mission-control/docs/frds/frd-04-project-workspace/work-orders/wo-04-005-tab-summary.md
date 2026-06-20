---
id: WO-04-005
type: work-order
slug: tab-summary-and-documents
title: 'WO-04-005 — Resumen + Documentos tabs'
status: DRAFT
parent: FRD-04
implementation_status: PLANNED
artifacts:
  - 'src/app/projects/[slug]/_components/tab-summary/**'
  - 'src/app/projects/[slug]/_components/tab-documents/**'
source_requirements: [REQ-04-003, REQ-04-004, REQ-04-006]
last_updated: '2026-06-19'
---
# WO-04-005 — Resumen + Documentos tabs

## Goal
Re-implement the two tab bodies FRD-04 owns directly — the **Resumen** tab and the **Documentos** tab
— so they render faithfully to the prototype `projResumen()` / `projDocs()` on the frozen tokens,
reusing the FRD-13 foundation primitives. They are collapsed into one coarse WO because they share the
same `lib/docs.ts` reader (VERIFIED) and the same tab-shell seam.

The `lib/**` readers (`readDecisions`, `readActivityLog`, `listProjectDocs`, `readDoc`) are correct and
VERIFIED — this WO is **presentational only**.

## Scope
**Resumen tab** (`_components/tab-summary/**`, Server) — mirrors prototype `projResumen()`:
- **`TabSummary`** — the doc `.panel` with the summary + "Puntos clave" list (`Panel` + `DocHeading`).
- **`DecisionCard`** (prototype `decisionesBox()`) — decision points on the **warn-bg** treatment, each
  with its count (`CountBadge`), the AI recommendation, the `/pandacorp:decide` command rendered through
  the shared **`CmdRow`** with the **"Aprobar la recomendación" one-click** that copies
  `/pandacorp:decide "Aprobado: <recommendation>"` (copy only — the app never writes/calls Claude),
  fired via `Toast`. Neutral "Sin puntos pendientes" `Panel` when none.
- **`ActivityLog`** (prototype `logBox()`) — dotted-rule rows of high-level activity; "Aún sin actividad
  registrada" empty state.
- State **never by color alone** (FRD-13): warn carries an icon + label; counts `tabular-nums`.

**Documentos tab** (`_components/tab-documents/**`, Server) — mirrors prototype `projDocs()`:
- **`DocNav`** — the ~200px `.navitem` doc-nav rail grouped by `DocNode.group`; selected item via
  `?doc=<id>`, default = first node.
- **`DocView`** — the `.panel.doc` rendered-markdown body (`react-markdown`) of the selected doc.
- Graceful empty state when `listProjectDocs` returns `[]`.

**Reuse before create** (`docs/design/components.md`): `Panel`, `DocHeading`, `CmdRow`, `CountBadge`,
`Toast`, `DocNav`/`DocView` — no bespoke card/banner/command-row forks.

## Acceptance criteria
- **AC-04-003.1** The Resumen tab SHALL render the project summary and key points.
- **AC-04-003.2** It SHALL render the activity log from `.pandacorp/comms/progress.md`; "no activity yet"
  empty state when absent.
- **AC-04-003.3** It SHALL render the decision points from `.pandacorp/inbox/decisions.md`, each
  highlighted, with a total count badge.
- **AC-04-004.1** WHEN `pending_decisions > 0`, the decision block SHALL be visually highlighted (warn
  treatment, icon + label, not color alone) and show the count; otherwise a neutral state.
- WHERE a pending decision carries a recommendation, the **"Aprobar la recomendación"** one-click SHALL
  copy `/pandacorp:decide "Aprobado: <recommendation>"` (copy only).
- **AC-04-006.1** The Documentos tab SHALL render the feature-centric doc tree (nav) from `lib/docs.ts`.
- **AC-04-006.2** WHEN a document is selected it SHALL render its markdown body; first doc selected by default.
- **AC-04-006.3** WHEN there are no readable documents it SHALL show a graceful empty state.
- Rendered output matches `projResumen()` / `projDocs()` on the frozen tokens; browser fidelity/smoke gate clean.

## Dependencies
- **Foundation (FRD-13):** WO-13-007 (the ONE `Banner` + `Chip`/`CountBadge`/`Panel`/`CmdRow`/`Button`/
  `Toast`/`ProgressBar`/`DocHeading`).
- **Intra (FRD-04):** WO-04-001 (`lib/docs.ts`: `readDecisions`/`readActivityLog`/`listProjectDocs`/
  `readDoc`) — VERIFIED lib; WO-04-004 (shell mounts these tabs).
- **Cross-FRD:** `frd-13`.

## Visual reference
`docs/design/prototype/index.html` → `projResumen()` (with `decisionesBox()` + `logBox()`) and
`projDocs()`, on the frozen tokens. Fidelity, not novelty (DR-056) — see `../fdd.md` and `../mocks/README.md`.
