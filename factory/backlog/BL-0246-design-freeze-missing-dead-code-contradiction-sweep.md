---
id: BL-0246
type: change
area: plugin-skill
title: "Design freeze checklist has no explicit dead-code/contradiction sweep of the prototype against the FRDs"
status: open
severity: p2
opened: 2026-10-17
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-16 (agent-inferred): DR-064 reconciliation caught an 'Archivada' card tag contradicting an AC ('explained only on the detail page'), plus unused icons and dead strings, only because an agent happened to read the code — not because any checklist step looked for it"
closes:
links: [DR-064]
---

## Problem
During funko-tracker's design freeze, a DR-064 (`factory/decisions/registry.yaml` id `DR-064` —
bidirectional functional reconciliation between the approved prototype and the FRDs) pass turned up
leftover UI in the prototype that CONTRADICTED the FRDs: an "Archivada" card tag visible on the card
itself, when the matching acceptance criterion said that state should only be explained on the
detail page; plus unused icons and dead strings with no current purpose. This was caught only
because an agent happened to read the prototype's code line by line during the DR-064 pass — no
step in the design freeze process explicitly instructs a sweep FOR leftover/contradicting UI
artifacts (as opposed to reconciling declared FRD requirements against the prototype's declared
screens, which DR-064 already does).

Impact: a prototype naturally accumulates leftover UI across many design rounds (abandoned
approaches, superseded copy, icons no longer referenced by any shown state) that silently
contradicts the FRDs it is supposed to visually realize; without an explicit sweep step, catching
this depends entirely on an agent choosing, unprompted, to read the underlying code rather than just
the declared screens/states.

## Fix plan
1. `plugin/skills/design/references/freeze-and-fidelity.md` (the freeze checklist DR-064 already
   lives in): add an explicit sweep step, distinct from the existing bidirectional FRD<->prototype
   reconciliation, that scans the prototype's own source for: (a) UI/copy/tags that assert something
   an FRD's acceptance criteria contradicts (not just "missing from" or "not covered by" an FRD —
   actively disagreeing with one), (b) icons/classes/strings with zero remaining references from any
   captured state.
2. Where feasible, make part (b) mechanical (e.g. a grep-based unused-selector/unused-icon-id check
   over the prototype's sprite and CSS vs. what the shard/catalog captures actually reference) rather
   than purely a reading task, so it survives being skipped under time pressure; part (a) likely
   stays a judgment item on the freeze's one independent audit checklist (`references/freeze-and
   -fidelity.md` S3 blocker list).
3. Update `plugin/skills/design/SKILL.md`'s freeze steps and `agents/designer.md`/`agents/reviewer.md`
   if the sweep needs to be assigned to a specific role.

## Tests (prove the fix — TDD, RED → GREEN)
- If a mechanical unused-icon/unused-string check is added: a fixture prototype with a sprite icon
  referenced by no captured state is RED before the fix (no check exists) and RED-then-GREEN after
  (the new check flags it, then passes once removed) — add to
  `plugin/scripts/test-design-fidelity.mjs` or a sibling test file.
- The freeze checklist / S3 blocker list documents the new sweep step (a doc-presence assertion is
  sufficient for the judgment half).

## Done when
- The checklist documents the sweep step; any mechanical sub-check has a passing RED→GREEN test.
- Plugin version bumped (PATCH or MINOR per DR-034) with a plugin decision-log entry.

## Out of scope
Fully automating judgment-based contradiction detection (UI that disagrees with an AC's meaning, not
just unused artifacts) — that stays part of the one independent S3 audit, not a mechanical gate.
