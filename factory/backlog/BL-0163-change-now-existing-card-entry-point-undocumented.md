---
id: BL-0163
type: change
area: plugin-skill
title: "change --now has no documented way to point at an ALREADY-CAPTURED card (every SKILL.md step assumes --now writes a brand-new card from a description)"
status: open
severity: p2
opened: 2026-09-23
closed:
source: "first real /pandacorp:change --now dry-run on Mission Control 2026-09-23 (change-now-dryrun-report.md S4.4, 'Hueco de contrato: --now no documenta cómo apuntar a una card ya existente')"
closes:
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
