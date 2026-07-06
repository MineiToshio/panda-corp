---
id: WO-17-007
type: work-order
slug: stream-show-more
title: 'WO-17-007 — Collapse long proposal streams with a "ver más" toggle'
status: DRAFT
parent: FRD-17
implementation_status: PLANNED
reopen_count: 0
artifacts:
  - 'src/app/proposals/_components/DismissableProposalStream/**'
source_requirements: [AC-17-010.1, AC-17-010.2, AC-17-010.3, AC-17-010.4]
dependsOn: [WO-17-004]
last_updated: '2026-07-05'
---
# WO-17-007 — Collapse long proposal streams with a "ver más" toggle

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-17-stream`](../blueprint.md#3-components--interfaces).
Change: `.pandacorp/inbox/changes/mc-proposal-stream-show-more.md` (DR-069).

## Goal
Extend the **shared** `DismissableProposalStream` (`CMP-17-stream`, WO-17-004) so a long list does not
render all cards at once. By default the stream shows only the first **~6** undismissed cards; when
there are more, a **"ver más" toggle** at the end of the group expands the rest **in-place** (show/hide
over the already-loaded data — no pagination, no extra fetch, no new server round-trip). A "ver menos"
affordance collapses it back. With 35+ candidate lessons today the tab currently feels overwhelming on
entry; this makes any long stream calm to land on without losing access to the full list.

This is a **reuse-before-create (DR-057)** change: it is an **extension of the existing shared
`DismissableProposalStream`**, not a new component and not a per-stream fork. The collapse threshold +
toggle live in this single shared component so the behavior applies uniformly to every stream that uses
it (candidate-lesson, prune, self-suggestion today; also promotions/backlog if those grow). Do NOT
duplicate the cut per stream kind.

## Scope
- **Only** `src/app/proposals/_components/DismissableProposalStream/DismissableProposalStream.tsx`
  (and its `_tests/`). No new component, no change to `ProposalCard`, `SectionHead`, `CmdRow`, the
  dismiss store, or the page. The dismiss/detail/group-command logic is untouched — this only bounds how
  many of the (already filtered, undismissed) cards are visible before expansion.
- The threshold is a named constant (`STREAM_COLLAPSE_THRESHOLD = 6`) — no magic number.
- The "ver más" / "ver menos" toggle is a shared `core` primitive if one fits (reuse the existing
  `Button`/text-button pattern the stream already uses); do NOT invent a new button style. It counts the
  hidden remainder (e.g. "Ver 29 más"). State is a local `useState` boolean; no animation required
  (owner: keep the interaction simple — a button, no elaborate animation).
- Tokens only (DR-054/DR-062); state communicated by text + icon, not color alone (FRD-13). The toggle
  is a semantic `<button>` with `data-testid="stream-show-more"`, keyboard-operable, with an
  `aria-expanded` reflecting collapsed/expanded and a Spanish `aria-label`.

## Acceptance criteria (FRD-17 EARS / REQ-17-010)
- **AC-17-010.1** — WHEN a stream has **more than `STREAM_COLLAPSE_THRESHOLD` (6)** undismissed cards,
  it renders only the first 6 and a **"ver más"** toggle labelled with the hidden count; the remaining
  cards are NOT in the rendered list until expanded.
- **AC-17-010.2** — WHEN the owner activates the toggle, the rest of the **already-loaded** cards appear
  **in-place** (no fetch, no navigation, no page reload) and the toggle becomes **"ver menos"**;
  activating it again collapses back to the first 6.
- **AC-17-010.3** — WHEN a stream has **≤ 6** undismissed cards, **no toggle** is shown and every card
  renders (unchanged behavior). Dismissing cards is counted against the undismissed list, so dismissing
  below the threshold hides the toggle.
- **AC-17-010.4** — The collapse cut applies **uniformly to every stream kind** the shared component
  serves (candidate-lesson, prune, self-suggestion) — it is one code path in the shared component, not a
  per-kind fork. Existing dismiss / detail-modal / group-level-command behavior is unchanged. Spanish
  copy + a11y (semantic button, `aria-expanded`, keyboard); state not by color alone.

## Dependencies
- **WO-17-004 (VERIFIED)** — the `DismissableProposalStream` component this WO extends.

## Visual reference
No new mock: this reuses the existing `propuestasView()` stream layout (WO-17-004 blessed baseline). The
toggle sits at the end of a group, styled like the stream's existing text controls — visually
consistent with the other groups (DR-062). The change is bounded (a collapse cut + one toggle button),
so the blessed `/proposals` baseline is expected to hold for streams ≤ 6; the reviewer blesses the
expanded/collapsed states at the FRD gate.

## Status Note

_(To be filled by the implementer when this WO moves to IN_REVIEW.)_
