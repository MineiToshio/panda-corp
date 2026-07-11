---
id: LESSON-0134
type: pattern
domain: design-process
tags: [claude-design, canvas, instruction-following, design-system, prompting, reconciliation]
context: generating individual screens on a frozen design system (Stage 2 of the canvas procedure) when a screen needs a pattern the system does not yet have
trigger: use this when prompting a design-system-generation canvas for an individual screen, especially one that may need a UI pattern not yet present in the frozen system
source: "pandacast .pandacorp/run/lessons.md 2026-07-10 (agent-inferred, 2 paired notes): the canvas inlined new patterns directly into a screen instead of asking, EVEN THOUGH the prompt explicitly said 'do not create components; stop and tell me if one is missing' (login screen: a status banner; connections screen: a form panel and a Meta group) — each screen risked shipping its own private copy; on screen 3, repeating the same instruction AND explicitly reminding the canvas it had already inlined patterns before caused it to stop and ask about a missing Toast component instead of drawing it, at the cost of one extra round"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0109, BL-0059, LESSON-0141]
---

**Situation:** while generating individual screens on an already-frozen design system, the canvas
repeatedly inlined new UI patterns directly into the screen being generated (a status banner on login, a
form panel and a "Meta" group on connections) rather than flagging the missing pattern and asking — even
though the per-screen prompt explicitly instructed "do not create components; if one is missing, stop and
tell me." A plain instruction, stated once, was not reliable: the canvas treated "draw whatever the screen
needs" as the default, defeating the instruction's intent silently rather than violating it visibly. Later,
on a third screen, the SAME instruction — repeated in that screen's prompt AND paired with an explicit
reminder that the canvas had already inlined new patterns on prior screens — caused the canvas to stop and
ask about a missing `Toast` component instead of drawing it inline. The cost was one extra prompt round;
the benefit was that the component was born in the shared system instead of privately duplicated per
screen.

**Lesson:** an instruction like "do not create new components, stop and ask" is not self-enforcing on a
generative canvas the way it would be for a rule-following compiler — it is a probabilistic instruction
that competes with the model's default bias to just complete the visible task (draw whatever the screen
needs). This is a specific instance of the broader class LESSON-0109 already documents (a safety/behavior
gate reasoning over surface text/instructions, not runtime semantics, will not reliably hold on its own).
The instruction becomes more reliable when (a) it is repeated in EVERY per-screen prompt, not stated once
at Stage 1, and (b) it explicitly references the canvas's own PRIOR inlining behavior as a concrete
reminder, not just an abstract rule — but even then it is not guaranteed, so it must be backstopped by an
active audit, not trusted as sufficient on its own.

**Apply next time:** in every Stage-2 per-screen prompt, restate "do not create new components; stop and
ask if one is missing" explicitly (never rely on it having been said once at Stage 1), and when the canvas
has already inlined a pattern on a prior screen, name that specific prior incident in the next prompt as a
reminder. Regardless, after each screen's generation, actively audit its output for local
CSS/markup that is really a shared pattern in disguise, and promote it to the design system BEFORE
generating the next screen — do not wait for the closing sweep (BL-0059), which runs only after all
screens are done and each screen generated before the promotion inherits its own private copy.
