---
id: WO-02-009
type: work-order
slug: discard-action
title: WO-02-009 — Discard action (Server Action + button)
status: DRAFT
parent: FRD-02
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-02-009 — Discard action (Server Action + button)

**Module:** `app/board/actions.ts`, `components/DiscardButton.tsx`
**IDs touched:** `CMP-02-discard-action`; REQ-02-007
**Dependencies:** WO-02-004 (`lib/discard.ts`)

## EARS criteria (from FRD-02)

- AC-02-007.1 — WHEN the owner presses "Discard idea", the system SHALL rewrite `status: discarded`
  in the `.md` frontmatter, preserving the rest of the file (the only write).

## Design

- `app/board/actions.ts`: a **Server Action** `discardIdeaAction(slug)` that calls
  `lib/discard.ts#discardIdea` and revalidates the board path. Human-triggered only; never runs
  during a render.
- `components/DiscardButton.tsx` (`"use client"`): "Descartar idea" button that calls the action
  with **optimistic UI** (move/strike the card, revert on `{ ok: false }` — AGENTS.md). Confirmation
  step before firing (destructive). `data-testid="discard-button"`; Spanish copy.
- This is the only mutation surface in the app; everything else stays read-only (architecture §7).

## Definition of done

- `app/board/actions.test.ts` (RED first): the action delegates to `discardIdea` with the slug and
  returns its `DiscardResult` (mock `lib/discard`); on `{ ok: false }` it does not throw.
- `components/DiscardButton.test.tsx` (jsdom): confirm → calls the action; on failure result it
  reverts the optimistic state. `data-testid` present.
- The only write path is via `lib/discard.ts`; the action adds no other write.
- `.pandacorp/verify.sh` green.

## Status Note

**Built:** `discardIdeaAction(slug)` Server Action in `app/board/actions.ts` + `DiscardButton` client component in `components/DiscardButton.tsx`.

**Interfaces / contracts exposed:**

- `discardIdeaAction(slug: string): Promise<DiscardResult>` — `"use server"` action that delegates to `discardIdea(slug)` from `lib/discard.ts`; calls `revalidatePath("/board")` only on `{ ok: true }`; never throws, always returns a typed `DiscardResult`.
- `DiscardButton({ slug: string, discardAction: (slug: string) => Promise<DiscardResult> }): React.JSX.Element` — `"use client"` component with a two-step confirmation flow (idle → confirming → pending → done/idle+error). Optimistic UI: transitions to "done" immediately; reverts to "idle" with an error message on `{ ok: false }`. `data-testid` surface: `discard-button`, `discard-confirm-button`, `discard-cancel-button`, `discard-done`, `discard-error`.

**Integration seams:**

- Production usage: `<DiscardButton slug={idea.slug} discardAction={discardIdeaAction} />` in the card detail or board card (consumer's responsibility to wire the action prop).
- The action receives its `discardAction` prop — no module mock needed in tests; pass `vi.fn()` directly.
- `revalidatePath("/board")` is the only Next.js cache side-effect; board re-fetches on discard success.

**Test coverage:**

- `app/board/actions.test.ts` — 11 tests: delegation to `discardIdea`, revalidation on success, no revalidation on failure, no-throw on `{ ok: false }`, write-isolation assertion.
- `components/DiscardButton.test.tsx` — 17 tests: rendering, `data-testid` presence, Spanish copy, confirmation step (show/cancel/no-action), confirm calls action with slug, success → done state, failure → revert to idle + error message, pending disables confirm button, accessibility (aria-label, tag).

**verify.sh:** green — 3080 passed, 2 expected-fail, 5 skipped. biome clean, tsc clean.
