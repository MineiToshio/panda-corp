---
id: LESSON-0208
type: gotcha
domain: data-processing
tags: [claude-code, jsonl, transcripts, privacy, cost, extraction]
context: building a pipeline that reprocesses Claude Code session transcripts (`~/.claude/projects/**/*.jsonl`) as input material (e.g. for a content/blog generator, an analytics tool)
trigger: use this when a pipeline needs to read Claude Code's own `~/.claude/projects/**/*.jsonl` transcript files as source data
source: "personal-page-v2 scratchpad research (blog-generator v2 spike), .pandacorp/run/lessons.md 2026-09-07, agent-inferred, measured against a 2.6GB local transcript corpus"
provenance: agent-inferred
created: 2026-09-08
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a spike measured the composition of a 2.6GB local Claude Code transcript corpus
(`~/.claude/projects/**/*.jsonl`): only ~2.3% of bytes was human+assistant prose; ~22% was base64-encoded
screenshot data; ~50% was JSON scaffolding/tool-call structure. A `toolUseResult` sibling field duplicates
the paired `tool_result` entry (double-counting risk if both are read). This harness (the current Claude
Code version at time of testing) emits zero `type: summary` entries — that field cannot be relied on as an
extraction shortcut. A `custom-title` field is present on only ~37% of sessions.

**Lesson:** the raw transcript JSONL is overwhelmingly non-prose by volume — screenshots and tool-call
scaffolding dominate the byte count by roughly 30:1 over actual conversation text. A pipeline that reads
these files naively (e.g. loading whole entries, or double-counting the `toolUseResult`/`tool_result` pair)
pays a large, avoidable cost and privacy-surface penalty for content it will discard anyway.

**Apply next time:** when building anything that reads Claude Code transcripts as source material, extract
ONLY the `user` string content and `assistant` text blocks up front — this single filter both cuts corpus
size by ~98% (the cost lever) and strips embedded screenshots/tool payloads (the privacy lever) in one
pass. Do not rely on `type: summary` or `custom-title` as a universal shortcut — verify their presence rate
on the actual harness version in use before depending on them. De-duplicate `toolUseResult`/`tool_result`
pairs before counting or sampling.
