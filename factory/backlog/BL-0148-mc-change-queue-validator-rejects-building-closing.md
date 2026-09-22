---
id: BL-0148
type: bug
area: build-engine
title: "Mission Control's change-queue reader rejects the factory's own building/closing statuses, so those cards render as parse errors in the queue panel"
status: done
severity: p1
opened: 2026-09-22
closed: 2026-09-22
source: "independent review batch 3, 2026-09-22 — cross-referenced against plugin/skills/change/SKILL.md's own status vocabulary"
closes: "mission-control commit 98b9b91f (merge of mc-change-queue-statuses, 19ae06d7) — changes.ts ChangeQueueStatus/VALID_STATUSES + ChangesPanel/ChangeDetail exhaustive handling + mission-control/docs/decision-log.md entry"
links: []
---

## Problem
`mission-control/src/lib/changes/changes.ts:28` types `ChangeQueueStatus` as
`"ready" | "draft" | "done" | "discarded"`, and line 60's `VALID_STATUSES` runtime array repeats
the same four values. But the factory's own change-queue vocabulary
(`plugin/skills/change/SKILL.md` step 4, `references/now-mode.md`) has the CLOSER write two MORE
statuses onto a card mid-flight: `building` (engine-only — the change is in flight, its FRDs are
being built) and `closing` (written by `/pandacorp:sync --close-out` the instant a close-out
starts, with `implemented_sha` + `closing_at`, so an interrupted close-out stays visible instead of
vanishing). Both are real, expected, factory-written states — not malformed input.

Because `changes.ts`'s fail-loud reader (DR-078) treats anything outside `VALID_STATUSES` as
unparseable, a card sitting in `building` or `closing` is NOT rendered as a normal queue item —
it is surfaced in `errors[]` and the Mission Control queue panel shows it as a **parse error**,
even though the card is perfectly well-formed and the factory's own tooling wrote it exactly as
designed. The reader's contract (know the vocabulary it reads) has drifted behind the writer's
(the change skill + `sync --close-out`) own vocabulary.

Impact: the owner sees false-positive parse errors in Mission Control's queue panel for any change
currently mid-build or mid-close-out — exactly the two states DR-069 §7 designed to be VISIBLE
(so an interrupted run doesn't silently vanish), undermined by the one UI that is supposed to show
them.

## Root cause
Two independent writers own this vocabulary (the `change`/`bug`/`iterate` skills at capture time,
and `sync --close-out` at closer time) and one reader (`changes.ts`) hardcodes its own copy of the
valid set instead of deriving it from — or at minimum being kept in lockstep with — the actual
status tokens those writers use. `test-change-now-prose.sh` already caught half of this gap (it
asserts `changes.ts`'s `VALID_STATUSES` includes `draft`, and that `now-mode.md` documents
`building`/`closing` as the two tokens the validator currently rejects) but the fix on the READER
side was never made — the test only proves the prose is honest about the gap, not that the gap is
closed.

## Fix plan
Add `"building"` and `"closing"` to both `ChangeQueueStatus` (line 28) and `VALID_STATUSES`
(line 60) in `mission-control/src/lib/changes/changes.ts`. Check every consumer of
`ChangeQueueStatus` (the Kanban column mapping, any status-specific styling/filtering in
`src/components/` reading this type) for an exhaustive switch that would now need the two new
arms — TypeScript's own exhaustiveness check on a discriminated union will surface them; give
`building` and `closing` a sensible column/badge (most likely folded next to `ready` as "in
progress", visually distinct from `done`/`discarded`) rather than defaulting silently.

This is a Mission Control product fix (one line in a data-layer file plus whatever a discriminated
union's exhaustiveness check demands downstream) and belongs in ITS OWN change queue via
`/pandacorp:change`, run inside `mission-control/`, not implemented ad hoc from the factory repo —
`mission-control/AGENTS.md`'s write-gate routes any behavior change through the skill. **NOTE
(unverified):** the review that filed this item stated a card for this issue already exists in
Mission Control's own `.pandacorp/inbox/changes/`; a check of that directory during this session
found no card whose title or body mentions `building`/`closing`/`VALID_STATUSES`/queue parse
errors — so either the referenced card uses different wording, was filed after this check, or the
claim was mistaken. File one via `/pandacorp:change` inside `mission-control/` if none is found
when this item is picked up, and link it here.

## Tests (prove the fix — TDD, RED → GREEN)
A unit test in Mission Control's own suite (co-located with `changes.ts`, e.g.
`src/lib/changes/_tests/`) that reads a fixture card with `status: building` and one with
`status: closing`: both must land in `items[]` as normal `ChangeQueueItem`s with that status, NOT
in `errors[]`. RED before the fix (both currently fail loud into `errors[]`), GREEN after.

## Done when
- `changes.ts`'s `ChangeQueueStatus` and `VALID_STATUSES` include `building` and `closing`.
- The new unit test above is green, and Mission Control's own `verify.sh`/test suite is green.
- Every exhaustive switch over `ChangeQueueStatus` handles the two new arms (compiler-verified,
  `tsc --strict` green).
- The Mission Control change card for this fix (existing or newly filed) is linked here and moved
  to `done/`.

## Out of scope
Redesigning the change-queue status vocabulary itself, or making the reader derive its valid set
programmatically from the writers instead of a hardcoded array (a deeper single-source-of-truth
fix that would be its own, larger item if the owner wants it).

## Closed — 2026-09-22
Verified against the actual merged state, not just the commit message: `changes.ts:36` types
`ChangeQueueStatus` as `"ready" | "draft" | "building" | "closing" | "done" | "discarded"` and
`VALID_STATUSES` (line 72) includes both new tokens; `mission-control/src/lib/changes/_tests/changes.test.ts`
(15 cases, including `building`/`closing` fixtures) run live this session — 15/15 passed. Merge commit
`98b9b91f` (bringing in `mc-change-queue-statuses` commit `19ae06d7`) also updated `ChangesPanel.tsx` and
`ChangeDetail.tsx` for the two new arms and added `mission-control/docs/decision-log.md`'s own entry plus
FRD-04 REQ-04-010. All "Done when" criteria met.
