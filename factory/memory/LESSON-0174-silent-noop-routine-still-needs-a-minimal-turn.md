---
id: LESSON-0174
type: gotcha
domain: factory-engineering
tags: [scheduled-routines, silent-mode, chat-harness, closing-message]
context: a skill/routine instructs the agent to "exit silently" / produce no report on a no-op run
trigger: use this when a skill/routine's SOP says to "exit silently" or "no report" on a no-op/nothing-to-do run
source: "panda-corp factory/memory/_inbox.md, two independent no-op runs of pandacorp-memory-review's PASO 0 (2026-07-17 and 2026-07-20) — on the second occurrence the agent had just re-read the 2026-07-17 corrective note in the same inbox scan and still drifted"
provenance: agent-inferred
created: 2026-07-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0085]
---

**Situation:** `pandacorp-memory-review`'s PASO 0 explicitly instructs "termina EN SILENCIO (sin reporte
al owner)" when no sweep condition is met. On 2026-07-17 a no-op run instead produced a full verbose
report of what was checked. On 2026-07-20, in a LATER no-op run, the agent had literally just read that
exact 2026-07-17 note during the same inbox scan, yet still emitted a one-line closing summary instead of
true silence.

**Lesson:** a chat-turn-based harness structurally expects SOME final assistant turn text — there is no
way to end a turn with literally zero output, so "exit silently" as worded names an unachievable target
rather than the achievable one. Re-reading the corrective note in the same session was not enough to
prevent the same drift, because the instruction's literal wording still doesn't map onto anything the
harness can actually produce. The achievable version is "shortest possible non-report acknowledgment"
(a single neutral line), not true silence.

**Apply next time:** before composing the closing message on a genuine no-op scheduled run, don't try to
satisfy "silent" literally — emit the shortest possible non-report line instead of summarizing the checks
performed. When authoring or maintaining a routine/skill's "exit silently" instruction, phrase the
achievable target directly (a minimal ack, not zero output) so each run doesn't have to rediscover the
gap between the literal wording and harness reality (see BL-0085, which reconciles this specific
routine's prose).
