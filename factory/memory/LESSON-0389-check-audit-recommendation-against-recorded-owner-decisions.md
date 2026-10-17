---
id: LESSON-0389
type: gotcha
domain: multi-agent-review
tags: [visual-audit, owner-decisions, contradiction, design-freeze]
context: applying a visual/design auditor subagent's recommendation during a multi-agent pre-freeze audit
trigger: use this when a visual/design auditor subagent recommends a change during a pre-freeze or review pass, before applying it
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** in a multi-agent pre-freeze audit, a visual auditor subagent recommended switching a
phone layout to 2 columns per row, contradicting an earlier, already-recorded owner rule of 1 card
per row on phones. The recommendation looked reasonable on its own (density, typical mobile-grid
convention) but conflicted with a specific decision the owner had already made for this project.

**Lesson:** an auditor subagent judges in a vacuum — against general design conventions and the
FRDs it was given — and has no built-in awareness of a specific owner decision recorded earlier in
the project's own history unless that decision is in its context. A generically reasonable
recommendation can silently contradict a decision the owner already made and would not want
re-opened without being asked.

**Apply next time:** before applying any auditor/reviewer recommendation that changes a layout,
density, or interaction choice, check it against the project's recorded owner decisions (e.g.
`.pandacorp/comms/iteration.md`, `docs/design/design-decisions.md`) — a recommendation that
contradicts a recorded decision needs the owner's explicit re-confirmation, not automatic
application.
