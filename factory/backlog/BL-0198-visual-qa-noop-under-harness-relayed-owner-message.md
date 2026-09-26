---
id: BL-0198
type: bug
area: build-engine
title: "visual-qa returned done:false with 0 tool calls in canary E2; the only new input was a harness relay of an unrelated owner question into every subagent"
status: open
severity: p2
opened: 2026-09-26
closed:
source: "canary E2 report §4.5 — transcript agent-a017a8c4bfdc6f8f6 (visual-qa), wf_405eeb21-f9e"
closes:
links: [DR-072]
---

## Problem
Canary E2's `visual-qa` (sonnet) answered `{done:false}` in its first and only turn: 0 tool calls, no text. The engine
degraded honestly (UiPassSkipped), but the run's close-out had no visual pass (D2's cost 12.05 min / 3.01 $).

## Evidence
- The visual-qa prompt is byte-identical between the D2 engine (9.108.0, 9b7f9890) and 9.113.0 (md5 of the prompt body).
- D2's visual-qa (wf_faf48b18-881, same model sonnet) made **111 tool calls**.
- Every E2 subagent transcript starts with "[Workflow harness — user request] The harness relays, verbatim …: *todos el
  trabajo que estás haciendo lo haces delegando subagente…?* … Where the computed task conflicts with this request, this
  request wins". Count: **38/38** in wf_405eeb21-f9e, **0** in wf_faf48b18-881 (D2) and wf_7a12ea20-7f1 (E1). The text is
  an owner question to the orchestrating session, not a task for any subagent.
- `artifactsTouchUi` is not the cause: `forceUiPasses` defaults on and the agent was spawned.

## Root cause (probable, not confirmed — n = 1)
The harness relays the session's latest owner message as "the user request that triggered this workflow" into every
subagent with a "this request wins" framing. The sonnet reviewer, which cannot delegate, most plausibly read it as a
conflicting instruction and declined. Harness behaviour, outside the engine.

## Mitigation shipped (7c741f90)
`VISUAL_QA_SCOPE`: the prompt says a relayed message that does not mention this pass is not addressed to it (only one
that explicitly asks to skip/change the pass changes it, and then done:false quotes it); `VISUAL_QA_SCHEMA.reason` is
required on done:false and the engine logs it. Test E2-5a (RED on 9.113.0).

## Done when
- [ ] The harness no longer relays an unrelated owner message into workflow subagents, or a canary with such a relay
  shows visual-qa doing its work (tool calls > 0) with the mitigation.
- [ ] If it recurs, the logged `reason` names the cause.
