---
id: LESSON-0485
type: pattern
domain: process
tags: [owner-interaction, focus, side-findings, parking-lot]
context: an agent working a focused task for the owner discovers an unrelated issue along the way (a foreign gate red, a side finding, a pre-existing defect not part of the current task)
trigger: use this when, while executing a task, you discover an unrelated issue that doesn't block the current task and doesn't need the owner's decision right now
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (owner-stated)"
provenance: owner-stated
created: 2026-10-22
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** the owner stated an explicit standing preference for how agents should surface things
discovered mid-task that are not what he asked for: route them to a dedicated file instead of the chat,
unless they block the current task or need his decision.

**Lesson:** interrupting an owner's focused task with every tangential finding degrades the interaction.
A side finding that neither blocks the current task nor needs an immediate decision is better recorded
somewhere durable and reviewed later in one batch than announced in the chat the moment it's found —
chat interruptions carry an attention cost a parking-lot file doesn't.

**Apply next time:** while working a task, write a new unrelated issue (a foreign gate red, a side
finding, a pre-existing defect) to a dedicated parking-lot file (this project's
`.pandacorp/comms/pendientes-para-luego.md` or the project's equivalent) instead of the chat, UNLESS it
blocks the current task or genuinely needs the owner's decision before you can continue — those two
cases still go to the chat immediately, in the same turn they're found.
