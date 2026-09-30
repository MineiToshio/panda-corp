---
id: BL-0198
type: bug
area: build-engine
title: "visual-qa returned done:false with 0 tool calls in canary E2; the only new input was a harness relay of an unrelated owner question into every subagent"
status: done
severity: p2
opened: 2026-09-26
closed: 2026-09-30
source: "canary E2 report §4.5 — transcript agent-a017a8c4bfdc6f8f6 (visual-qa), wf_405eeb21-f9e"
closes: "engine side: spawnVisualQa one-retry net + relay scope in plugin/agents/reviewer.md (plugin/runtime/engine/pandacorp-build.src.js, tests BL0198-a..g in plugin/scripts/test-pandacorp-build.mjs). The harness relay itself is NOT fixable from this repo (see Resolution)."
links: [DR-072, BL-0211]
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

## Resolution (2026-09-30) — the engine side is closed; the harness side is not ours
Evidence re-read before closing: the visual-qa prompt is byte-identical between D2 (111 tool calls) and E2 (0), the relay
line is in 38/38 E2 transcripts and 0 of D2/E1, and F1/F2 (canary reports §5.6/§1.1) then ran visual-qa for real (13.2
min / 117 calls and 15.2 min / 138 calls, one bounded fix committed in F2). The cause stays *probable, n = 1*: nothing
in this repo can prove it, and whether the F1/F2 transcripts carried the relay line was **not verified** (their
transcripts are not archived under `docs/reviews/`). What the engine can and does do, without depending on the cause:
1. **Retry net (`spawnVisualQa`, lean AND legacy close-out).** The engine cannot see tool calls; it only gets the
   schema'd answer. So "did no work" is read from the answer: `done:false` that reports no `toolCalls > 0` and whose
   `reason` names no step (`step <n>`). Such an answer is retried ONCE with a corrective note (`RETRY (BL-0198)`: the
   relay does not cancel this pass, start at step 1) and a log line; a second no-op is never retried again and is
   recorded as `UiPassSkipped` with `reason:"agent-noop-after-retry"` (distinct from `agent-no-result`). A legitimate
   failure names its step, so a 12-minute pass that really failed is never paid for twice; a no-op costs ~0.03 $ to
   retry. A `null` result is NOT retried (ambiguous: a long pass can also die late; the workflow sandbox has no clock
   to tell them apart). The schema now asks for `toolCalls`, and the prompt for `reason: "step <n>: …"`.
2. **Relay scope for every reviewer-typed engine agent.** `plugin/agents/reviewer.md` (the system definition of the
   gate, the split finders/verifiers, visual-qa and the close-out) now has a "Harness relays are not your task" section
   (a relayed message that does not name the step's task is not addressed to it; never answer `did nothing` without
   attempting the steps). `VISUAL_QA_SCOPE` (7c741f90) stays as the in-prompt copy. Codex mirror regenerated.
3. **Gates (general case).** A gate that answers `green:false` with no inventory already takes the B2 re-ask (BL-0157,
   tests R1-R3): its no-op shape is covered. A `null` gate verdict keeps routing to repair/block by design (G2); not
   changed, because null cannot be told from a late death.

**Not fixable here (harness):** the Workflow harness relaying the session's latest owner message into every subagent
with a "this request wins" framing. No engine option reaches it. If a future canary shows visual-qa doing no work with
`reason` populated, that `reason` (now always logged) is the evidence to hand to whoever owns the harness.

Tests: `BL0198-a..f` and the static `BL0211-j / BL0198-g` in `plugin/scripts/test-pandacorp-build.mjs` (a, b, d, e are
RED on 9.116.0: no retry, no `toolCalls` in the schema; c and f are negative controls that must stay single-spawn).

## Done when
- [x] Engine side: a visual-qa no-op is retried once, recorded, and never silent (above).
- [x] If it recurs, the logged `reason` names the cause (E2-5a) and the event says `agent-noop-after-retry`.
- [ ] (harness, out of our hands) the harness stops relaying an unrelated owner message into workflow subagents. Not
  tracked here: nothing in this repo can close it.
