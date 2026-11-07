---
id: LESSON-0631
type: anti-pattern
domain: multi-agent-orchestration
tags: [decision-propagation, run-state, checklist, subagents, batch-jobs]
context: a method/scope decision agreed verbally in conversation mid-run, in a multi-step pipeline that
  later dispatches separate workers/subagents/batches to execute parts of that run
trigger: use this when a method or scope decision gets agreed in conversation partway through a run
  that will later dispatch separate workers, subagents, or batch jobs to do the actual work
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-05 (agent-inferred, Naruto batch): the decision
  'AI generation is only for box renders, not loose figures/acrylic' was agreed in chat after AI
  generation failed 0/8 on small figures, but 4 later batches still launched AI generation for acrylic,
  because the decision was never written into the run's own frozen checklist/plan that those batches
  actually read"
provenance: agent-inferred
created: 2026-11-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0622, LESSON-0630]
---

**Situation:** partway through a multi-batch run, a method decision was agreed in the conversation ("AI
generation is only used for box renders, never for loose figures or acrylic parts") after direct evidence
that AI generation failed consistently on the excluded cases. Four later batches in the SAME run still
launched AI generation for the excluded case (acrylic), because nothing in the run's own durable state —
only the chat transcript — recorded the decision, and the workers that dispatched those later batches
never read the chat.

**Lesson:** a decision agreed in conversation is scoped to whoever is reading that conversation at that
moment. A long or multi-batch run routinely dispatches work (subsequent batches, subagents, resumed
sessions) that reads the run's own PLAN/CHECKLIST artifact, not the conversation history that produced
it — so a decision that only exists in chat is, from those workers' point of view, a decision that was
never made. This is a silent failure: nothing errors, the later batches just proceed as if the earlier
constraint doesn't exist.

**Apply next time:** when a method/scope decision changes mid-run (especially one driven by a concrete
failure, like "approach X doesn't work for case Y"), write it into the run's own frozen checklist/plan
artifact immediately — the same artifact any later batch, subagent, or resumed session will actually
consult — not just into the conversation or a memory note. Treat "I told the owner/the chat" as
insufficient propagation for anything a downstream worker needs to obey.
