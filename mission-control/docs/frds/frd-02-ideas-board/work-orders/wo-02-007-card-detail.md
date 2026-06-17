---
id: WO-02-007
type: work-order
slug: card-detail
title: WO-02-007 — Card detail + docs navigator + next-step
status: DRAFT
parent: FRD-02
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-02-007 — Card detail + docs navigator + next-step

**Module:** `components/CardDetail.tsx`
**IDs touched:** `CMP-02-card-detail`; REQ-02-004, REQ-02-008 (no-docs edge)
**Dependencies:** WO-02-002 (`CopyButton`), WO-02-003 (`nextStep`), FRD-01 (`readProjectDocs`)

## EARS criteria (from FRD-02)

- AC-02-004.1 — WHEN the owner clicks a card, the system SHALL show the card: **summary, key points,
  a navigator of the idea's documents, and the next-step command** (with a copy button).
- AC-02-008.1 — (Edge) Idea with no documents → show only the summary.

## Design

- Renders the card body (summary + key points) via react-markdown. If the idea is `in-pipeline`
  (has a `project`), use `readProjectDocs(card.project)` to render a **documents navigator** (links
  to the discovered docs). Idea with no docs → summary only.
- Next-step row: `nextStep({ cardStatus, phase, advancePending })` → command + `<CopyButton>`.
- `data-testid="card-detail"`; design tokens only; Spanish copy.

## Definition of done

- [x] `components/CardDetail.test.tsx` (RED first, jsdom):
  - [x] renders summary + key points from the body.
  - [x] an `in-pipeline` card with a docs index → renders the navigator entries.
  - [x] a card with no docs → summary only, no navigator, no crash.
  - [x] the next-step command + copy button render with the value from `nextStep`.
- [x] Read-only; no write.
- [x] `.pandacorp/verify.sh` green.

## Status Note

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
