---
id: BL-0125
type: bug
area: plugin-skill
title: "sync-portfolio can leave factory/portfolio.md's phase stale against the project's own status.yaml, with no re-verification until the next manual run"
status: open
severity: p2
opened: 2026-09-07
closed:
source: "factory/memory/_inbox.md note, 2026-09-04 (agent-inferred) — pandacorp-memory-review sweep, read live on mission-control"
closes:
links: []
---

## Problem
A 2026-09-04 `pandacorp-memory-review` sweep found `factory/portfolio.md`'s Mission Control row marking
phase `release` (stamped by the 2026-08-31 `/pandacorp:sync-portfolio` run), while
`mission-control/.pandacorp/status.yaml` read `phase: implementation` — read live in the same session. Per
AGENTS.md rule 5, `status.yaml` is the ONLY source of truth for an `in-pipeline` project's phase once
`in-pipeline`; the portfolio is a pointer/summary and must never diverge from it. The sweep only reads/
reports (out of its own scope) — it did not correct the row, and nothing else re-verifies it until the
next `/pandacorp:sync-portfolio` run, which itself may be the source of the drift.

## Root cause
Unconfirmed — needs investigation as part of this item's own fix work: either (a) the 2026-08-31 sync ran
BEFORE mission-control's status transitioned to `implementation` (a timing/ordering issue, not a bug), or
(b) `/pandacorp:sync-portfolio` has a bug reading/writing the `phase` field for at least one project shape.
Distinguish these before designing the fix.

## Fix plan
1. Reproduce: run `/pandacorp:sync-portfolio` against the current repo state and confirm whether it now
   correctly reads mission-control's live `phase` from `status.yaml` into `factory/portfolio.md`. If yes,
   this was (a) — a timing gap between the status change and the next scheduled sync, not a code defect;
   narrow the fix to reducing that gap (see step 3). If the row is STILL wrong after a fresh sync run, this
   is (b) — debug `sync-portfolio`'s phase-reading logic directly.
2. If (b): fix the read/write path so `sync-portfolio` always reflects the project's current
   `status.yaml` `phase` field verbatim, with a regression fixture pinning this specific project shape.
3. Either way, consider adding a staleness check to `sync-portfolio` (or a status-note it emits) so a
   portfolio row that has gone uncorrected for longer than N days after a phase change is flagged rather
   than silently trusted — closing the "nothing re-verifies until the next manual run" gap this note found.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a project whose `status.yaml` `phase` differs from its current `factory/portfolio.md` row. RED =
current behavior (document whichever of (a)/(b) reproduces). GREEN = after the fix, running
`/pandacorp:sync-portfolio` corrects the row to match `status.yaml` exactly, and a fixture pinning this
project's shape stays green on repeat runs.

## Done when
`factory/portfolio.md`'s phase column matches every in-pipeline project's `status.yaml` `phase` after a
`sync-portfolio` run, proven by the fixture above; root cause (a) vs (b) is documented in this item's
closing note; plugin version bumped per DR-034 if code changed.

## Out of scope
Re-architecting the portfolio's derivation model (AGENTS.md rule 5 already defines it correctly) — this
item is scoped to why ONE known instance went stale and closing that specific gap.

## Corroborating occurrences

**2026-09-07 (`pandacorp-review-launch` sweep).** The SAME drift, unresolved: the row still read `release`
three days after the 2026-09-04 finding above, with `status.yaml` still `phase: implementation` (106/106
WOs VERIFIED, `safe_to_test: true`). Re-confirmed live and corrected the row by hand in the same session
(`factory/portfolio.md`, commit `8accdef8`); Mission Control was also excluded from that sweep's business
verdict (internal tool, out of `review-launch` scope). This sharpens the root-cause step: **before**
distinguishing (a) timing-gap vs (b) read/write bug (fix-plan step 1), first check **whether
`/pandacorp:sync-portfolio` even ran at all during the 3-day window** — a third possible cause, (c) the
routine simply didn't execute (a scheduling/dispatch gap, not a phase-logic bug), which would need a
different fix (wire/verify the recurring task) than either (a) or (b). No new fix-design information
otherwise; folded here per this item's own no-redundancy precedent (see BL-0061's aggregated-corroboration
handling for the same pattern).

**2026-09-09 (`pandacorp-memory-review` PASO 0 sweep) — THIRD occurrence, FIRST on a non-mission-control
project.** `factory/portfolio.md`'s personal-page-v2 row (last synced 2026-09-07) still reads `phase:
release`, while `personal-page-v2/.pandacorp/status.yaml` reads `phase: implementation` (re-verified live
2026-09-10: still the case — `status.yaml`'s `phase` field is literally `implementation`, `work_orders_total:
12` / `work_orders_verified: 12`, `last_green_sha` dated 2026-09-08, no `phase` key ever written back to
`release`). The transition to `implementation` traces to a legitimate FRD-03 reopen (commit message "sync
work-order state and blueprint metadata (FRD-03)", 2026-09-08) — a real, correct phase change on the
project side, not a bug in the transition itself. Direction matches both prior occurrences (portfolio always
over-reports how advanced the project is, never under-reports). **This weakens hypothesis (b)** ("a bug
specific to at least one project shape," fix-plan step 1): mission-control is an in-repo internal tool with
its own status.yaml resolution quirks (BL-0034's territory), while personal-page-v2 is an ordinary
sibling-repo project with no special shape — the SAME drift recurring across two structurally different
project shapes makes a shape-specific read/write bug less likely and makes (a) timing-gap or (c)
sync-portfolio-not-running a relatively stronger prior. Root cause still unconfirmed; this is evidence to
weigh at fix-plan step 1, not a resolution. The row was not corrected by hand in this pass (out of PASO 0's
own scope, consistent with the 2026-09-04 finding's restraint; the 2026-09-07 review-launch sweep did
correct mission-control's row live, establishing that hand-correction is in-scope for OTHER routines that
touch the portfolio, just not this one). No new fix-design information beyond the hypothesis-weighting angle
above; folded here per this item's own no-redundancy precedent.

**2026-09-14 (`pandacorp-review-launch` scheduled sweep) — FOURTH occurrence, first with a concrete
root-cause mechanism for the phase change itself.** `factory/portfolio.md`'s personal-page-v2 row still
read `release` (unchanged since the 2026-09-09 finding above), while
`personal-page-v2/.pandacorp/status.yaml` had moved to `phase: implementation` around 2026-09-10/11 —
this time the trigger is identified precisely: several owner change requests
(`blog-generator-v2-story-factory`, `blog-mermaid-inline-diagrams`, etc.) were filed and `/pandacorp:iterate`
turned them into 7 new planned work orders, which per `build-orchestration.md` line 29
("`iterate`/`new-version` reopen a work order by setting it back to `PLANNED`") is the DOCUMENTED, correct
contract — reopening work orders on a released project legitimately moves it back out of `release` into
active build. The bug is NOT that phase moved backward (expected/by-design); the bug is that
`/pandacorp:sync-portfolio` hadn't re-run since 2026-09-07, so the portfolio table kept asserting `release`
through an entire backward phase transition with nothing to catch it. This sharpens fix-plan step 3
specifically: the staleness check must fire on ANY phase divergence, including a **release → earlier-phase
regression** triggered by `iterate`/`new-version` reopening work — not just forward-progress drift. No new
lesson: the general "phase transitions aren't monotonic once iterate reopens work orders" fact is already
the documented engine contract (`build-orchestration.md` line 29), and "never trust a cached/pointer field
over the live source of truth" is already AGENTS.md rule 5 + LESSON-0027 at a more authoritative tier — this
note only adds design information to BL-0125's own fix, folded here per precedent.

**2026-09-21 (`pandacorp-review-launch` scheduled sweep) — FIFTH occurrence, self-corrected in the same
pass, plus a downstream-consumer angle.** `factory/portfolio.md`'s personal-page-v2 row again read
`release` while `personal-page-v2/.pandacorp/status.yaml` read `phase: implementation` — same drift, same
project, unchanged since the 2026-09-09/09-14 occurrences above (`sync-portfolio` still had not re-run to
catch the backward `release → implementation` regression from the 2026-09-10/11 `iterate` reopen). Unlike
the prior occurrences, this sweep corrected the row live in the same pass (re-verified 2026-09-22:
`factory/portfolio.md` and both projects' `status.yaml` now read `implementation` for both mission-control
and personal-page-v2) — establishing that `review-launch`, like the 2026-09-07 sweep before it, treats
hand-correcting a stale portfolio row it discovers as in-scope for itself, distinct from
`pandacorp-memory-review`'s PASO 0 (which only reports, per the 2026-09-09 occurrence's note above). New
angle this note adds to the fix plan: beyond fixing `sync-portfolio`'s own write path/cadence (steps 1-3),
a downstream consumer that needs to pick "which projects are actually released" (e.g. `review-launch`
selecting business-verdict candidates) should read the project's own `status.yaml` `phase` directly rather
than trust `factory/portfolio.md`'s cached column — defense-in-depth per AGENTS.md rule 5, not a
replacement for fixing the portfolio's own staleness. No new root-cause information (still unconfirmed
between (a)/(b)/(c) above); folded here per this item's own no-redundancy precedent. Source:
factory/memory/_inbox.md agent-inferred note (2026-09-21 review-launch sweep, harvested 2026-09-22).

**2026-09-23 (`pandacorp-memory-review` PASO 0 sweep) — SIXTH occurrence, FIRST on a THIRD project
(PandaCast) and FIRST in the forward direction.** `factory/portfolio.md` showed PandaCast at `Fase:
product`, while PandaCast's own `.pandacorp/status.yaml` (source of truth, AGENTS.md rule 5) read `phase:
design` — the portfolio was stale BEHIND the project's actual forward progress (product to design), not a
backward release-regression like the mission-control/personal-page-v2 occurrences above. This is new
evidence for the root-cause question: the drift is not specific to the `release to implementation`
regression shape (fix-plan step 3's original framing) — it recurs on ordinary forward phase advances too,
on a third, structurally ordinary project. Not self-corrected in this pass (PASO 0 is read-only and does
not invoke `sync-portfolio`, consistent with prior PASO 0 occurrences' restraint — only `review-launch`
sweeps have corrected rows live so far, per the 2026-09-07/09-21 occurrences above). No new fix-design
information beyond broadening the affected-project count to three and the affected-direction to both
forward and backward; folded here per this item's own no-redundancy precedent. Source:
factory/memory/_inbox.md agent-inferred note (2026-09-23 PASO 0 sweep, harvested 2026-09-25).
