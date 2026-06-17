---
id: WO-02-009
type: work-order
slug: discard-action
title: WO-02-009 — Discard action (Server Action + button)
status: DRAFT
parent: FRD-02
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
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
