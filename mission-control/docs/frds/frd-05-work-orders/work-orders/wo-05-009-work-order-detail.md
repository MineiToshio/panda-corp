---
id: WO-05-009
type: work-order
slug: work-order-detail
title: 'WO-05-009 Work-order detail: reading summary and full document'
status: DRAFT
parent: FRD-05
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: medium
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_components/wo-detail/**'
  - 'src/lib/work-orders/**'
  - 'e2e/work-order-detail.spec.ts'
source_requirements: [REQ-05-004, REQ-05-005, REQ-05-008]
dependsOn: [WO-04-010, WO-05-002, WO-08-003, WO-12-007]
last_updated: 2026-10-22
---

# WO-05-009 Work-order detail: reading summary and full document

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED` without the FRD gate passing.

## Summary

Rebuilds the work-order drill-in of the Observabilidad tab as the Órbita reading summary: crumbs and a tinted hero
with the id, FRD and «Volver», the four-step flow header with its «Ahora:» sentence, the Resumen cards in a fixed
reading order (what it is about, what changes and what is out of scope, how it is checked with one card per
criterion and the EARS keywords marked, what was built folded), the fact sheet, dependencies up and down and the
scoped build command, plus the Documento completo view and the in-tab not-found card. It extends the work-order
reader with the detail model and drops superseded work orders from every list.

## In Scope

- **`WoDetail({ project, woId, view })`** (`src/app/projects/[slug]/_components/wo-detail/`, async Server
  Component, the seam WO-04-010 creates as an adapter; this WO rewrites its internals, export and props unchanged).
  It calls `readWorkOrderDetail` and renders either the detail or the not-found card.
- **`WorkOrderDetail`** (restyled in place; v1 props stay type-valid, new props optional) composed of:
  - `Crumbs` Observabilidad › FRD code › work-order id (links keep the list's `view`/`frd`/`state`).
  - Hero (`Card` tinted in the state hue): mono id chip, «FRD-NN · title» chip (FRD index of WO-12-007), title
    without the `WO-NN-MMM —` prefix, «Volver» back to the list with its filters (drops `wo`/`woview`).
  - `WoSteps` (relocated into this folder): Planificado → En curso → En revisión → Verificado, the current step
    `aria-current="step"`, past steps checked, then «Ahora:» + the state's sentence from the catalogue; a failed
    order shows its «Bloqueado» chip and sentence instead of the steps.
  - `Tabs` Resumen / Documento completo (URL `woview`, arrow keys).
  - Resumen, in this order: «De qué trata» (about), «Qué cambia» with the «Fuera de alcance» block apart, «Cómo se
    comprueba» (`CriterionList`, relocated here: one card per criterion, the id as a tag, WHEN/WHILE/WHERE/IF/
    THEN/SHALL/SHALL NOT/AND marked), «Qué se construyó» (the Status Note; long notes show their first blocks and
    fold the rest behind «Ver la nota completa»; titled «Nota de estado» while the order is not yet in review or
    verified); a card is omitted when its section is absent, and an order with none of them shows the catalogue's
    «no publica resumen» line; then the language line and the «Leer el documento completo» link.
  - Side column: «Ficha» (`KeyValue`: Estado chip, Dificultad, Reaperturas or «Ninguna», Actualizada, Requisitos
    as outline chips, Bloqueo when blocked, «Archivos que toca» list of `artifacts`), «Dependencias» (Depende de /
    Desbloquea as `DependencyButton`s, relocated here, each with its state dot; «Ninguna» when empty), «Construir
    esta work order» with the `CommandBox` `/pandacorp:implement <id>` (copy only).
  - Documento completo: the `Paper` reader (WO-08-003) tinted green with the Work order type chip, the document
    path, the «Copiar documento» icon button and the rendered markdown (`Markdown`).
  - Not found (unknown or no-longer-readable id): under the tab bar, a `Card` «Esta work order no está publicada»
    with «{id} no aparece entre las work orders de {project}.» and the «Ver work orders» button back to the list;
    no hero, no flow header; never `notFound()` and never the first unrelated order.
- **`src/lib/work-orders/` (IF-05-work-orders, additive, existing signatures unchanged):** the optional fact
  fields on `WorkOrder` (`difficulty`, `reopenCount`, `lastUpdated`, `requirements`, `artifacts`,
  `blockedReason`), `readWorkOrderDetail(projectPath, woId)` with its discriminated result (blueprint Contracts),
  the section extraction by heading family, `dependents` (orders whose `dependsOn` names this one), and the
  exclusion of `status: SUPERSEDED` documents from `listWorkOrders`. Pure, path-confined, deduped per request.
- Re-home the `readWorkOrderDoc` path-traversal security cases (from the reviewer integration test WO-05-008
  removes) into `src/lib/work-orders/_tests/`.

## Out of Scope

- Mounting the detail in the panel and the live refresher (WO-05-008); the list views; the workspace frame.
- Any edit to `src/app/projects/[slug]/_components/_tests/frd-05*.reviewer*` (reviewer-owned) or to a baseline.
- Running a command: «Construir esta work order» is copy-only.

## Requirements & Acceptance Criteria

REQ-05-004 (Resumen and Documento completo), REQ-05-005 (the reader that feeds the counts), REQ-05-008.

- **AC-05-008.4** — THE work-order Resumen SHALL read in this order: a flow header with an "Ahora:" sentence; "De qué trata"; "Qué cambia" (with "Fuera de alcance" apart (drawn in FRD-02's FRD dialog)); "Cómo se comprueba" (one card per acceptance criterion, EARS keywords marked); "Qué se construyó" (a long note folded). It SHALL show a fact sheet (Estado, Dificultad, Reaperturas, Actualizada, Requisitos, Archivos que toca, Dependencias up and down, "Construir esta orden" with its scoped build command) and a line saying the content comes from the order's own document.

The «Fuera de alcance» label is the catalogue's work-order out-of-scope string; no FRD-05 captured state draws it
because the captured order (WO-02-014) has no out-of-scope section (reported to the design ledger). The fact-sheet
build card uses the catalogue title «Construir esta work order» (FDD-05, `wo-detail`).

**Completeness and NFRs (DR-100/DR-102).** Error path: an unknown id or an unreadable file → the not-found card
(typed `not-found` result, DR-078); a document without the known headings → the «no publica resumen» line and
the full document still available. Input validation: `woview` values other than the two views fall back to
Resumen. Security: `readWorkOrderDoc`/`readWorkOrderDetail` stay confined to `docs/frds/*/work-orders/` (no path
traversal). Accessibility: crumbs and «Volver» are real links; the steps list has its accessible name; tabs are
the shared `Tabs`; the copy buttons are named «Copiar <comando>»; state chips carry icon + word. Performance: one
read per request, server-rendered markdown, no client fetch. Reduced motion: none added.

## Components built (blueprint)

CMP-05-detail (`WoDetail`, `WorkOrderDetail`, `WoSteps`, `CriterionList`, `DependencyButton`), IF-05-work-orders
(v2 additions). Reuse `Card`/`CardHeader`, `Tabs`, `Crumbs`, `Markdown` (WO-13-012), `Chip`, `KeyValue`,
`CommandBox`, `Button`, `StateDot` with the shared state map (WO-13-011), `Paper` (WO-08-003). `WoSteps`,
`CriterionList` and `DependencyButton` are components.md rows relocated from `_components/wo/` into this folder
(names unchanged). Installs: none.

## Visual reference

- **Mock screens to reproduce:** `docs/frds/frd-05-work-orders/mocks/work-orders.html` sections `wo-detail`,
  `wo-detail-full`, `wo-detail-not-found` (screenshots at 375, 768, 1280, light and dark).
- **Prototype functions:** `orderDetail`, `criteriaHtml`, `foldedHtml`, `sectionHtml` and the `WO_NOW` sentences
  in `docs/design/prototype/prototype.js`; CSS families 12-command, 15-key-value, 20-tabs, 26-work-orders. Keep the
  recorded hooks `.wo-hero`, `.wo-title`, `.wo-steps`, `.wo-step-dot`, `.wo-now`, `.wo-detail-grid`, `.wo-story`,
  `.wo-out`, `.crit`, `.crit-id`, `.crit-t`, `.ears`, `.wo-more`, `.wo-lang`, `.wo-files`, `.paper`, `.paper-head`
  and `data-wo` on dependency buttons.
- **Token slice:** tinted hero (`--tint-strong` of the state hue), card surfaces and hairlines, the teal / blue /
  green / violet section hues of the four Resumen cards, outline chips for requirements, mono for ids, paths and
  the command, 12 px floor.
- **FDD pointer:** `docs/frds/frd-05-work-orders/fdd.md` («Work order, Resumen», «Work order, Documento
  completo», «Unknown work order»).
- **Fidelity criterion:** the built detail matches the three mock sections (layout, order of cards, fact sheet,
  density) on the frozen tokens, not an approximation; preview smoke (DR-055) per FRD and the close-out fidelity
  diff in oracle mode.

## Tests

- **Behaviour e2e:** `e2e/work-order-detail.spec.ts` (`gotoHydrated`, `getByRole`): opening
  `…/observability?wo=WO-01-003` on the e2e fixture shows the Resumen in order and the fact sheet; switching to
  Documento completo writes `woview` and survives reload; «Volver» returns to the list; an unknown id shows the
  not-found card and its «Ver work orders» link.
- **Unit / integration:** `readWorkOrderDetail` against real production-shaped work-order fixtures (frontmatter +
  every heading family, a legacy body-marker order, a malformed file that yields `not-found` or empty sections,
  never a throw); `listWorkOrders` drops `status: SUPERSEDED`; dependents derived from real `dependsOn`; the
  criteria split (id tag + EARS marks); the section order; the failed state without steps; the path-traversal
  cases.
- **Derogated tests (map §3.3):** re-blessed by the FRD-05 gate reviewer, never edited here:
  `src/app/projects/[slug]/_components/_tests/frd-05-gate-opus.reviewer.test.tsx` and
  `src/app/projects/[slug]/_components/_tests/frd-05-reuse.gate.reviewer.test.tsx` (their `WorkOrderDetail`
  assertions: the FRD chip and the one `Tabs` still hold in v2; the «back to ?tab=work-orders» link changes).
  Implementer tests `wo-detail/_tests/wo-detail.test.tsx` and `wo-detail.integration.test.tsx` are rewritten to v2;
  `src/lib/work-orders/_tests/*` extended. Baselines untouched.

## Definition of done

- `bash .pandacorp/verify.sh --since <base>` green; the e2e spec passes; preview smoke clean.
- AC-05-008.4 met by tests that fail without this change; the not-found and malformed paths covered.
- Every pre-existing `src/lib/work-orders` test still green (WO-05-001/002 history) apart from the intended
  superseded exclusion; no reviewer test edited; strings through `t()`; tokens only.

## Dependencies

WO-04-010 (W5: frame and the `WoDetail` adapter), WO-05-002 (`aggregateProgress`, VERIFIED), WO-08-003 (W3:
`Paper`) and WO-12-007 (W3: the FRD index). The last two edges are added to the map's list because this WO imports
them (DR-087: real upstream); the wave stays W6. Builds in parallel with WO-05-008 (disjoint artifacts).

## Status Note
