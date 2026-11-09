---
id: LESSON-0646
type: gotcha
domain: git-workflow
tags: [merge-conflict, contract-test, regression, docs]
context: resolving a merge/rebase conflict in a doc or skill-reference file that a contract test asserts specific literal phrases/strings in
trigger: use this when resolving a merge conflict in a file that a test (e.g. a "contract" test asserting literal strings/phrases) checks the content of, before assuming the resolution preserved everything the test depends on
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (agent-inferred): a conflict resolution silently dropped contract phrases that franchiseBackfillContract.test.ts asserted in skill references, discovered only by re-grepping the contract test's expected strings after the resolution"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0548]
---

**Situation:** resolving a merge/rebase conflict in a doc/skill-reference file removed (or rewrote) a
specific phrase that an existing contract test (`franchiseBackfillContract.test.ts`) asserted must be
literally present. The conflict resolution looked reasonable by eye — it kept the file coherent and
readable — but it broke the test, which was only caught after someone deliberately re-grepped the
contract test's exact expected strings against the resolved file.

**Lesson:** a human/agent resolving a text conflict optimizes for "this reads correctly and makes sense,"
not for "this still contains every literal substring some test elsewhere depends on" — those are
different success criteria, and a conflict resolution that satisfies the first can silently fail the
second with no visual signal in the diff itself (the phrase is just gone, nothing looks "wrong").

**Apply next time:** after resolving ANY merge/rebase conflict in a file that a contract/assertion test
checks the literal content of, grep that test's expected strings against the resolved file before
considering the conflict closed — don't rely on running the full test suite alone to catch it later (it
will, but re-grepping immediately is cheaper and catches the regression at the exact point it was
introduced, not several steps downstream).
