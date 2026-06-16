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
