---
id: LESSON-0255
type: gotcha
domain: agent-tooling
tags: [claude-artifact, verification, viewport, charset, local-preview]
context: verifying an Artifact-authored HTML file (e.g. a blog-post preview) by serving the raw file directly with a local static server, before it goes through the platform's publish wrapper
trigger: use this when about to verify an Artifact HTML file's responsive/mobile layout or non-ASCII text by serving the raw file locally instead of the published/wrapped version
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-20 (agent-inferred) — an Artifact HTML file served raw over a local static server laid out at a ~980px virtual viewport (every max-width media query silently missed) and decoded as latin-1 (accented Spanish rendered as mojibake), because the publish step supplies <meta charset> and <meta name=\"viewport\"> that the raw file lacks"
provenance: agent-inferred
created: 2026-09-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0069]
---

**Situation:** an Artifact-authored HTML file was verified locally by serving the raw file with a static
server. The mobile layout check reported a bug that did not actually exist (every `max-width` media query
missed) and accented text rendered as mojibake — both false signals, because the platform's publish step
wraps the raw Artifact content in a skeleton supplying `<meta charset>` and
`<meta name="viewport" content="width=device-width…">`, which the raw file doesn't have on its own; without
them the browser defaults to a ~980px virtual viewport and latin-1 decoding.

**Lesson:** a raw Artifact HTML file is not faithfully representative of its published form — verifying it
directly (rather than the published/wrapped version) produces false-positive AND false-negative signals for
anything viewport- or encoding-dependent, a tooling-specific instance of trusting a stand-in over the live
artifact (LESSON-0069).

**Apply next time:** to verify an Artifact HTML file's responsive layout or non-ASCII text locally, wrap it
first in a minimal `<!doctype html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">…` skeleton before serving it — or check the actually-published artifact instead of
the raw file.
