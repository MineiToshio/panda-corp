---
id: LESSON-0569
type: gotcha
domain: testing
tags: [reader, parser, dr-078, synthetic-fixture, fail-loud]
context: writing or reviewing tests for a new reader/parser of an internal artifact (a markdown file, a status file) using only hand-invented fixtures, before running it against the real file(s) it will actually parse
trigger: "use this when a new reader/parser test suite is all green against invented fixtures — before calling the reader verified, run it against every real instance of the artifact on disk"
source: "mission-control .pandacorp/run/lessons.md 2026-10-31 (agent-inferred) — a reader test built entirely from invented fixtures passed green, but hid that the reader mis-parsed the LIVE decisions.md: an undated heading was silently skipped and its Estado line was mis-attributed to the block above, because no invented fixture happened to exercise that exact real-world shape"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a new reader for `.pandacorp/inbox/decisions.md`-style content was tested exclusively
against hand-invented fixtures and passed green. The live `decisions.md` file, however, contained a shape
none of the invented fixtures happened to cover — an undated heading — which the reader silently skipped,
causing its `Estado` line to be mis-attributed to the PRECEDING dated block instead of being recognized as
its own pending entry. The bug was invisible to the test suite because every fixture the suite used was
authored by the same person who wrote the reader, with the same mental model of what "a decisions.md file
looks like" baked into both.

**Lesson:** this is a concrete instance of the project's own DR-078 rule ("test a reader against a REAL
production-shaped fixture, not only an invented one") — the invented-fixtures-only suite is a
characterization suite over the author's own assumptions (the LESSON-0074 family: green answers "does
this match what I think the shape is", not "is this correct against what actually exists"). A real file
accumulates shapes no one fixture-author anticipates (an undated heading, in this case), and only reading
the real file surfaces them.

**Apply next time:** before calling a new reader/parser "verified," run it against every REAL instance of
the artifact currently on disk (not just invented fixtures), and diff its output against what a human
reading that real file would expect. A reader whose only tests are invented fixtures has proven it matches
its own author's mental model, not that it correctly parses what actually exists.
