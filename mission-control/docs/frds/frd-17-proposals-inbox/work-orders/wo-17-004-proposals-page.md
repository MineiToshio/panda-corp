---
id: WO-17-004
type: work-order
slug: proposals-page
title: WO-17-004 — `app/proposals` page + 4 streams + proposal card
status: DRAFT
parent: FRD-17
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-17-004 — `app/proposals` page + 4 streams + proposal card

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-17-page`, `CMP-17-stream`, `CMP-17-proposalcard`) · [architecture §7, §11](../../../product/architecture.md).

## Goal
The `app/proposals` page rendering the four proposal streams, each row a proposal card with
evidence + the exact copyable command. Read-only, guild *crónica* theme.

## Scope
- `app/proposals/page.tsx` (Server Component): read `IF-17-memory` + `IF-17-suggest`; render the four
  streams (candidate lessons, promotions, prune, self-suggestions).
- `CMP-17-stream` per kind; `CMP-17-proposalcard` per proposal (evidence/source + suggested action +
  `CopyButton` command). Candidate lessons rendered visually distinct from `active`, with the
  eval-gate badge (`corroborated` / `awaiting 2nd`).

## Acceptance criteria
- **AC-17-004.1** (REQ-17-002) The page renders all four streams; each stream lists its proposals.
- **AC-17-004.2** (REQ-17-003) Each proposal card shows its evidence/source, the suggested action, and
  the exact `/pandacorp:*` command via a copy button; no card has an action that runs the command.
- **AC-17-004.3** (REQ-17-007) Candidate lessons are visually distinct from active, and each shows the
  eval-gate state.
- **AC-17-004.4** (REQ-17-009) High-risk proposals (promote-to-MUST, create/edit skill/agent, change a
  DR, delete) are display-only — the only affordance is copy + navigate.
- **AC-17-004.5** Empty state (no proposals) → an *al día* / calm guild message, never a blank or fake urgency.
- **AC-17-004.6** Spanish copy + a11y (FRD-13); state not by color alone.

## TDD
Component/render tests (`@testing-library/react`) feeding fixture `IF-17-memory`/`IF-17-suggest`
outputs; assert streams, card contents, copy, eval-gate badge, empty state.

## Definition of done
- ACs RED → GREEN; read-only; calm empty state; Spanish. `.pandacorp/verify.sh` green.

## Dependencies
- WO-17-002, WO-17-003; FRD-02 `CopyButton`.

## Status Note

**Built:** `app/proposals` page (CMP-17-page) + four proposal streams (CMP-17-stream) + per-proposal card (CMP-17-proposalcard). Commit `9cf4dea`.

**Interfaces/contracts exposed:**

```tsx
// ProposalCard — CMP-17-proposalcard
// src/app/proposals/_components/ProposalCard/ProposalCard.tsx
export type ProposalCardProps =
  | { kind: "candidate-lesson"; lesson: Lesson }
  | { kind: "promotion"; lesson: Lesson }
  | { kind: "prune"; lesson: Lesson }
  | { kind: "self-suggestion"; suggestion: Suggestion };
export function ProposalCard(props: ProposalCardProps): React.JSX.Element;

// ProposalStream — CMP-17-stream
// src/app/proposals/_components/ProposalStream/ProposalStream.tsx
export type ProposalStreamProps =
  | { kind: "candidate-lesson"; lessons: Lesson[] }
  | { kind: "promotion"; lessons: Lesson[] }
  | { kind: "prune"; lessons: Lesson[] }
  | { kind: "self-suggestion"; suggestions: Suggestion[] };
export function ProposalStream(props: ProposalStreamProps): React.JSX.Element;

// Page — CMP-17-page (Server Component, NO "use server" directive)
// src/app/proposals/page.tsx
export default function ProposalsPage(): React.JSX.Element;
// Reads: candidateLessons(), promotionQueue(), prunable() from lib/memory/memory
// Reads: computeSuggestions() from lib/self-suggest/self-suggest
```

**data-testid anchors:**
- `proposals-page` — page `<main>` root
- `proposal-stream-{kind}` — each of the four streams (candidate-lesson, promotion, prune, self-suggestion)
- `proposal-card` — each proposal card (with `data-kind` and optionally `data-severity`)
- `proposal-card-source` — evidence/source field
- `proposal-card-action` — suggested action text
- `proposal-card-command` — the exact command code element
- `proposal-eval-gate-badge` — eval-gate badge on candidate-lesson cards (with `data-eval-gate`)
- `proposal-stream-empty` — empty state message per stream
- `copy-button` — CopyButton (one per card, from FRD-02)

**Integration seams:**
- Consumes `IF-17-memory` (WO-17-001/002): `candidateLessons()`, `promotionQueue()`, `prunable()` from `@/lib/memory/memory`
- Consumes `IF-17-suggest` (WO-17-003): `computeSuggestions()` from `@/lib/self-suggest/self-suggest`
- Reuses `CopyButton` from `@/components/core/CopyButton/CopyButton`
- The page passes minimal `SuggestionsInput` (empty board/portfolio/events); future wiring can be added when those readers stabilize

**Test files:**
- `src/app/proposals/_components/ProposalCard/_tests/ProposalCard.test.tsx` (32 tests — all ACs)
- `src/app/proposals/_components/ProposalStream/_tests/ProposalStream.test.tsx` (11 tests — all kinds + empty states)
- `src/app/proposals/_tests/proposals-page.test.tsx` (12 integration tests — four streams + empty + eval-gate + display-only + a11y)

**Gate:** 43/43 own tests GREEN. 5413/5413 full suite GREEN. tsc clean. biome clean on scope (7 pre-existing complexity errors in other modules, not introduced by this WO).
