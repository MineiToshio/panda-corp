---
id: LESSON-0490
type: pattern
domain: i18n
tags: [interface-language, mixed-language-content, internal-tool, i18n]
context: an internal dashboard/tool whose own UI commits to one fixed language, while it displays content authored elsewhere in a different language (project documents, AI-generated files)
trigger: use this when deciding the display-language policy for a tool that shows content it did not author itself (another project's docs, AI-generated files, third-party data)
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (owner-stated) — Orbita"
provenance: owner-stated
created: 2026-10-22
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0271]
---

**Situation:** the owner stated the standing rule for Mission Control's interface language: everything
the app itself writes (labels, navigation, chrome copy) is in one fixed language; content the app merely
DISPLAYS but didn't author (project documents, AI-generated project/factory files) keeps whatever
language it was originally written in.

**Lesson:** a mixed interface — some chrome in one language, displayed content in another — reads as a
bug or inconsistency to a user, so the tool's OWN copy must commit to one language. But forcing every
DISPLAYED piece of content into that same language is a different, much more expensive commitment: it
requires either a model call per render (cost, latency, a new failure mode) or maintaining a translated
copy that drifts from the source the tool is supposed to be showing honestly. Splitting the policy at the
authorship boundary — the app's own copy vs. content it merely surfaces — gets a consistent-feeling tool
without paying either cost.

**Apply next time:** for a tool that displays externally-authored content alongside its own UI, fix the
tool's OWN copy to one language, and explicitly decide (don't default by accident) that displayed/
surfaced content keeps its original language rather than being machine-translated on render.
