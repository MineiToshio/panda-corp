# ADR-0002 — A second write: restoring (un-discarding) an idea

- **Status:** Accepted
- **Date:** 2026-06-26
- **Scope:** Platform-level (cross-feature), Mission Control
- **Decided by:** owner request ("dale un botón de volverlo a agregar"), implemented directly with
  TDD + this ADR. Extends ADR-0001's single-write profile.

## Context

ADR-0001 established that Mission Control is read-only with **exactly one** write: `lib/discard.ts`
rewriting a card's `status: discarded` (FRD-02). The owner then asked, for discarded ideas, to be
able to **read their full documentation** and to **"volver a agregar"** (restore) them to the board —
returning a card to the status it had *before* being discarded.

Restore is, by nature, a mutation. So the "single write" invariant of ADR-0001 must become a
**bounded set of writes**, or restore would have to live outside the isolated write layer (worse).

## Decision

Mission Control now has **exactly two writes**, both in the **`lib/discard/` layer**, both
human-triggered, each touching only the **status (+ its discard bookkeeping)** of **one** card and
preserving the body + all other frontmatter verbatim:

1. `discardIdea` (`lib/discard/discard.ts`) — `status → discarded`; also records `status_before_discard`
   (the prior status, so restore is exact) and an optional `discard_reason`.
2. `restoreIdea` (`lib/discard/restore.ts`) — the inverse: `status ←` `status_before_discard`
   (fallback `discovered`); clears `status_before_discard` + `discard_reason`.

The read-only invariant is re-stated as: **all writes are isolated to `lib/discard/`, are
human-triggered Server Actions, and only ever set a card's status field (+ discard bookkeeping).**
No other module writes; no Claude/AI client; no network egress.

## Consequences

- **+** Discarding is reversible — a safer, owner-friendly lifecycle; pairs with the discard-reason
  capture so a discard both teaches discovery (the reason) and stays undoable.
- **+** The invariant stays auditable (two named functions in one folder), just no longer literally "one".
- **−** ADR-0001's "single write" wording is superseded here and in `architecture.md` §6/§7 (updated).
- **Tests:** `lib/discard/_tests/{discard,restore}.test.ts` assert each write touches only its card and
  only the status (+ bookkeeping), preserving everything else (mutation-killing round-trip).

## Alternatives considered

- *Keep "single write", put restore elsewhere* — rejected: scatters the mutation surface, weakening
  the very invariant ADR-0001 protects.
- *Restore always to `discovered`* — rejected by the owner: it must return to the **prior** status,
  hence `status_before_discard`.
