---
id: WO-04-005
type: work-order
slug: tab-summary-and-documents
title: 'WO-04-005 — Resumen + Documentos tabs'
status: DRAFT
parent: FRD-04
implementation_status: VERIFIED
reopen_count: 0
artifacts:
  - 'src/app/projects/[slug]/_components/tab-summary/**'
  - 'src/app/projects/[slug]/_components/tab-documents/**'
source_requirements: [REQ-04-003, REQ-04-004, REQ-04-006]
dependsOn: [WO-04-001, WO-04-004, WO-02-003, WO-13-006, WO-13-007, WO-13-001, WO-13-002, WO-13-003]
last_updated: '2026-06-30'
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

**Built (reopen cycle — gate correction applied):**

The gate finding was a pre-existing defect: `ApproveButton` originally rendered
`<button data-testid="approve-btn">` wrapping `<CopyButton>` (itself a `<button>`) — invalid HTML
nesting, React #418 hydration mismatch, a11y failure.

**Fix applied:** `ApproveButton` (`tab-summary.tsx` ~L390-404) now renders a `<div
data-testid="approve-btn">` (not a `<button>`) that contains:
- A `<span>` with the full command text (visible, copy-selectable, present in DOM so the AC command
  survives)
- A `CopyButton` (the single `<button>`) with `label="Aprobar la recomendación"` and `value=command`

This is a single interactive control — no nested buttons. DOM verified in a real browser
(`next start`, `/preview-wo04005`): `approve-btn` tag = `div`, `nested buttons = 1` (the
`CopyButton` itself), no `<button>` containing a `<button>`. No console errors, no pageerror.

**Reviewer tests (RED → GREEN):**
- `tab-summary.reviewer.test.tsx` — both tests GREEN: nested-button assertion passes, exact
  `/pandacorp:decide "Aprobado: …"` command present in DOM.

**Fidelity check (DR-072):** `/preview-wo04005` screenshot confirmed via Playwright (HTTP 200, no
console errors). Structure matches `projResumen()` / `decisionesBox()` / `logBox()` / `projDocs()`:
warn-bg decision cards, dotted activity rows, two-pane doc grid with group-labelled nav. No gross
structural divergence.

**Interfaces / contracts exposed (unchanged from prior cycle):**

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
- Both consumed by `src/app/projects/[slug]/page.tsx` → `resolveTabBody()` →
  `renderSummaryTab()` / `renderDocumentsTab()`. No page changes needed — prop contract stable.
- `renderSummaryTab()` passes `keyPoints={[]}` and `summary={status.project ?? slug}`.
- Selection for `TabDocuments` is URL-driven: `?doc=<id>` search param → caller resolves `selectedId`
  and `content` using `listProjectDocs` + `readDoc` from `lib/docs/tree.ts`.

**Implicit decisions and assumptions:**
- `pendingDecisions` is a pre-computed count passed by the caller (`decisions.filter(d => !d.resolved).length`).
- "Aprobar la recomendación" is copy-only: `<div data-testid="approve-btn">` wrapping a `CopyButton`
  with value `/pandacorp:decide "Aprobado: <recommendation>"`. The command text is also rendered as a
  visible `<span>` so it is present in the DOM for the AC assertion. Never writes or calls Claude.
- Resolved decisions render as neutral subdued rows (no warn-bg, no approve button).
- Activity entries are plain strings rendered as `ti-point-filled` dotted rows.
- `TabDocuments` empty state uses a plain `<div>`, not a `Panel`.
- Nav group ordering follows insertion order from `listProjectDocs()` (Product → Feature → Global).

**Test files:**
- `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.test.tsx` — FRD-04 AC tests (28 tests)
- `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.wo04005.test.tsx` — WO-04-005 re-paint tests (11 tests)
- `src/app/projects/[slug]/_components/tab-summary/_tests/tab-summary.reviewer.test.tsx` — gate reviewer tests (2 tests, now GREEN)
- `src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.test.tsx` — FRD-04 AC tests (13 tests)
- `src/app/projects/[slug]/_components/tab-documents/_tests/tab-documents.wo04005.test.tsx` — WO-04-005 re-paint tests (4 tests)
- Preview route: `src/app/preview-wo04005/page.tsx` (fidelity check only)

Full suite: 320 test files, 6968 tests passing (+ 2 expected failures). TypeCheck: clean. Biome: clean (1 info).

## Status Note — 2026-06-30 addendum: per-decision `/pandacorp:decide <id>` (owner request)

**Owner observation:** the Resumen tab told the owner to run `/pandacorp:decide` but gave no way to
tell `/pandacorp:decide` WHICH pending decision to act on — invoking it cold walks every pending
decision one by one (confirmed against the skill's own SKILL.md). With several decisions open at
once this felt like "a giant list" instead of acting on the one card the owner was reading.

**Fix:** every decision card now shows its stable `DecisionPoint.id` (WO-04-001 derives it —
`<date>-<n>` / `legacy-<n>`) right next to the title (`data-testid="decision-id"`, both the pending
warn-card and the resolved subdued row), and embeds it in BOTH copy commands:
- The bare command (no recommendation): `CmdRow command={`/pandacorp:decide ${dp.id}`}`.
- `ApproveButton` (with recommendation): `/pandacorp:decide ${id} "Aprobado: ${recommendation}"`.
The section subtitle copy was updated to say "cada tarjeta trae su propio comando" instead of the
generic, un-scoped one. New style `DECISION_ID_STYLE` (small muted monospace label, reuses the
existing muted-text token — no new color).

**Counterpart (plugin, separate commit):** `/pandacorp:decide`'s SKILL.md taught the SAME id
derivation + a leading-id-token scoping rule, so an id copied from Mission Control resolves to
the exact same block when pasted into the skill. See `plugin/docs/decision-log.md`.

**New tests:** 1 new case directly asserting the bare-command id (`frd-04-gate-opus.reviewer.test.tsx`);
existing exact-command assertions (the EXACT `/pandacorp:decide "Aprobado: …"` regression tests in
`frd-04-gate-opus.reviewer.test.tsx` and `tab-summary.reviewer.test.tsx`) updated to the new
`/pandacorp:decide <id> "Aprobado: …"` form — same mutation-killing rigor, new contract.

**verify.sh at this addendum:** GREEN — 382 files, 7340 tests pass (2 expected-fail unrelated), 66/66
e2e, tsc/biome clean.

## Status Note — 2026-06-30 second addendum: approve one-click removed, age hint + Obsoleta tag added

**Owner feedback:** "esa parte de abajo de aprobar recomendación hay que quitarlo" — the owner found
the one-click "Aprobar la recomendación" confusing/risky: it let them pre-approve an AI suggestion
without the context a real `/pandacorp:decide <id>` conversation provides. Removed entirely:
`ApproveButton` component, its styles (`APPROVE_BTN_STYLE`/`APPROVE_COMMAND_STYLE`), and the
now-unused `CopyButton` import. The recommendation TEXT still renders as context above the action
block — only the one-click copy command is gone.

**Added (same owner request — obsolescence handling):**
- **Age hint** (`decisionAgeLabel`, "hoy" / "hace N días") next to a pending card's id, derived from
  `DecisionPoint.date` (WO-04-001). `null` for a legacy decision (no date) → no hint rendered, never
  a fabricated age.
- **"Obsoleta" tag** (`data-testid="decision-obsolete-tag"`) on a resolved-row card whose `status`
  is `"obsolete"` — visually distinct from a genuinely answered decision, same muted-row treatment.

**Counterpart (plugin, separate commit):** `/pandacorp:decide`'s SKILL.md taught a 7-day staleness
check (flags an old decision and asks if it still applies BEFORE asking for an answer) + how to
record `OBSOLETO`. See `plugin/docs/decision-log.md` (v9.37.0).

**New tests:** `tab-summary.wo04005.test.tsx`'s approve-button describe block REPLACED (the feature
no longer exists) with assertions that no `approve-btn` exists anywhere and the recommendation
renders as plain text; `frd-04-gate-opus.reviewer.test.tsx` and `tab-summary.reviewer.test.tsx`
updated the same way (the React #418 nested-button regression test is generalized — kept as a
standing guard on the decision card, since the specific nesting it caught is now structurally
impossible); 3 new age-hint tests (today, N-days-ago via a relative-date helper so the test is
deterministic regardless of when it runs, legacy-no-date) + 1 Obsoleta-tag test.

**verify.sh at this addendum:** GREEN — 383 files, 7360 tests pass (2 expected-fail unrelated),
66/66 e2e, tsc/biome clean.
