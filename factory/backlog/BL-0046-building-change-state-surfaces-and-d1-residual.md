---
id: BL-0046
type: bug
area: mission-control
title: "Teach Mission Control + docs the engine-managed transient change status 'building', and close the D1 archive-strand residual"
status: open
severity: p1
opened: 2026-07-05
closed:
source: "Fable hardening sprint II WS-B1/D1 + its fresh-context verifier (docs/proposals/28)"
closes:
links: [BL-0035, DR-069]
---

## Problem
WS-B1's D1 fix (durable cross-run change archival, plugin v9.69.0) made the build engine stamp a change's
own frontmatter `status: building` while its FRDs are in flight (so the change is not re-drained and can be
archived across runs). This introduced a **new transient status value** that two surfaces do not yet know:

1. **Mission Control rejects it (real, if transient, display break).** `mission-control/src/lib/changes/changes.ts`
   has a strict union `ChangeQueueStatus = "ready" | "draft" | "done" | "discarded"` with fail-loud
   validation (`isChangeQueueStatus`, `VALID_STATUSES`, the error at ~line 166: "invalid or missing status
   (ready|draft|done|discarded)"). A change in `building` is therefore surfaced as a READ ERROR in the
   change panel for the duration of a build, instead of rendering as an in-flight item. (Fail-loud is
   correct behaviour for a genuinely-unknown status — it just needs to learn the new valid value.)
   Surfaces: `changes.ts` (the union + VALID_STATUSES + error message + any status-derived counts),
   `_components/tab-changes/ChangeCard.tsx` + `ChangesPanel.tsx` (render `building` as "en construcción"),
   and `changes.test.ts` (a fixture asserting a `building` item reads OK).
2. **Docs partially updated.** `plugin/skills/change/SKILL.md` now documents the engine-managed
   `building`/`done` states (WS-B1 addendum). `plugin/skills/bug/SKILL.md` still lists the enum as
   `draft | ready | done` (omits `building`) — align it. If the Manual's change-lifecycle narrative
   enumerates statuses, add `building` there too (DR-046).

## Root cause
The D1 fix chose a new honest status value (`building`) for the in-flight state but did not propagate it to
the enum consumers — the classic single-source-of-truth propagation gap the factory otherwise guards.

## Fix plan
1. **MC:** add `"building"` to `ChangeQueueStatus` + `VALID_STATUSES` + the error message; render it as a
   distinct in-flight state in `ChangeCard`/`ChangesPanel` (not an error, not "done"); add a `changes.test.ts`
   fixture proving a `building` item reads as a valid in-flight item. Record in `mission-control/docs/decision-log.md`.
2. **Docs:** add `building` to `plugin/skills/bug/SKILL.md`'s enum parenthetical; sweep for any other
   change-status enumeration (Manual change-lifecycle text) and align.

## Residual — D1 archive strand (lower severity, same theme)
The verify-then-archive sweep runs at close-out only when the run built ≥1 FRD. If the run that verifies a
change's last FRD has its **archive agent die**, the change stays `building`; a subsequent run where
**everything is already VERIFIED** hits the engine's "Nothing to build" early-exit (before the sweep is
reached) and never archives it — the change strands in `building` and `pending_changes` stays off by one.
Not data loss (the change file is safe on disk). Options: (a) run the archive sweep on the "nothing to
build" early-exit path too — REJECTED inline because it would spawn a MECH agent on every no-op re-check
(the hot supervisor-poll path); (b) have the plan agent report whether any `building` change exists and
sweep only then; (c) accept it as a rare edge (needs an agent death) and let the owner re-drain. Pick (b)
or (c) here; do NOT tax the no-op path.

## Tests (prove the fix — TDD, RED → GREEN)
MC: a `changes.test.ts` fixture with `status: building` reads as a valid in-flight item (RED before the
union widens). Engine (if option (b)): a `test-pandacorp-build.mjs` scenario where the plan is empty but a
`building` change exists → the sweep still runs.

## Done when
MC renders a `building` change as in-flight (no read error), its test proves it, the bug-skill enum + any
Manual status list name `building`, the residual strand is closed (option b) or explicitly accepted (option
c, documented), and the relevant decision-logs record it.

## Progress (2026-07-10, E2/D2 — docs strand, bug-skill enum ONLY)
Fix-plan item **2 (Docs)** is PARTIALLY done: `plugin/skills/bug/SKILL.md` now names the full canonical
enum **`draft | ready | building | done`** (was `draft | ready | done`, omitting `building`) — landed as
part of the D2 bug thin-down (the step-2 card block now points at `/change` step 4 and states the owner
sets only `draft`/`ready` while the engine manages `building`/`done`). This closes the **bug-skill enum**
sub-strand.

STILL OPEN (do NOT close this item):
- **MC strand (item 1):** `changes.ts` union + `VALID_STATUSES` + error message + `ChangeCard`/`ChangesPanel`
  render + `changes.test.ts` fixture — untouched (out of E2's factory-only scope; a Mission Control change
  routed through MC's own flow).
- **Docs strand remainder:** the Manual change-lifecycle narrative status list (DR-046) — not yet swept for
  `building`; belongs to the closing-wave Manual sync.
- **Residual — D1 archive strand:** still needs the option (b)/(c) decision + its test.

## Out of scope
Changing the engine's choice of `building` as the status value (it is the honest in-flight state; D1 is
landed and correct — this item teaches the consumers, it does not redesign the producer).
