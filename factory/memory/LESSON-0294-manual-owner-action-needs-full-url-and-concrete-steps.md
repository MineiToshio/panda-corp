---
id: LESSON-0294
type: pattern
domain: communication
tags: [owner-communication, manual-action, interaction-style, dr-110]
context: asking the owner to perform a manual action themselves (open a link on another device, click somewhere specific, leave a comment)
trigger: use this when asking the owner to perform a manual action (open a page on a phone/another device, click a specific control, test something live) rather than just reporting status
source: "panda-corp, mission-control .pandacorp/run/lessons.md 2026-10-11 (owner-stated) — asked the owner to \"abre en tu móvil la página de prueba y comenta\"; he did not understand what that meant or where to go"
provenance: owner-stated
created: 2026-10-13
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0225]
---

**Situation:** asked the owner to perform a manual verification step ("open the test page on your phone and
comment") without the actual URL or any concrete steps. The owner did not understand the instruction well
enough to act on it.

**Lesson:** a vague pointer to "the page"/"the feature" is not an actionable instruction for a manual owner
action — the owner is not holding the same mental model of file paths/routes/sessions the agent is. A manual
action request needs to be self-contained enough to follow with zero extra context.

**Apply next time:** when asking the owner to do something manually, always include: (1) the full, clickable
URL (not a route fragment or a description of where it "is"); (2) concrete steps — where to click, what to
look at, in order; (3) an explicit statement of what matters (essential) vs. what's optional/nice-to-have, so
the owner doesn't have to infer priority. Treat this as its own checklist, distinct from general reply
formatting (CONV-11) — it's specifically about requests that need the owner's own hands.
