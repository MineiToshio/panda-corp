---
id: LESSON-0171
type: gotcha
domain: testing
tags: [oracle, shell, code-generation, escaping, verification]
context: a test/oracle verifies a code-generating pipeline (a script that builds a shell command, a CLI invocation, a nested interpreter call) by comparing the GENERATED TEXT against an expected string
trigger: use this when writing a test/oracle for anything that generates a shell command or nested-interpreter code (e.g. a `node -e "..."` payload assembled by another script) rather than executing it end-to-end
source: "panda-corp R10/R11 certification work, 2026-07-12 inbox note (agent-inferred)"
provenance: agent-inferred
created: 2026-07-16
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a test oracle for a shell-command-generating pipeline only compared the GENERATED TEXT
against an expected string. Because both the generator and the oracle shared the same (buggy) escaping
assumption, the text-comparison passed while the command would have broken if actually run — especially
for nested interpreter code (e.g. a `node -e "..."` payload) where a `\n` embedded in a string can survive
generation as a literal newline that a real shell/interpreter parses very differently than the oracle's
string comparison implies.

**Lesson:** comparing generated TEXT against an expected string is not equivalent to proving the generated
artifact WORKS — a shared escaping/quoting bug between the generator and a text-only oracle is invisible to
both, because the oracle never exercises real shell/interpreter parsing. This is the same "mock speaks the
generator's own dialect by construction" class LESSON-0152 documents for prompt/parser contracts, applied
here to code-generation pipelines specifically.

**Apply next time:** when testing something that generates a shell command or nested-interpreter code,
don't stop at string comparison — execute the exact generated command end-to-end (or at minimum parse it
with the real target interpreter) in the test, with special attention to nested quoting layers (e.g.
`node -e` payloads inside a shell string) where an escaping bug is most likely to hide.
