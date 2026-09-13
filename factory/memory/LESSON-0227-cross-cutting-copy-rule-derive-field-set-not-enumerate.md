---
id: LESSON-0227
type: anti-pattern
domain: content-generation
tags: [copy-lint, derived-fields, schema-drift, oracle-coverage]
context: implementing an automated check (a lint rule, a seoLint-style guard) for a copy property (e.g. "no em-dashes") that should apply to every reader-facing text field of a growing content schema
trigger: use this when writing or auditing an automated check for a copy-quality rule (banned punctuation, tone, formatting) that is meant to apply across all reader-facing fields of a content schema
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-11 (agent-inferred, WO-08-006, 2 facets) — (1) LESSON-0123's em-dash-ban check (seoLint) enumerated its covered fields BY HAND (title/description/excerpt) and fell behind as the schema grew, silently letting coverAlt and tags (both reader-facing text) through with no check. The three sibling oracles in the same repo (contentParity.test.ts, messages.test.ts, coverAltCorpus.review.test.ts) all DERIVE their field set from the data structure instead and none had the gap. (2) When two layers judge the same property on the same copy, the upstream layer (the generator/linter) must cover AT LEAST what the downstream layer (the published-content oracle) covers, or the generator produces content the downstream layer rejects -- here coverAltCorpus.review.test.ts already banned dashes in coverAlt while seoLint did not, so seoLint's output could fail a later, stricter gate it should have caught first."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0123, LESSON-0077]
---

**Situation:** an em-dash-ban lint rule (`seoLint`) hand-listed the fields it checked (`title`,
`description`, `excerpt`). As the content schema grew, two more reader-facing text fields (`coverAlt`,
`tags`) went unchecked — while three sibling oracles in the same repo, which derived their field set from
the schema instead of listing it, never had this gap.

**Lesson:** a check meant to apply to "every reader-facing text field of a content type" degrades silently
the moment it's implemented as a hand-maintained field list — the list falls out of sync the instant the
schema gains a new text field, and nothing fails loudly to say so. The fix is the same principle
LESSON-0077 states for derived cross-cutting counts, applied to copy-linting: derive the set of fields to
check from the schema/type itself, don't enumerate it. A second, related discipline: when two independent
layers both judge the same copy property (an upstream generator/linter and a downstream published-content
oracle), the upstream layer must cover **at least** what the downstream layer covers — otherwise the
generator routinely produces output the stricter downstream gate rejects, which is strictly wasted work.

**Apply next time:** when building or auditing a cross-cutting copy-quality check, derive its field set
from the content schema/type definition rather than listing field names by hand; and when a stricter
downstream oracle already checks the same property on a field, make sure any upstream generator/linter
checks that field too, not a stale subset.
