# ADR-0003 — A third write: the visual favourite flag

- **Status:** Accepted
- **Date:** 2026-06-28
- **Scope:** Platform-level (cross-feature), Mission Control
- **Decided by:** owner request ("marcar ideas como favoritas en el tablero, solo visual"), implemented
  directly with TDD + this ADR. Extends ADR-0001's single-write profile and ADR-0002's two-write set.

## Context

ADR-0001 established Mission Control as read-only with a single write; ADR-0002 widened that to a
**bounded set of two** status writes in `lib/discard/` (`discardIdea` + `restoreIdea`). The owner then
asked to **mark ideas/projects as favourites** on the board — a purely visual highlight so the cards
they care about stand out, in **any** column. It must change nothing about the pipeline: not the card
`status`, not its derived column, not any flow.

Persisting "favourite" is, by nature, a mutation (the flag has to survive reloads and be visible to the
board reader). The card `.md` frontmatter is the natural home — it already backs every board card in
every column, and the discard/restore writes already prove the safe single-field-rewrite pattern there.

## Decision

Mission Control now has a **bounded set of writes across two folders**, all human-triggered Server
Actions, each touching exactly one field of one idea card and preserving the body + all other
frontmatter verbatim:

1. `lib/discard/discard.ts` — `status → discarded` (+ `status_before_discard`, `discard_reason`).
2. `lib/discard/restore.ts` — the inverse: `status ← status_before_discard` (fallback `discovered`).
3. **`lib/favorite/favorite.ts` — `setFavorite(slug, favorite)`**: writes `favorite: true` when marked,
   **removes** the field when unmarked. It never reads or writes `status`.

The read-only invariant is re-stated as: **all writes are isolated to `lib/discard/` + `lib/favorite/`,
are human-triggered Server Actions, and each only ever sets one bounded field of one card** (status +
discard bookkeeping, or the visual `favorite` flag). No other module writes; no Claude/AI client; no
network egress.

The favourite is **orthogonal to the pipeline**: `readIdeas` exposes it as `favorite?: boolean`, the
`IdeaCard` tints gold (the `--color-warn` token) and the `FavoriteButton` star toggles it; the two-axis
column derivation ignores it entirely.

## Consequences

- **+** The owner can highlight the cards/projects that matter, in any column, without touching the
  flow — a low-risk, high-value visual affordance.
- **+** The invariant stays auditable (three named functions in two folders, all single-field rewrites);
  the favourite shares the exact write discipline (path-traversal/symlink/trailing-newline guards,
  body preserved) proven by discard/restore.
- **−** ADR-0002's "exactly two writes" wording is superseded here and in `architecture.md` §6/§7
  (updated). The invariant is now "a small bounded set", not a fixed count — acceptable, since each
  write is still named, isolated and single-field.
- **Tests:** `lib/favorite/_tests/favorite.test.ts` asserts the write touches only `favorite`, never
  `status`, preserving everything else (mark/unmark round-trip, idempotence, guards). UI:
  `FavoriteButton` (optimistic toggle) + `IdeaCard` (gold highlight / a11y label) + `ideas` (parse).

## Alternatives considered

- *A client-only / localStorage favourite* — rejected: it wouldn't persist across machines or be
  visible to the (server-side) board reader, and the owner wanted it pinned to the idea itself.
- *Write `favorite: false` when unmarking* — rejected: removing the key keeps non-favourite cards
  byte-clean (same discipline as the optional `discard_reason`), so the data stays tidy.
- *A new board column / status for favourites* — rejected: favourite is a cross-cutting highlight, not
  a lifecycle stage; conflating it with `status` would corrupt the single-source-of-truth column model.
