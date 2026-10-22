---
id: BL-0269
type: bug
area: plugin-skill
title: "Design freeze S0.3 must build its per-FRD context-pack worklist from FRDs' ui: frontmatter, not from the config's accumulated states"
status: open
severity: p2
opened: 2026-10-22
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — Mission Control v2 design freeze, FRD-14"
closes:
links: [LESSON-0491]
---

## Problem
Design-freeze task S0.3 (`plugin/skills/design/references/freeze-and-fidelity.md` line 46: "S0.3 is the
only task that reads everything... writes one pack per UI FRD") built its list of UI FRDs needing a
context pack from `fidelity.config.json`'s accumulated `states.<frd folder>` keys, instead of from each
FRD's own `ui: true` frontmatter. During the Mission Control v2 redesign, FRD-14 is `ui: true` but had no
`states` folder populated yet (no round had configured a state for it), so it got no context pack and
silently escaped the S0.3 reconciliation step meant to cover every UI FRD — with no error, because the
enumeration source itself never had an entry for FRD-14 to be missing.

Impact: any UI FRD whose states haven't been configured yet by the time S0.3 runs is silently skipped,
with nothing downstream flagging the gap — the first signal an agent gets is a human (or a later audit)
noticing the FRD has no pack, not a tool error.

## Root cause
S0.3's own task description says it builds "one pack per UI FRD", which implies deriving the worklist
from the FRDs' `ui:` frontmatter (the authoritative, source-of-truth flag). In practice the task was
executed by enumerating `fidelity.config.json`'s `states` object keys instead — a downstream artifact
that is only populated as EARLIER rounds configure states for a given FRD. An FRD with `ui: true` but
zero configured states (because no round has drawn it yet, or it was added late) has no key in `states`
at all, so it is invisible to an enumeration keyed off that config.

## Fix plan
1. In the S0.3 procedure (`plugin/skills/design/references/freeze-and-fidelity.md` and/or
   `plugin/skills/design/scripts/fidelity/` wherever the context-pack writer resolves its FRD worklist),
   derive the UI-FRD set by reading each `docs/frds/frd-NN-*/frd.md`'s `ui:` frontmatter directly, not
   `fidelity.config.json`'s `states` keys.
2. For any UI FRD found in the source set but absent from `fidelity.config.json.states`, emit an explicit
   "no states configured yet for frd-NN" line in that FRD's pack (or a dedicated backfill note) instead of
   silently omitting the pack — so the gap is visible to the next task that reads the pack, not just to a
   human who happens to notice.
3. Update `freeze-and-fidelity.md`'s S0.3 row/description to state explicitly which set it enumerates
   from, so the next implementer (or agent) can't repeat the same silent substitution.

## Tests (prove the fix — TDD, RED → GREEN)
- A fixture project with an FRD marked `ui: true` and zero entries under `states.<that frd>` in
  `fidelity.config.json`: the worklist/pack-generation step must still produce a pack for that FRD (RED
  before the fix — no pack written; GREEN after).
- A fixture with an FRD NOT marked `ui: true`: no pack is produced for it, confirming the switch to
  frontmatter-sourced enumeration doesn't over-include non-UI FRDs.

## Done when
- The context-pack step's worklist source is `ui:` frontmatter across every FRD, verified by the new test
  fixtures passing.
- `freeze-and-fidelity.md` names the enumeration source explicitly.
- Plugin PATCH version bumped (bug fix, no behavior-visible capability change) + manifests regenerated.

## Out of scope
- Backfilling actual states for Mission Control's own FRD-14 (that is this project's own design-round
  work, not a factory-tooling fix).
