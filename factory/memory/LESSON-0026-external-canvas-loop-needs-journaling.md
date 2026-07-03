---
id: LESSON-0026
type: gotcha
domain: design-workflow
tags: [dr-032, iteration-log, canvas, claude-design, external-tool]
context: a design/build loop that drives an external tool (Claude Design canvas) across multiple rounds outside the normal skill session
trigger: use this when a skill drives an iterative loop through an EXTERNAL tool (a canvas, a third-party editor) rather than in-session turns
source: "panda-corp personal-page-v2 design pass 2026-07-02; proposal docs/proposals/22"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** during a design pass, the skill drove several rounds of iteration through the Claude
Design canvas (an external tool, not in-session turns). `iteration.md` recorded "1 ronda limpia" even
though the canvas loop actually took many painful rounds to converge.

**Lesson:** DR-032 ("re-running the same phase = keep polishing, log the back-and-forth in
`iteration.md`") assumes the iteration happens IN the conversation, where every turn is naturally
logged. When the loop instead drives an EXTERNAL tool (a canvas, a third-party editor) across multiple
rounds, nothing forces those rounds into `iteration.md` — the skill only sees the final result and can
under-report the real friction, silently breaking DR-032's intent for that class of loop.

**Apply next time:** when a skill drives an iterative loop through an external tool, journal each round
explicitly as it happens (round count, what changed, what failed) rather than summarizing after the
fact from the final artifact — do not rely on the skill's own end-of-loop recollection.
