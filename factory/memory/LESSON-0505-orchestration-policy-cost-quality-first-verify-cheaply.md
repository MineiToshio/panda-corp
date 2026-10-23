---
id: LESSON-0505
type: pattern
domain: orchestration-policy
tags: [dr-111, orchestration, cost-quality, escalation, owner-policy]
context: an orchestrator deciding, per subtask, which model+effort tier to dispatch at, and when to
  escalate above the session's own model
trigger: use this when an orchestrator is about to pick a subtask's model+effort tier, or decide whether
  to start cheap or escalate immediately
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (owner-stated): owner's goal for
  orchestration is cost-quality first, time second (via parallelism), with the orchestrator — not the
  owner — picking model+effort per subtask, including escalating above the session model (Opus/Fable)
  when needed; adopted rule: start cheap only when the result can be verified cheaply"
provenance: owner-stated
created: 2026-10-23
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: [mission-control]
links: [LESSON-0504, LESSON-0159]
---

**Situation:** designing how an orchestrator (not the human owner) should pick a subtask's model+effort
tier under DR-111/CONV-12, including the question of when it's safe to try a cheap tier first versus
escalating straight to a higher one.

**Lesson:** the owner's stated priority ordering is cost-quality FIRST, wall-clock time SECOND (bought
back via parallelism, not by picking a faster/pricier model) — and the orchestrator itself, never the
owner, is responsible for choosing model+effort per subtask, including escalating above the current
session's own model (to Opus- or Fable-class) when the subtask genuinely warrants it. The adopted
heuristic for when starting cheap is actually safe: **start cheap only when the result can be verified
cheaply** — i.e., only when a fast, low-cost check can catch a bad cheap-tier result before it propagates,
not merely when the task "looks simple."

**Apply next time:** when an orchestrator chooses a subtask's tier, check two things, not one: (1) does
this subtask look mechanical/documented enough for a cheap tier (per LESSON-0504's empirical split), AND
(2) is there a cheap, reliable way to verify the cheap tier's output before trusting it? If (2) is false —
no cheap verification exists — don't start cheap even if (1) looks true; escalate directly. Never ask the
owner to pick the tier; that decision belongs to the orchestrator, with escalation always available and
Fable-class reserved for genuine frontier cases per DR-111.
