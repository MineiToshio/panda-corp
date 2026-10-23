---
id: LESSON-0031
type: gotcha
domain: build-engine
tags: [control-characters, permissions, workflow-tool, encoding, gate]
context: using a literal control character (e.g. NUL) as a sentinel value inside a committed source file
trigger: use this when a script needs a sentinel/placeholder byte value for a regex or string-transform (e.g. a glob-to-regex converter) rather than a printable escape sequence
source: "panda-corp build engine, fixed 2026-07-02 — plugin v9.46.2, overlay 8.55.2, commit 17937f1"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: high
times_applied: 1
applied_in: [mission-control]
links: []
---

**Situation:** the build engine's `globToRe` helper used 2 literal NUL bytes as a sentinel inside the
committed JS source. The Workflow tool's permission dialog rejects scripts containing raw control
characters, so every `/implement` run silently failed to launch — a total outage traced back to two
invisible bytes in a template file.

**Lesson:** never embed a raw control character (NUL or otherwise) directly in committed source,
even as an internal sentinel invisible in a normal diff view — a downstream permission/security layer
(here, the Workflow tool's script-permission dialog) can reject the whole file, and the failure mode
is opaque (nothing launches, no clear error pointing at the bytes). The fix is to use the language's
textual escape sequence (e.g. the four-character sequence backslash-u-0-0-0-0) instead of the raw byte. A second gotcha compounds this: writing
that escape sequence AS TEXT inside a JSON-carrying tool call can get re-decoded back into the real NUL
byte by the JSON layer — verify the actual bytes on disk (e.g. `xxd`/`od`), not just the source text as
typed.

**Apply next time:** grep committed source for raw control-character bytes (not just NUL) before
trusting a template that manipulates strings byte-by-byte; use textual escape sequences instead of raw
bytes for any sentinel; after applying such a fix via a tool that carries JSON, verify the actual
on-disk bytes rather than assuming the escape sequence survived.
