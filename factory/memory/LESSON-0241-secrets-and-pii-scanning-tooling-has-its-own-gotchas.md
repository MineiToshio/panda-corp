---
id: LESSON-0241
type: pattern
domain: security
tags: [secrets-scanning, pii, gitleaks, publishing-checklist, corpus-validation, synthesis]
context: building or running any automated secrets/PII detection step (a pre-publish repo scan, a gitleaks-based redaction pass, a custom PII regex filter)
trigger: use this when standing up or auditing an automated secrets/PII scanning step — before flipping a repo public, before trusting a scanner's file-attribution output, or before freezing a regex-based detection rule set
source: "synthesized from LESSON-0201 (scan old repo for secrets before flipping public), LESSON-0231 (gitleaks findings map by file field not line number), LESSON-0232 (PII regex rules need corpus validation and masked-shape review) — all personal-page-v2, 2026-09-06..2026-09-13, agent-inferred. Single-project origin so far; awaits corroboration from a second project before activation (loop v2 anti-poisoning)."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0201, LESSON-0231, LESSON-0232]
---

**Situation:** across one project, three independent incidents hit the same underlying activity —
automated scanning for secrets/PII — from three different angles: deciding WHETHER to scan at all before
a repo-visibility change (LESSON-0201), attributing a scanner's findings back to the right unit when
scanning something other than one whole file (LESSON-0231), and validating a hand-written detection rule
set before trusting it (LESSON-0232). Each surfaced a distinct, non-obvious trap that a naive
implementation of "just run a secrets/PII scan" would hit.

**Lesson:** building or operating a secrets/PII scanning step has its own checklist, separate from
generic security thinking: (1) an owner's framing of a request ("it's old, just publish it") is a
judgment about relevance, not about contents — treat repo age/publish-routine-ness as orthogonal to
whether a scan is needed, and scan anyway (LESSON-0201); (2) when attributing a scanner's findings back to
a specific scanned unit (a turn, a chunk, a logical record) rather than a single whole file, don't rely on
line-number fields — they are fragile across tool versions; write one unit per file in a temp directory
and read the report's file-identity field instead (LESSON-0231); (3) never freeze a hand-written
detection rule set (regex for phone/card numbers, or any pattern written from memory/general knowledge)
without first running it against real project content and reviewing the MASKED shape of every match —
technical text (dates, versions, IDs) produces confident-looking false positives that only a real-corpus
pass reveals (LESSON-0232).

**Apply next time:** before shipping any secrets/PII scanning step, walk this three-point checklist: (a)
scan regardless of how routine the request sounds, (b) attribute findings by content identity, not by a
version-fragile line number, and (c) validate every detection rule against real corpus content with a
masked-shape review before trusting or freezing it. Treat a "quick regex for X" or "just gitleaks it" as
requiring the same rigor as any other verification tooling — an unvalidated scanner is worse than no
scanner if it produces false confidence.
