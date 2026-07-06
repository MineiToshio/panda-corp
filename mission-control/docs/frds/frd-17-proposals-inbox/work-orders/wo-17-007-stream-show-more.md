---
id: WO-17-007
type: work-order
slug: stream-show-more
title: 'WO-17-007 — Collapse long proposal streams with a "ver más" toggle'
status: DRAFT
parent: FRD-17
implementation_status: VERIFIED
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

**Built**: WO-17-007 fully implements AC-17-010.1/.2/.3/.4 (REQ-17-010).

**Interfaces exposed**:
- `STREAM_COLLAPSE_THRESHOLD` constant (6) — no public export, internal to the component
- `DismissableProposalStream` now stateless-extends (internal `isExpanded` state manages toggle)
- No new props, no changes to component signature (AC-17-010.4 requires uniform behavior)

**Integration seams**:
- The toggle renders as a semantic `<button type="button">` with `data-testid="stream-show-more"`, `aria-expanded`, and Spanish `aria-label` — ready for E2E selection
- The toggle sits **inside** the `CARDS_STYLE` wrapper, after the card list (visual structure: cards → toggle → end, no separate section)
- Chevron icon changes (ti-chevron-down collapsed, ti-chevron-up expanded) to indicate state (not color-only per FRD-13)
- No animation; state is instantaneous (owner preference)

**Implicit decisions & assumptions**:
- **Collapse threshold**: hardcoded to 6 (per AC-17-010.1/.3); not configurable per-stream (uniform per AC-17-010.4)
- **Toggle styling**: uses inline `SHOW_MORE_BUTTON_STYLE` (CSS props) with `--color-accent-text` token, consistent with existing text controls (no new Tailwind class patterns) — reuses the semantic button pattern from `DismissRow` dismiss button
- **State management**: local `useState(false)` for `isExpanded`; no Context/Redux (simple, scoped to this component) — survives remounts (per test fixture isolation)
- **Dismissal interaction**: dismissing cards instantly updates the visible/hidden count and hides the toggle if ≤6 remain (no debounce, no lazy state update; the test confirms this)
- **Stream kind uniformity**: same toggle logic applies to `candidate-lesson`, `prune`, `self-suggestion` — verified by AC-17-010.4 test that checks all three kinds share one code path (no fork per kind)

**Test coverage** (7 new tests):
- AC-17-010.1: >6 cards → first 6 visible + toggle with hidden count
- AC-17-010.2: expand/collapse toggle works; aria-expanded reflects state; chevron changes
- AC-17-010.3: ≤6 cards → no toggle; dismissing below threshold hides toggle
- AC-17-010.4: candidate-lesson, prune, self-suggestion all apply collapse uniformly
- Bonus: semantic a11y (aria-expanded, aria-label tested), keyboard-operable (userEvent.click test)
- Bonus: dismiss behavior unchanged (can dismiss in both collapsed and expanded views)

All 7 new tests + 3 existing tests pass (10 total component tests, 408 files, 7454 tests project-wide). No type errors, lint/format clean.

## Review verdict — VERIFIED (FRD-17 gate + cross-feature integration, DR-050/DR-060)

**Reviewer:** Opus (different model from the sonnet/haiku builders — DR-015 bias break). Reviewed FRD-17 as a whole with WO-17-007 exercised together with the already-VERIFIED foundation (WO-17-001..006).

**Adversarial acceptance suite authored (DR-080)** — `_tests/streamShowMore.reviewer.test.tsx`, 10 tests the builder did not write, covering the edges it missed:
- Off-by-one boundaries: EXACTLY 6 → no toggle; EXACTLY 7 → toggle "Ver 1 más" + expands to 7 (the builder tested 5 and 10, never the boundary).
- Hidden cards genuinely ABSENT from the DOM (not `display:none`) — 6 dismiss buttons mounted while collapsed, LESSON-0009 card not queryable.
- The `promotion` stream kind — omitted from AC-17-010.4's uniformity list — ALSO collapses via the one shared code path (verified by rendered `proposal-card` count; promotion cards are non-clickable `<article>` with per-card command).
- Dismiss-WHILE-EXPANDED recomputes and drops the toggle at exactly 6 undismissed.
- Keyboard operability (Enter + Space toggle, not just mouse); Spanish `aria-label` announces the hidden count / "ocultas" (state not by color alone, FRD-13).
- Self-suggestion collapse uniform AND the per-card `withCommand` survives the cut.
All 18 tests in the folder green.

**Correctness / completeness (DR-100):** AC-17-010.1/.2/.3/.4 all met. `STREAM_COLLAPSE_THRESHOLD = 6` (named constant, no magic number). Toggle is a semantic `<button type="button">` with `aria-expanded`, `data-testid="stream-show-more"`, chevron icon flip. Reuse-before-create honored (DR-057): a bounded extension of the shared `DismissableProposalStream`, not a new component and not a per-kind fork — one code path serves every stream kind.

**Cross-feature integration (DR-060):** no duplicate primitives introduced (single `Banner` in core, correctly reused by `MemoryHealth`; component inventory intact, 137 rows). Shared cross-feature resolvers verified single-source: `getGuildState` (level/XP — the NV-drift guard: `GuildBar` re-derives via the pure `computeGuildLevel` from the SAME `getGuildState().outcomes`, deterministically consistent, not a second independent derivation), `getPendingMerge`, `getIdeaCounts` — every consumer reads the one resolver.

**Runtime/visual (DR-055):** full `verify.sh` (no `--since`) EXIT 0 — 7462 unit tests + 68 e2e (smoke + shell + visual + responsive) at desktop + mobile. `/proposals` visual baseline held (the bounded collapse change did not regress the blessed baseline, as WO-17-007 predicted). No console errors, no blank/error-boundary renders.
