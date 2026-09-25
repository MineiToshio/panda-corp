---
id: BL-0163
type: change
area: plugin-skill
title: "change --now has no documented way to point at an ALREADY-CAPTURED card (every SKILL.md step assumes --now writes a brand-new card from a description)"
status: done
severity: p2
opened: 2026-09-23
closed: 2026-09-24
source: "first real /pandacorp:change --now dry-run on Mission Control 2026-09-23 (change-now-dryrun-report.md S4.4, 'Hueco de contrato: --now no documenta cómo apuntar a una card ya existente')"
closes: "plugin/skills/change/SKILL.md (new step 0) + references/now-mode.md (new §0) + plugin/skills/sync/SKILL.md (close-out normal tier, no-owning-WO exception) + plugin/scripts/test-change-now-prose.sh (BL-0163 assertions)"
links: [BL-0161, BL-0162]
---

## Problem
`change/SKILL.md` steps 1-5 assume `--now` always receives a plain-language DESCRIPTION and writes
a brand-new card (step 4) before branching into the fast path (step 5). There is no documented
mechanism for "run `--now` against the card that is already sitting `ready` in the queue" --
an owner (or an agent re-running a previously-captured, `status: ready` change) has no contractual
way to say "use THIS card" instead of re-describing the change and risking a near-duplicate card,
or manually reverse-engineering which step to resume from.

During the first real dry-run (`change-now-dryrun-report.md` S4.4), the operating agent hit this
directly: a `status: ready` card already existed, equivalent to the requested change. It treated
the card as "already captured" and resumed the flow from step 4b onward with a description
matching the card, actively avoiding a duplicate -- a reasonable interpretation, but the report is
explicit that it is "a reasonable interpretation, not the only one", and a less careful operator
could plausibly have filed a duplicate card instead. This is a genuine contract gap, not a defect
in behavior verified so far (unlike BL-0161/BL-0162, which are confirmed false verdicts/failures).

## Fix plan (NOT done here -- scoping only, per the item that opened this backlog entry)
Two directions were considered and deliberately NOT chosen without the owner's steer, per this
item's own originating instruction ("no inventes flujo nuevo"):
1. **A `--now <slug>` argument** that skips capture (steps 1-4) entirely and resumes at step 4b
   against an existing `.pandacorp/inbox/changes/<slug>.md`, refusing (capture-only, unchanged) if
   that card's `status` is not `ready`. Needs: a documented slug-lookup step in `SKILL.md`, and a
   decision on what happens if the description given alongside `--now <slug>` diverges from the
   existing card's body (ignore it? require them to match? update the card first?).
2. **No new entry point at all** -- document explicitly that a pre-existing `ready` card should
   just be re-described to `--now` verbatim, accepting the near-duplicate risk as the owner's to
   manage (the queue is a durable, human-readable folder; a stray duplicate is visible and
   cheap to discard).
Needs an owner decision (`/pandacorp:decide` or direct conversation) before either direction is
implemented -- this item intentionally stops at documenting the gap.

## Related gaps noted in the same report, NOT addressed by this item or by BL-0161/BL-0162
- **S4.5** -- `sync/SKILL.md`'s close-out `normal` tier text ("the affected WO's Status Note ...
  or a minimal new WO from the template if none fits") does not precisely cover a change with no
  owning FRD/WO at all (e.g. Manual content with no `REQ-NN-MMM` trace). The dry-run's operator
  worked around this by recording the fact in the decision log instead of fabricating a synthetic
  WO -- a defensible call, but the contract itself does not name this case.
- **S4.9** -- `usage-rollup.mjs --commits BASE..HEAD` derives its cost-measurement window from
  commit timestamps, which over- or under-attributes cost when the operating session is long-lived
  and reused across unrelated work (the commit predates the session's actual start on this task).
  The dry-run used `--window <ISO>..<ISO>` explicitly as a workaround; whether `--commits` should
  itself warn or refuse when the derived window looks implausibly long is an open question, not
  addressed here.

## Done when
Not applicable while `status: open` -- this item is scoping/documentation only. Closes when the
owner picks a direction for the existing-card entry point (or explicitly declines one) and, if a
direction is picked, the corresponding `SKILL.md`/`now-mode.md` prose + `test-change-now-prose.sh`
assertions land.

## Resolution (2026-09-24)

Direction **1** from the Fix plan above was picked: a `--now <slug>` argument. Implemented as a new
**step 0** in `plugin/skills/change/SKILL.md` (and its own **§0** in
`plugin/skills/change/references/now-mode.md`, since every later section already assumes a
freshly-captured card):

- `--now <slug>` (a bare identifier, not a description) resolves against
  `.pandacorp/inbox/changes/<slug>.md`. Not found → a clear Spanish message, then ordinary capture
  (step 1) using the rest of the input as the description — never a silent no-op.
- Found, `status: draft` → the existing "draft never enters the fast path" valve applies unchanged;
  the card is not re-captured, the owner is told it needs `status: ready` first, and the turn stops.
- Found, `status: ready` → capture (steps 1-4) is skipped entirely: no re-description, no
  near-duplicate card. The card is stamped `status: building` (the same value the queue-drain
  engine already uses for "in flight"), which is what stops a concurrent `/pandacorp:implement`
  drain from also picking up the same card while the fast path works it — this is now the one
  documented case where the fast path itself writes `building`. Execution then resumes at step 4b
  (derive rigor) exactly as if capture had just finished. Every existing valve (§2's three valves,
  the `critical` reclassification, the exhausted repair loop) still applies unchanged; on any of
  those exits the status is restored to `ready` (nothing attempted) or `draft` + `## Bloqueado`
  (attempted then handed back) — a card is never left stuck at `building`.

**The two related minor gaps** (S4.5, S4.9 in the dry-run report):
- **S4.5 (close-out `normal` tier assumes an owning FRD/WO)** — resolved as a prose fix:
  `plugin/skills/sync/SKILL.md`'s close-out step 4 `normal` bullet now names the no-owning-WO case
  explicitly (a change with no `REQ-NN-MMM` trace, e.g. Manual/content prose) and says to record it
  in the `docs/decision-log.md` entry already required at that tier instead of fabricating a
  synthetic WO — codifying the judgment call the dry-run operator already made by hand.
- **S4.9 (`--commits`-derived cost window over/under-attributes on a long-lived operator session)**
  — **left open, not fixed here.** This is not a clear prose change: closing it properly means
  `usage-rollup.mjs` deciding a size threshold for "implausibly long" and choosing a warn-vs-refuse
  behavior, which is a script-logic/policy decision, not a documentation gap. The existing
  `--window <ISO>..<ISO>` escape hatch already lets an operator sidestep it today (used by both
  canary reports). Left for a separate, explicitly-scoped backlog item rather than guessed at here.

**Test**: `plugin/scripts/test-change-now-prose.sh` extended with a new "BL-0163" section (9
assertions) checking that both `SKILL.md` and `now-mode.md` document the `--now <slug>` entry
point, the no-duplication guarantee, the `building` stamp, and the draft/clearing rules. Full suite
green: 69 passed, 0 failed.
