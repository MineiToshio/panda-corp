---
id: LESSON-0335
type: pattern
domain: content-generation-qa
tags: [spoiler-safety, progressive-disclosure, ai-content, mechanical-validation, briefing]
context: validating AI-generated or AI-rewritten text for a system where content is progressively revealed (spoilers, episodic unlocks, graded disclosure) and a leak means revealing something ahead of its gate
trigger: use this when generating, rewriting, or briefing AI-written content for a progressively-revealed/gated system (spoiler-sensitive demo content, episodic unlocks, staged disclosure) and deciding how to catch leaks before a human review pass
source: "pandasaga .pandacorp/run/lessons.md 2026-10-13/14 (agent-inferred, three related findings on the same project): (1) a mechanical sweep (every route x every progress point x each new name/term against its first eligible chapter) caught a lead naming a group one chapter early that flowed/reviewers had missed; (2) a brief stating a boundary ambiguously ('the visit does not happen within the book') produced three writers' paraphrases that were all false and spoiler-y for a book reviewed only partway through its total length; (3) mechanically-rewritten story text stayed spoiler-safe when checked against fixed invariants (same link tokens, no new capitalized names, length-ratio bounds, max emphasis spans), with only flagged keys needing a human look"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** three related problems surfaced while generating demo content for a progressively-
revealed, spoiler-sensitive catalog: a flowing/human review missed an early name-leak that a mechanical
term sweep caught; an ambiguous boundary in a content brief ("does not happen within the book") let three
independent writers each produce a differently-worded but equally spoiler-y paraphrase, because none of
them knew the book's reviewed coverage was shorter than its total length; and mechanically rewritten
story text needed a cheap, repeatable way to confirm it preserved required invariants without a full
human re-read of every variant.

**Lesson:** for any content pipeline where disclosure is gated by progress/chapter/stage, prose/flow
review alone is not reliable enough to catch leaks — a human reading for "does this flow" is not reading
for "does this reveal X before gate Y." Three concrete, reusable techniques close this gap cheaply: (1) a
MECHANICAL sweep — every output route × every progress/gate point × each new name/term checked against
its first eligible unlock — catches leaks review missed; (2) when briefing a content generator about a
boundary, state it as two numbers (total length vs. reviewed/eligible coverage), not a qualitative
phrase — ambiguous phrasing lets a generator (human or AI) infer beyond the actual boundary, and a
mechanical "never-allowed phrases" list is cheap insurance; (3) when text is REWRITTEN rather than newly
generated, validate it against a short list of fixed invariants (the same link/reference tokens present,
no new capitalized names introduced, a length-ratio bound, a cap on new emphasis), which flags only the
few genuinely risky cases for a human look instead of re-reading everything.

**Apply next time:** for any gated/progressively-revealed content system, run a mechanical term/route/
gate-point sweep after generating or ingesting new content (not just a prose review); state scope
boundaries to content briefs/writers as explicit coverage numbers rather than qualitative phrasing, and
maintain a never-allowed-phrase list; and for AI rewrites specifically, define and check a short set of
structural invariants before trusting the rewrite is as safe as the original.
