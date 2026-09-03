---
id: BL-0102
type: change
area: build-engine
title: "Run the /goal falsification canary and close R-17 permanently if the predicted outcome holds"
status: doing
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-17 (already dead as an adoption, §10.1)"
closes:
links: []
---

## Problem
`/goal` was proposed as a partial replacement for the hand-rolled supervisor
(`plugin/skills/implement/SKILL.md:70,77,91`) and **died on the primary source**: `docs/en/goal` states the
evaluator is skipped while a subagent or background shell is running (the build is a background Workflow for
its entire duration), that it *"does not call tools"*, that check-ins back off 30 m → 1 h → 2 h, and that
at most **three** idle check-ins run per goal. What survives is a narrow optional use — a turn-continuation
nudge in an **attended** session only. Impact: L. The value of this item is closing the question with
evidence instead of leaving it re-litigable.

## Depends on
The same **one supervised real `powerful` build** the owner funded on 2026-09-02 (proposal 33 §12.5, option ii then i — see `factory/decision-log.md`), shared with BL-0096, BL-0110 and BL-0099. Ride that run; do not commission a build for this canary alone.

## Fix plan
On ONE supervised build with `maxFrds 1`, set `/goal "the run has ended with phase: release or a BLOCKED
reason recorded in status.yaml"` **alongside** the existing supervisor (never replacing any part of it), and
record (a) how many times the evaluator ran while the Workflow was in flight, and (b) whether any check-in
was delivered between minute 30 and the run's end. **Docs predict (a) ≈ 0 and (b) at most one.** If that
holds, write the result into `plugin/docs/decision-log.md` and close R-17 permanently.

## Tests (prove the fix — TDD, RED → GREEN)
The two recorded counts from one supervised build.

## Done when
The counts are recorded with the build they came from; `plugin/docs/decision-log.md` states whether `/goal`
is adopted as an attended nudge or closed; the supervisor contract is unchanged either way.

## Out of scope
Any change to the heartbeat, the `ScheduleWakeup` lease renewal or the termination judgement — §10.1
established `/goal` substitutes for none of them.

## Attempt evidence — 2026-09-03 (wf_ddcc95c6-1d7)

The owner's one supervised `powerful` build ran today: mission-control, `maxFrds: 1`, FRD-24, 17:41:44Z→
~18:41Z, `stopReason: "maxFrds"`. Checked live, this session, whether `/goal` was actually set for it:

- Grepped the full run window (17:41–18:48Z) of `~/.claude/dashboard-events.ndjson` for any `"goal"`
  literal, case-insensitive, scoped to `project:"mission-control"` — **zero matches**.
- Grepped `mission-control/.pandacorp/status.yaml` for a `goal` field — **none present**.
- No `CLAUDE_CODE_GOAL_CHECKIN_MINUTES` reference appears in the run's launch (`BuildLaunch` event only
  carries `mode`/`maxAgents`/`targeted`).

**Plain statement: `/goal` was NOT set for this run.** So this run cannot be the falsification canary the
Fix plan calls for (`/goal "the run has ended with phase: release or a BLOCKED reason..." alongside the
existing supervisor`) — there is no evaluator to count check-ins from, because none was configured. The
Fix plan's two counts, (a) how many times the evaluator ran while the Workflow was in flight, and (b)
whether any check-in landed between minute 30 and the run's end, are **not measurable from this run** —
both are undefined, not zero.

What this run DOES corroborate, independent of the missing `/goal` config, is the *background-work*
premise the primary source (`docs/en/goal`) predicts would suppress the evaluator regardless: the run was
a background Dynamic Workflow for its entire ~60-minute duration (per `journal.jsonl`/`agent-*.jsonl`
timestamps 12:41–13:46 local / 17:41–18:46Z), the FRD gate alone (`review_start`→`review_end` in
`track.jsonl`) ran 18:00:10Z→18:29:05Z (~29 min) with no turn boundary in between, and the owning session's
own liveness came entirely from the `Monitor` bash loop (34 `SupervisorTick` events, ~2-min cadence — see
BL-0099's evidence), not from any turn-continuation mechanism. This is consistent with (does not
contradict) the docs' claim that the evaluator is skipped while a background task is running — but it is
not a test of `/goal` itself, since `/goal` was never armed.

**Verdict per the card's own framing: "not refuted by this run" — because `/goal` was not exercised at
all, not because it survived a real test.** A real falsification still requires a run WITH `/goal` actually
set (e.g. `/goal "the run has ended with phase: release or a BLOCKED reason recorded in status.yaml"`) AND
`CLAUDE_CODE_GOAL_CHECKIN_MINUTES` configured, launched alongside the existing supervisor on a future
supervised build, with the same two counts (evaluator runs while the Workflow is in flight; check-ins
landing after minute 30) actually recorded.

**Status stays `doing`, not closed:** Done-when requires the counts to be "recorded with the build they
came from" and `plugin/docs/decision-log.md` to state whether `/goal` is adopted or closed — neither count
exists for this run (both undefined, per above), and this pass has no permission to edit
`plugin/docs/decision-log.md`. Recorded here instead, ready to carry forward: R-17 is **not yet closable**;
the next supervised `powerful` build should set `/goal` deliberately (this one didn't) to actually produce
counts (a) and (b) before `plugin/docs/decision-log.md` can honestly record a verdict.
