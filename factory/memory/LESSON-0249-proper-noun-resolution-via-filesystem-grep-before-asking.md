---
id: LESSON-0249
type: gotcha
domain: agent-collaboration
tags: [voice-input, dictation, proper-nouns, disambiguation, filesystem-search]
context: an owner's dictated/spoken instruction names a proper noun (a tool, a project, a company) that does not match anything the agent recognizes
trigger: use this when a skill invocation or chat message contains a proper noun that sounds phonetically plausible but matches nothing known — before asking the owner to clarify or silently guessing a spelling
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-20 (agent-inferred) — two proper nouns in the same dictated session resolved via filesystem search: 'el framework de 80-90' meant '8090', 'los proyectos de Joplin' meant /Users/Shared/Jobleap; both resolved from a single grep/find pass, and guessing would have put a wrong company name into a public blog draft"
provenance: agent-inferred
created: 2026-09-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** the owner frequently dictates skill invocations and requests by voice; speech-to-text renders
proper nouns phonetically ("el framework de 80-90" instead of "8090", "los proyectos de Joplin" instead of
"Jobleap"), producing a token that matches nothing the agent has seen before.

**Lesson:** a proper noun that doesn't match anything known is more likely a mis-transcribed dictation than
a genuinely new, unknown entity — and the cheapest way to resolve it is a targeted filesystem search
(`find -iname`, `grep -rl`) for near-matches BEFORE asking the owner to spell it out or silently guessing a
plausible spelling. In this session, both mangled names resolved from a single search each; guessing
instead would have shipped a wrong company name into a public-facing draft.

**Apply next time:** when a dictated proper noun doesn't resolve against known context, run a quick
filesystem search for phonetically-plausible near-matches (project directory names, config values, prior
mentions in `.pandacorp/`/profile docs) before asking the owner or guessing — reserve the direct question
for when the search comes up empty.
