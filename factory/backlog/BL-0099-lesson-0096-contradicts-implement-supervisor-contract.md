---
id: BL-0099
type: bug
area: plugin-skill
title: "LESSON-0096 calls ScheduleWakeup outside /loop a misuse, while implement/SKILL.md mandates exactly that"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-71 (blocks R-37 / LESSON-0096's promotion)"
closes:
links: [LESSON-0096]
---

## Problem
`factory/memory/LESSON-0096-*.md:8` calls a `ScheduleWakeup` outside `/loop` *"a misuse"*.
`plugin/skills/implement/SKILL.md:70,77` **mandates** a dedicated ~2-minute `ScheduleWakeup` outside `/loop`
as the atomic lease-renewal timer — a functional requirement, not narration. `docs/en/scheduled-tasks`
mentions `ScheduleWakeup` only in the self-paced-`/loop` context and names `CronCreate/List/Delete` as the
general scheduling tools, but does **not** explicitly forbid the use. Impact: `LESSON-0096` is queued at
`promotion: proposed` since 2026-07-16 with two independent near-miss incidents behind it — promoting it as
written would codify a rule the factory's largest skill violates.

## Root cause
The lesson is `provenance: agent-inferred`, `confidence: medium`, and was generalized from two incidents
into a categorical prohibition without checking it against the supervisor contract.

## Depends on
The owner funded **one supervised real `powerful` build** (proposal 33 §12.5, option ii-then-i, decided 2026-09-02 — see `factory/decision-log.md`). That single instrumented run carries four canaries at once: BL-0096 (cost/token telemetry), BL-0102 (`/goal` falsification), BL-0110 (DR-100 granularity measurement) and **this item's heartbeat check** — the ~2-minute `ScheduleWakeup` must be observed re-firing outside `/loop` for a full run with no duplicate spawns. Do not schedule a separate build for it.

## Fix plan
Decide which side is wrong and write it down. Either (a) narrow `LESSON-0096` to the incident shape it
actually covers (polling/spawning agents to wait), explicitly carving out the lease-renewal timer; or (b)
if the heartbeat really is a misuse, file a separate BL against `implement/SKILL.md`'s supervisor contract.
Record the verdict in `plugin/docs/decision-log.md`. Only then may R-37 promote the lesson via `learn`.

## Tests (prove the fix — TDD, RED → GREEN)
On one supervised build, confirm the ~2-minute `ScheduleWakeup` heartbeat re-fires outside `/loop` for the
full run without duplicate spawns. That observation is the evidence the verdict rests on.

## Done when
`LESSON-0096`'s text and `implement/SKILL.md` no longer contradict each other; the verdict and its evidence
are in `plugin/docs/decision-log.md`; the lesson is unblocked for the §12.4 promotion sequence.

## Out of scope
Promoting the lesson (that is `learn` + the owner gate, §12.4) and any change to the lease protocol itself.
