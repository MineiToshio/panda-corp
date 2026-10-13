---
id: LESSON-0297
type: gotcha
domain: agent-tooling
tags: [artifact, artifact-comments, auto-react, claude-tooling]
context: a comment left on an Artifact that was published from the current session triggers an automatic reply
trigger: use this when a comment auto-response ("Claude (via the user)") appears on a published artifact and you need to know which session is actually producing it
source: "panda-corp, mission-control .pandacorp/run/lessons.md 2026-10-12, verified via the artifact-auto-react notification (agent-inferred)"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0296]
---

**Situation:** a comment left on an artifact that this session had published triggered an automatic
"Claude (via the user)" reply. It looked like it came from some independent "Claude of the page", but it is
actually written by THIS session — the publishing session, notified via the `artifact-auto-react`
notification, is the one arming and producing the auto-response.

**Lesson:** publishing an artifact from a session makes THAT session responsible for auto-responding to
comments left on it afterward — there is no separate, page-bound "Claude" answering independently. The
auto-response is attributed to the user's own session, not a standalone page agent.

**Apply next time:** if an artifact needs comment auto-responses to keep working reliably (or to be
attributable to a specific context), keep the publishing session alive/traceable rather than assuming the
artifact itself carries its own independent responder; when debugging an unexpected or wrong-sounding
auto-reply, check which session published the artifact before assuming a "ghost" responder.
