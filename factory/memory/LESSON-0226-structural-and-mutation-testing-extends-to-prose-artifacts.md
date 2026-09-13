---
id: LESSON-0226
type: pattern
domain: testing
tags: [structural-test, mutation-testing, prose, skill-verification, fail-loud]
context: writing or auditing a test/verifier for a document with structured content (a frontmatter table, a SKILL.md's procedural steps) rather than for code
trigger: use this when writing a test/oracle for a markdown document with a table or a procedural structure (a SKILL.md, an FRD table, a rules doc), or when deciding whether mutation testing applies beyond code
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-11 (agent-inferred, 3 facets, WO-08-008) — (1) a structural test over a document with a table/frontmatter must PARSE the structure, not grep the whole document: nearby prose repeating the rule made a grep-based test pass while the table itself lied — caught via a surviving mutation; (2) verifying a SKILL.md with a purpose-built fail-loud reader (treating its sections as stable identifiers, and checking that each named function it references actually exists as an export) turns the instructions into an executable contract and blocks doc-vs-code drift; (3) the mutation-testing pass itself works on prose artifacts, not just code — mutating the INSTRUCTIONS (skip a gate, reorder stages, cite a nonexistent AC) is the only evidence that the structural oracle actually bites, the same discipline as mutating code to prove a unit test isn't vacuous."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0113]
---

**Situation:** auditing a doc with a rule encoded in a table (or a SKILL.md's procedural steps) with a
grep-based or narrative-only test let a real content bug through, because nearby prose repeated the rule
correctly while the actual structured data (the table row, the referenced function) was wrong.

**Lesson:** the same rigor code testing demands applies to structured prose artifacts: (1) a test over a
document with a table/frontmatter must **parse** that structure and assert against the parsed fields —
grepping the whole document lets correct-sounding nearby prose mask a lying table row; (2) a SKILL.md (or
similar procedural doc) can be given a purpose-built fail-loud reader that treats its sections as stable
identifiers and checks that every function/export it names actually exists in the codebase, turning
narrative instructions into an executable, drift-detecting contract; (3) mutation testing is not
code-only — mutating a document's own instructions (skip a mandated gate, reorder stages, cite an AC that
doesn't exist) is the only real evidence a "structural" oracle over prose actually catches a broken
instruction, exactly the same discipline used to prove a unit test isn't vacuous.

**Apply next time:** when writing a test/verifier for any document with parseable structure (tables,
frontmatter, named procedural steps referencing real code), parse the structure rather than grepping
prose, and mutation-test the document's own instructions (not just the verifier's code) before trusting
the oracle bites.
