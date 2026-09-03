---
id: BL-0099
type: bug
area: plugin-skill
title: "LESSON-0096 calls ScheduleWakeup outside /loop a misuse, while implement/SKILL.md mandates exactly that"
status: doing
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

## Attempt evidence — 2026-09-03 (wf_ddcc95c6-1d7)

The owner's one supervised `powerful` build ran today (mission-control, FRD-24, 17:41:44Z→~18:41Z, quiesce
commit `6b3ef3c3` at 13:46:38-05 / 18:46:38Z). Checked live, this session:

- **`grep -c SupervisorTick ~/.claude/dashboard-events.ndjson` in the run window (17:41–18:48Z):** 34
  events, `project:"mission-control"`, all `{"data":{"running":true}}`. Gaps between consecutive ticks:
  min 51 s, max 121 s, mean ~116 s — a steady ~2-minute cadence for the full ~66-minute run, ending
  18:47:17Z (just after `BuildComplete` at 18:46:01Z).
- **`ScheduleWakeup`/heartbeat firings in that same window:** zero. Grepped the whole window for any
  `Wakeup`/`heartbeat` event literal (not narrative text elsewhere in the stream) — none. `status.yaml`'s
  `supervisor_heartbeat` field is empty (`""`) at rest (post-quiesce clear), consistent with the
  lease-clear-on-exit contract, not with a `ScheduleWakeup`-driven write.
- No `/goal`-adjacent or other check-in events fired in the window either (cross-checked while looking at
  BL-0102).

**Reading against the two texts:**
- `LESSON-0096` (`factory/memory/LESSON-0096-dont-poll-or-spawn-agents-to-wait-for-background-completion.md`)
  is scoped to a specific failure shape: scheduling a `ScheduleWakeup` **and/or spawning a placeholder
  Agent** to *wait for one background task's completion*, which recursively spawned duplicate
  investigation agents. Its own "Apply next time" text already says `ScheduleWakeup` "needs the
  `<<autonomous-loop-dynamic>>` sentinel or a `/loop` prompt to re-fire correctly" — i.e. it is *predicting*
  ScheduleWakeup misbehaves outside `/loop`, not just disapproving of the pattern.
- `implement/SKILL.md:59` (Operative constants table) states the ~2-min "Supervisor liveness tick" is a
  "dedicated `ScheduleWakeup`"; step 5 of the Launch checklist and the "Mount the supervisor" prose also
  name a "dedicated ~2-min `ScheduleWakeup` heartbeat" alongside `Monitor`.
- **What this run actually did, per the evidence above, does not match either text's literal claim about
  the 2-minute cadence:** the ~2-min liveness/lease-renewal tick was carried entirely by the `Monitor`
  bash-loop path (SupervisorTick events, steady ~116 s cadence, no stale-lock false positive — `.pandacorp/status.yaml`'s
  lease/heartbeat fields tracked cleanly to quiesce), and **no `ScheduleWakeup` fired at all** during the
  run — not even the separate ~20–30 min owner-visible "health heartbeat" one (0 firings in 66 minutes,
  where at least one would be expected on the ~25 min cadence named in the run description). Consequently:
  neither did `LESSON-0096`'s predicted misbehavior manifest (there was no ScheduleWakeup-driven runaway,
  because none fired) nor was `SKILL.md`'s literal "dedicated ~2-min ScheduleWakeup" mandate actually
  exercised as the liveness mechanism — `Monitor` alone carried it, successfully, for the whole run.

**Verdict (recorded here; NOT yet in `plugin/docs/decision-log.md` — this pass has no permission to edit
that file, see below):** option **(a)** from the Fix plan is what this evidence supports — narrow
`LESSON-0096` rather than filing a BL against `SKILL.md`. The lesson's real incident shape (spawning an
extra placeholder *Agent* to bridge/wait, which then self-delegated into duplicates) is materially
different from a periodic, no-agent-spawned lease-renewal timer that only touches a lock file and appends
one event. This run additionally shows the two mechanisms aren't even in tension in practice: the 2-min
tick that would be the point of friction with `LESSON-0096` was carried by `Monitor`, not
`ScheduleWakeup`, in this live run — so the literal contradiction the card opened on is narrower than it
reads on paper. Recommended text for `LESSON-0096`: explicitly carve out "a periodic liveness/lease-renewal
tick that spawns no agent and does not wait on another agent's completion" from the anti-pattern, while
keeping the core lesson (don't spawn a bridge Agent, don't poll-wait for a background completion
notification) intact.

**Separate observation (not this card's question, flagging only):** `SKILL.md`'s own Operative-constants
table claim that the 2-min tick is a "dedicated `ScheduleWakeup`" does not match how this run was actually
operated (`Monitor` carried it; `ScheduleWakeup` fired zero times). Whether that is doc drift or a
one-off operator deviation is unverified — proposed follow-up (not filed): *"Audit whether implement's
supervisor actually needs a dedicated 2-min ScheduleWakeup given Monitor already carried full liveness/lease
duty in wf_ddcc95c6-1d7, or correct SKILL.md's Operative-constants table if Monitor-only is the intended/accepted shape."*

**Status stays `doing`, not closed:** Done-when requires "the verdict and its evidence are in
`plugin/docs/decision-log.md`" — this pass is authorized to edit only the three BL-0098/0099/0102 card
files, not `plugin/docs/decision-log.md` or `LESSON-0096` itself. The verdict above is ready to transcribe
verbatim; remaining steps (owner or a follow-up session): (1) write this verdict into
`plugin/docs/decision-log.md`, (2) run `learn` to narrow `LESSON-0096`'s wording per the recommendation
above, (3) then R-37's promotion sequence (§12.4) is unblocked.
