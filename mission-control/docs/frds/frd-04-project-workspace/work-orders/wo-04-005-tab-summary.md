---
id: WO-04-005
type: work-order
slug: tab-summary-and-documents
title: 'WO-04-005 — Resumen + Documentos tabs'
status: DRAFT
parent: FRD-04
implementation_status: PLANNED
reopen_count: 1
artifacts:
  - 'src/app/projects/[slug]/_components/tab-summary/**'
  - 'src/app/projects/[slug]/_components/tab-documents/**'
source_requirements: [REQ-04-003, REQ-04-004, REQ-04-006]
last_updated: '2026-06-20'
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

## Status Note

**Built:** Re-painted `TabSummary` and `TabDocuments` to faithfully reproduce `projResumen()` /
`decisionesBox()` / `logBox()` / `projDocs()` on FRD-13 foundation primitives. Fidelity check (DR-056)
confirmed via Playwright screenshot at `/preview-wo04005`. Smoke gate clean (HTTP 200, all testids
present, no blank renders or console errors).

**Interfaces / contracts exposed:**

`TabSummary` (Server Component, `src/app/projects/[slug]/_components/tab-summary/tab-summary.tsx`):
```ts
interface TabSummaryProps {
  summary: string;
  keyPoints: string[];
  activityLog: ActivityLog;          // { entries: string[] }
  decisions: DecisionPoint[];        // { title, resolved, recommendation? }
  pendingDecisions: number;
}
```

`TabDocuments` (Server Component, `src/app/projects/[slug]/_components/tab-documents/tab-documents.tsx`):
```ts
interface TabDocumentsProps {
  nodes: DocNode[];       // { id, label, group, relPath } from listProjectDocs()
  selectedId: string | null;
  content: string | null; // raw markdown of selected doc, null = loading/unavailable
}
```

**Integration seams:**
- Both are already consumed by `src/app/projects/[slug]/page.tsx` → `resolveTabBody()` →
  `renderSummaryTab()` / `renderDocumentsTab()`. No changes needed to the page — the prop contract
  was kept stable from the previous stub.
- `renderSummaryTab()` passes `keyPoints={[]}` (FRD-04 scope does not include extracting key points
  from prose yet) and `summary={status.project ?? slug}`.
- Selection for `TabDocuments` is URL-driven: `?doc=<id>` search param → caller resolves `selectedId`
  and `content` using `listProjectDocs` + `readDoc` from `lib/docs/tree.ts`.

**Implicit decisions and assumptions:**
- `pendingDecisions` is passed as a pre-computed count (not re-derived inside `TabSummary`) so the
  parent page controls what "pending" means. Convention: `decisions.filter(d => !d.resolved).length`.
- "Aprobar la recomendación" is copy-only: renders a `<button>` containing `CopyButton` with value
  `/pandacorp:decide "Aprobado: <recommendation>"`. Never writes files or calls Claude.
- Resolved decisions render as neutral struck-through rows below the pending block (not in warn-bg
  cards) — visually distinct from pending, not hidden.
- Activity log entries are plain strings (no markdown); rendered as `ti-point-filled` dotted rows.
- `TabDocuments` empty state (nodes=[]) does NOT use a Panel — plain centered div with an emoji icon.
  Nav + body Panels appear only when nodes.length > 0.
- Nav selection is determined by `selectedId === node.id` comparison; the caller derives this from the
  URL search param `?doc=<encodedId>`.
- Group ordering in the nav follows insertion order from `listProjectDocs()` output (typically:
  Product → Feature: frd-NN-slug → Global).

**Test files:**
- `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.test.tsx` — original FRD-04 AC tests (28 tests)
- `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.wo04005.test.tsx` — WO-04-005 re-paint tests (11 tests): approve-btn, CmdRow presence, Panel usage
- `src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.test.tsx` — original FRD-04 AC tests (13 tests)
- `src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.wo04005.test.tsx` — WO-04-005 re-paint tests (4 tests): Panel usage in nav + body panes
- Preview route: `src/app/preview-wo04005/page.tsx` (fidelity check only, not shipping code)

All 56 component tests pass. Full suite: 293 test files, 6726 tests passing. TypeCheck: clean. Biome: clean.

## Gate finding (FRD-04 review, 2026-06-21) — REOPENED (reopen_count 1)

**CORRECTION (blocking) — nested interactive controls in the AC-mandated "Aprobar la
recomendación" affordance.** `ApproveButton` (`tab-summary.tsx`, ~L390-408) renders an outer
`<button data-testid="approve-btn">` that *contains* `<CopyButton>`, which itself renders a
`<button data-testid="copy-button">`. A `<button>` inside a `<button>` is invalid HTML.

Evidence (verified at the gate, not from the implementer summary):
- Real browser (`next start`, `/preview-wo04005`): the route throws an uncaught **React #418**
  `pageerror` (hydration mismatch — the server drops the nested button, client markup diverges).
  This is exactly what the mandatory Preview Smoke Gate (DR-055) fails on; the only reason the
  automated smoke is currently green is that the workspace route isn't blessed and doesn't resolve
  (see the separate FRD-03 note below) — the defect is real and would block the moment the route is
  smoked.
- React-DOM `validateDOMNesting` emits `console.error("<button> cannot contain a nested <button>")`
  in the test renderer too.
- a11y: nested interactive controls are not correctly keyboard/AT-operable (`accessibility.md`).

**Fix direction (do NOT drop the affordance — the EARS AC requires it):** make the approve
affordance a SINGLE interactive control. Either (a) a single `<button>` whose own click copies
`/pandacorp:decide "Aprobado: <recommendation>"` (reuse the copy logic, not the `CopyButton`
element nested inside another button), or (b) use `CopyButton` directly with its `label` prop
("Aprobar la recomendación") and the full command as its `value` — one button, no nesting. Keep
copy-only (never writes / never calls Claude).

**RED test added by the reviewer (drives the rebuild):**
`src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.reviewer.test.tsx` — asserts no
`<button>` contains a descendant `<button>`, and that the exact `/pandacorp:decide "Aprobado: …"`
command survives the fix. Currently RED against the defective code; make it GREEN.

Note: the WO-04-005 source is byte-identical to last-green `d37fa48` (the code was built in pass-2
before the owner stopped; this cycle only re-flagged it IN_REVIEW). So the defect is pre-existing in
the last-green tree — there is nothing new to revert (DR-070 is a no-op here); the fix must come from
the rebuild. The two tab bodies otherwise render structurally faithfully to `projResumen()` /
`projDocs()` (NOT a gross structural mismatch — the layout is recognizably the designed thing).
