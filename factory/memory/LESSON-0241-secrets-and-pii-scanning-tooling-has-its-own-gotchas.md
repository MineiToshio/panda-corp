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
status: active   # 2026-11-18 librarian eval-gate: facet 4 (funko-tracker, 2026-10-21/22) already
  # cross-corroborated this pattern across 2 distinct projects (personal-page-v2 origin +
  # funko-tracker) with no contradicting evidence — missed at the time it was added; activated now.
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0201, LESSON-0231, LESSON-0232, LESSON-0494, BL-0279]
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

**Fourth facet — a text/secrets scanner does not cover embedded third-party IP in binaries, and a
documented launch dependency is not self-enforcing (funko-tracker, 2026-10-21/22, `.pandacorp/run/
lessons.md`, agent-inferred):** before flipping a repo from private to public, a full history secrets scan
(`gitleaks git --log-opts=--all`, not just the current tree) was run — but the repo also carried ~1,900
committed mock/prototype screenshots that embed official THIRD-PARTY photos and logos, which no secret
scanner (gitleaks or otherwise) is designed to flag at all; that class of exposure is only caught by
treating tracked BINARY/image assets as their own review surface, separate from text-pattern scanning. The
project's own `architecture.md` had already listed "purge screenshots before any public repo" as an
explicit launch dependency — the repo was made public without re-reading that document first, i.e. the
documented dependency existed but nothing forced re-checking it at the moment of the actual visibility
change (the same class as LESSON-0113: a documented trigger is a proposal, not evidence it's enforced).
**Apply next time (addition):** before any repo-visibility change, in addition to the three-point checklist
above, (d) scan ALL git history, not just the current tree (`--log-opts=--all` or equivalent), (e) treat
tracked binaries/images as a distinct review pass for embedded third-party IP (trademarked logos, stock
photos, screenshots of other products) that no text-based secrets scanner will ever catch, and (f) explicitly
re-read the project's own already-documented "launch dependencies" (architecture.md, ADRs) as a required
step of the visibility-change action itself, not something assumed already handled because it was written
down once. See also LESSON-0494 (a related but distinct privacy gotcha: a design-freeze capture pass
rendering real data on a public repo) and BL-0279 (the actionable release-flow checklist gap this surfaced).

**Fifth facet — a secrets scanner's own detection rules produce false positives on long PROSE strings,
not just on code (funko-tracker, 2026-11, `.pandacorp/run/lessons.md`, agent-inferred):** gitleaks'
`generic-api-key` rule (a heuristic over high-entropy-looking assigned strings) flagged long descriptive
prose "reason" strings inside e2e JSON test-case inventories and review markdown docs (e.g. a bug-card or
work-order rationale sentence assigned to a `reason:`/`"reason"` field) as if they were a leaked API key —
not because they contain a secret, but because a long enough quoted string after an assignment-shaped key
trips the entropy/shape heuristic regardless of content.
**Apply next time (addition):** when gitleaks (or a similar regex/entropy-based scanner) flags a
long descriptive-prose string assigned to a generic key-shaped field, do NOT reach for an allowlist
entry first (that permanently blinds the scanner to that exact string shape, including a future real
secret landing in the same field) — rephrase the prose (shorten it, or move it out of a bare
key:"value" shape, e.g. into a markdown bullet or a differently-named field) so the false positive
disappears without weakening the scanner's actual coverage.
