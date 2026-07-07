---
id: BL-0050
type: bug
area: plugin-skill
title: "implement's readiness/grounding-gate backfill warning re-triggers on every call for a mature legacy project with no way to record it was already answered"
status: open
severity: p2
opened: 2026-07-06
closed:
source: "mission-control/.pandacorp/run/lessons.md 2026-07-06 (FRD-17 build, agent-inferred) — Mission Control, 21 blueprints, 95+ WOs verified, phase:release, re-triggers the warning on every /implement call"
closes:
links: []
---

## Problem
`/pandacorp:implement`'s `SKILL.md` includes a DR-100/DR-102 readiness-gate re-check: if a project's
ACTIVE blueprints predate the `readiness_gate`/`grounding_gate` stamps, it warns the owner once and asks
whether to backfill. But there is no state field recording that this warning was already given and
answered (accepted or declined) — so a mature legacy project whose blueprints will ALWAYS predate those
stamps (they were written before the gate existed) re-triggers the same warning and question on every
single future `/implement` invocation. Confirmed on Mission Control (21 blueprints, 95+ work orders
verified, `phase: release`): the warning fires again each call with no memory of the owner's prior
decision.

## Root cause
The readiness-gate re-check's decision ("warn once") is not durable — nothing in `.pandacorp/status.yaml`
or elsewhere records that the owner was already asked and declined (or accepted) the backfill for this
project, so the check has no way to distinguish "never asked" from "asked and answered."

## Fix plan
1. Add a `status.yaml` field, e.g. `readiness_gate_backfill: declined | accepted | pending`, written the
   first time the warning is presented and the owner answers.
2. Update `/pandacorp:implement`'s SKILL.md readiness-gate re-check logic to read this field first: if
   already `declined` or `accepted`, skip the warning silently; only ask when the field is absent/`pending`.
3. Backfill the field as `pending` (or infer `declined` where the same warning has clearly already been
   dismissed in a project's prior build history) via `/pandacorp:upgrade` for existing legacy projects so
   they don't need to re-answer once this ships.

## Tests (prove the fix — TDD, RED → GREEN)
- A project with blueprints predating the readiness/grounding gate stamps AND
  `readiness_gate_backfill: declined` in its `status.yaml`: `/pandacorp:implement` runs WITHOUT
  re-presenting the warning.
- A project with predating blueprints and NO `readiness_gate_backfill` field: the warning fires once,
  and answering it writes the field so a second `/implement` call on the same project does not re-ask.

## Done when
The readiness-gate re-check reads and writes `readiness_gate_backfill` in `status.yaml`, proven by the
two cases above; SKILL.md doc updated to describe the new field; plugin version bumped per semver.

## Out of scope
Changing what the readiness/grounding gate itself checks — only its re-warn behavior on repeat calls.
