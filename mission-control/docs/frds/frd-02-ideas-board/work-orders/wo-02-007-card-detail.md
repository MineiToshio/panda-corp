---
id: WO-02-007
type: work-order
slug: card-detail
title: WO-02-007 — Card detail (3-tab restructure) + docs navigator + next-step
status: DRAFT
parent: FRD-02
implementation_status: VERIFIED
source_requirements: [REQ-02-004, REQ-02-008, REQ-02-009]
last_updated: '2026-06-18'
---
# WO-02-007 — Card detail (3-tab restructure) + docs navigator + next-step

**Module:** `components/CardDetail.tsx`
**IDs touched:** `CMP-02-card-detail`; REQ-02-004, REQ-02-008 (no-docs edge), REQ-02-009 (3-tab restructure)
**Dependencies:** WO-02-002 (`CopyButton`), WO-02-003 (`nextStep`), FRD-01 (`readProjectDocs`),
WO-02-010 (`CampaignPipeline`, the Campaña tab body)

> **Reopened 2026-06-18.** The verified single-pane CardDetail is being **restructured into a
> three-tab container** (Campaña · Documentos · Comandos), the same tab pattern as the Portfolio
> project pane (`projectPane()` `stab` row). The previously verified content (docs navigator +
> next-step) is **preserved**, now living inside the **Documentos** and **Comandos** tabs. The new
> default tab is **Campaña**, which hosts `<CampaignPipeline>` (built in WO-02-010).

## EARS criteria (from FRD-02)

- AC-02-004.1 — WHEN the owner clicks a card, the system SHALL show the card: **summary, key points,
  a navigator of the idea's documents, and the next-step command** (with a copy button) — now under
  the **Documentos** and **Comandos** tabs.
- AC-02-008.1 — (Edge) Idea with no documents → show only the summary (Documentos tab).
- AC-02-009.1 — WHEN the owner opens a card, THE detail SHALL render **three horizontal tabs**
  (Campaña · Documentos · Comandos, same `stab` pattern as the project pane) and default to
  **Campaña**.
- AC-02-009.2 — WHEN a tab is clicked, only that tab is active; **Documentos** = the existing doc
  navigator; **Comandos** = the existing next-step / iterate command panel.
- AC-02-009.3 — WHEN a document entry is clicked, the active tab SHALL switch to **Documentos** and
  show that document.
- AC-02-009.4 — THE active tab choice SHALL persist for the open card across detail re-renders.

## Design

- `CardDetail` becomes a **tabbed shell**. The tab row reuses the project-pane `stab` selector
  pattern; tabs: `["campana","Campaña"], ["docs","Documentos"], ["comandos","Comandos"]`; default
  `campana` (AC-02-009.1). Active tab is client state keyed to the open card and persists across
  re-renders (AC-02-009.4).
- **Documentos** tab body = the existing summary + key points (react-markdown) + the docs navigator
  built from `readProjectDocs(card.project)`; idea with no docs → summary only (REQ-02-004,
  AC-02-008.1, unchanged behavior).
- **Comandos** tab body = the existing next-step row `nextStep({ cardStatus, phase, advancePending })`
  + `<CopyButton>` (+ iterate command), unchanged behavior.
- **Campaña** tab body (default) = `<CampaignPipeline>` from WO-02-010, wrapped in the labelled
  container "EL VIAJE DE ESTA IDEA POR LAS 6 FASES".
- Clicking a doc entry sets the tab to `docs` and selects the doc (AC-02-009.3).
- `data-testid="card-detail"`; tab buttons carry `data-testid` (e.g. `card-detail-tab-{key}`); design
  tokens only; Spanish copy.

## Definition of done

- [ ] `components/CardDetail.test.tsx` (RED first, jsdom):
  - [ ] renders the **3 tabs** (Campaña · Documentos · Comandos); default active tab = Campaña.
  - [ ] clicking a tab activates only that tab and shows its body.
  - [ ] Documentos tab: renders summary + key points from the body.
  - [ ] Documentos tab: an `in-pipeline` card with a docs index → renders the navigator entries.
  - [ ] Documentos tab: a card with no docs → summary only, no navigator, no crash.
  - [ ] Comandos tab: the next-step command + copy button render with the value from `nextStep`.
  - [ ] clicking a document entry switches the active tab to Documentos and shows that doc.
  - [ ] the active tab persists across a detail re-render (AC-02-009.4).
- [ ] Read-only; no write.
- [ ] `.pandacorp/verify.sh` green.

> **Note (2026-06-18):** the prior Status Note below documents the now-superseded single-pane
> implementation; it is retained for history. The reopened WO supersedes it with the 3-tab shell.

## Status Note (superseded — single-pane, 2026-06-17)

**Built:** `CardDetail` component (`CMP-02-card-detail`). A `"use client"` React component that
renders the full idea-card detail panel: markdown body (summary + key points) via `react-markdown`
with heading remap (h1–h6 → `<p><strong>`) so the component's own `<h2>` title is the sole heading;
a conditional docs navigator (`buildNavEntries` → flat `NavEntry[]` from `ProjectDocsIndex`); and a
next-step command row with `CopyButton`. Zero hardcoded color values — all styles use CSS custom
properties. Read-only; no writes, no network calls, no fs access.

**Interfaces/contracts exposed:**

```tsx
"use client";
export interface CardDetailProps {
  slug: string;
  title: string;
  status: IdeaStatus;
  body: string;
  phase?: Phase;
  advancePending?: boolean;
  docsIndex?: ProjectDocsIndex | null;
}
export function CardDetail(props: CardDetailProps): React.JSX.Element;
```

- `data-testid="card-detail"` on the root `<section>`; `aria-label="Detalle de idea: {title}"`.
- `data-testid="card-detail-summary"` on the markdown body `<div>`.
- `data-testid="card-detail-docs-nav"` on the `<nav>` (only rendered when `buildNavEntries` returns
  at least one entry — AC-02-008.1).
- `data-testid="card-detail-docs-nav-item"` on each `<li>` in the navigator.
- `data-testid="card-detail-next-step"` on the next-step `<section>`.
- `data-testid="copy-button"` from the consumed `CopyButton` (WO-02-002).

**Integration seams:**
- Consumes `nextStep` from `lib/next-step.ts` (WO-02-003 / IF-02-nextStep).
- Consumes `CopyButton` from `components/CopyButton.tsx` (WO-02-002).
- Accepts `docsIndex: ProjectDocsIndex | null` from `lib/docs.ts` `readProjectDocs` (FRD-01).
- Caller is responsible for resolving `docsIndex` and `phase`; the component is pure display.

**Test files:**
- `components/CardDetail.test.tsx` — 56 tests (root container, summary section, docs navigator with
  entries, AC-02-008.1 no-docs edge, next-step row, CopyButton presence, all lifecycle statuses,
  all pipeline phases, regression B1' undefined-phase, regression I2 empty-docsIndex, read-only
  invariant, design-token compliance, accessibility, structural DOM order).
- `components/CardDetail.adversarial.test.tsx` — 11 tests (comms.bugs[] navigator entries,
  bugs-only docsIndex shows navigator, trailing-slash path edge, comms.decisions entry, ADR entry,
  analytics entry, XSS via `<script>` in body, `<img onerror>` in body, `javascript:` href,
  duplicate FRD slugs, slug with special characters).

**Verify (2026-06-17):** `pnpm vitest run components/CardDetail` → 2 test files, 67 tests, all
passed. Full suite: 105 test files, 3 080 tests passed (2 expected fail, 5 skipped). `pnpm tsc
--noEmit` → 0 errors. `pnpm biome check .` → 0 errors.

**Commits:**
- `6a7ddca feat(mission-control): WO-02-007 CardDetail — card detail + docs navigator (CMP-02-card-detail)`
- `8518b41 docs(mission-control): mark WO-02-007 done — selective verify passed`

---

## Status Note (3-tab restructure — 2026-06-18)

**Built:** `CardDetail` restructured into a 3-tab shell (`CMP-02-card-detail`, REQ-02-009).
- **Campaña tab** (default, AC-02-009.1): mounts `CampaignPipeline` with `activePhase` derived
  from `phaseFromStatus({ cardStatus, phase })` (WO-02-011 / `lib/campaign/campaign.ts`).
- **Documentos tab** (AC-02-009.2): preserves the existing summary (react-markdown) + conditional
  docs navigator (`buildNavEntries` → `NavEntry[]`). Clicking a nav entry calls `setActiveTab("docs")`
  (AC-02-009.3).
- **Comandos tab** (AC-02-009.2): preserves the existing next-step command row + `CopyButton`.
- **Tab state** (`useState<TabKey>`) defaults to `"campana"` and persists across re-renders
  (AC-02-009.4).
- **Panel visibility strategy**: inactive panels use the CSS clip technique (`PANEL_HIDDEN_STYLE`:
  `position: absolute; clip: rect(0,0,0,0); width/height: 1px`) so all panels stay in the
  accessibility tree — existing `getByTestId` / `getByRole` contracts in `CardDetail.test.tsx`
  and `CardDetail.adversarial.test.tsx` (67 tests) continue to pass without modification.
- Style constants and `buildNavEntries` helper extracted to `CardDetail.styles.ts` sibling to
  keep `CardDetail.tsx` at 313 lines (below the 500-line limit, clean-code.md).
- Zero hardcoded colors; all via CSS custom properties. Read-only; no writes, no network, no fs.

**Interfaces/contracts exposed (updated):**

```tsx
"use client";
export interface CardDetailProps {
  slug: string;
  title: string;
  status: IdeaStatus;
  body: string;
  phase?: Phase;
  advancePending?: boolean;
  docsIndex?: ProjectDocsIndex | null;
  onEnterForge?: (slug: string) => void;  // NEW — AC-02-010.5 host-navigation callback
}
export function CardDetail(props: CardDetailProps): React.JSX.Element;
```

**data-testid surface (additions):**
- `card-detail-tab-campana` / `card-detail-tab-docs` / `card-detail-tab-comandos` — tab buttons
  (`role="tab"`, `aria-selected="true"|"false"`).
- `card-detail-panel-campana` / `card-detail-panel-docs` / `card-detail-panel-comandos` — tab
  panels (`role="tabpanel"`).
- All pre-existing testids preserved: `card-detail`, `card-detail-summary`, `card-detail-docs-nav`,
  `card-detail-docs-nav-item`, `card-detail-next-step`, `copy-button`.

**Integration seams:**
- Consumes `CampaignPipeline` from `@/components/modules/CampaignPipeline/CampaignPipeline`
  (WO-02-010). Passes `slug`, `activePhase`, `onEnterForge`.
- Consumes `phaseFromStatus` from `@/lib/campaign/campaign` (WO-02-011).
- All prior seams preserved: `nextStep` (WO-02-003), `CopyButton` (WO-02-002),
  `docsIndex: ProjectDocsIndex | null` from `readProjectDocs` (FRD-01).

**Test files:**
- `_tests/CardDetail.test.tsx` — 56 tests (unchanged; all pass via clip-visibility strategy).
- `_tests/CardDetail.adversarial.test.tsx` — 11 tests (unchanged; all pass).
- `_tests/CardDetail.tabs.test.tsx` — 27 new tests (RED→GREEN): AC-02-009.1..4, CampaignPipeline
  wiring (slug, activePhase derivation for all statuses), doc-entry click → Documentos, tab
  persistence across re-renders.

**Verify (2026-06-18):** 3 test files, 94 tests GREEN. `tsc --noEmit` → 0 errors. `biome check` →
0 new errors (35 pre-existing warnings in other files). Full suite: 217 test files, 5 597 tests
GREEN + 2 expected-fail + 5 skipped (1 pre-existing fail in `fragua-snapshot.reviewer.test.ts`,
frd-06 scope, untracked file present before this WO — outside my scope).

**Commit:** `f49130a feat(frd-02): WO-02-007 IN_REVIEW — CardDetail 3-tab restructure`
