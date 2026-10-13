---
id: LESSON-0295
type: gotcha
domain: agent-tooling
tags: [auto-mode, permissions, preview-server, claude-code]
context: starting a local preview/dev server from inside Claude Code's auto-mode (unattended permission classifier)
trigger: use this when a local preview/dev server command is unexpectedly denied by auto-mode as "Expose Local Services", especially one that serves a directory wider than the single project being previewed
source: "panda-corp, mission-control .pandacorp/run/lessons.md 2026-10-11 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** auto-mode's permission classifier denied a preview server command as "Expose Local Services"
because it served a broad parent directory (`/Users/Shared/Proyectos`, covering every sibling project) rather
than the one project actually being previewed.

**Lesson:** the auto-mode classifier's risk judgment on a local server command is sensitive to the SCOPE of
what it exposes, not just that it binds a port — serving a directory wider than the task's own project reads
as a bigger surface than intended, even though the intent was benign.

**Apply next time:** scope a preview/dev server's served root to the EXACT project directory needed (never a
shared parent covering siblings) and bind explicitly to `127.0.0.1` (not the default/all-interfaces) when a
LAN-wide bind isn't actually required — both together let the classifier recognize the command as a narrow,
local-only preview rather than a broad network exposure.
