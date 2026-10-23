---
id: LESSON-0500
type: gotcha
domain: agent-tooling
tags: [agent-tool, effort, tool-schema, claude-code, stale-memory]
context: a skill/standard/memory lesson asserts a fixed limitation of a native Claude Code tool (e.g.
  "the Agent tool has no effort parameter"), and that limitation may have since been added to the tool
trigger: use this when a skill, standard, or stored lesson makes a flat claim about what a native Claude
  Code tool can/cannot do, before relying on that claim to design a new skill or dispatch
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred): the Agent tool now
  exposes a native `effort` param (low|medium|high|xhigh|max) with an explicit skill/owner-authorization
  requirement before setting it; a prior assumption (\"Agent tool only fixes model, effort goes by
  prompt instruction\", baked into the personal orchestrate skill and recorded as LESSON-0176) had gone
  stale"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0176, LESSON-0069]
---

**Situation:** LESSON-0176 (2026-07-21) recorded that the Agent tool "fixes `model` per subagent natively
but has no `effort` parameter — effort can only be induced indirectly via prompt instruction." On
2026-10-22 the live Agent tool schema was found to carry a native `effort` param
(`low|medium|high|xhigh|max`), with its own description requiring explicit skill/owner authorization
before a caller sets it. A skill (the personal `orchestrate` skill) built on the older assumption had gone
stale and needed fixing.

**Lesson:** native tool capabilities are not a fixed fact to memorize once — they evolve, and a stored
lesson or a standard's prose describing "what tool X can do" is a snapshot that can silently go stale
exactly like any other recorded-state claim (the same class LESSON-0069 already names for diagnoses and
"done" declarations, here applied to a tool's own schema). Treat this as a flagged, unresolved
contradiction against LESSON-0176, not a silent overwrite — LESSON-0176's finding may have been accurate
when written and simply superseded by a later tool update.

**Apply next time:** before designing or fixing a skill around a claimed native-tool limitation
(especially one baked into a standard or an older lesson), check the LIVE tool schema in the current
session rather than trusting memory/standards prose — tool capabilities change over time and a skill that
hard-codes a workaround for a now-fixed limitation becomes the stale artifact. When a new finding
contradicts a stored lesson like this, flag the contradiction on the older lesson rather than editing it
away.
