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

- `components/CardDetail.test.tsx` (RED first, jsdom):
  - renders summary + key points from the body.
  - an `in-pipeline` card with a docs index → renders the navigator entries.
  - a card with no docs → summary only, no navigator, no crash.
  - the next-step command + copy button render with the value from `nextStep`.
- Read-only; no write.
- `.pandacorp/verify.sh` green.
