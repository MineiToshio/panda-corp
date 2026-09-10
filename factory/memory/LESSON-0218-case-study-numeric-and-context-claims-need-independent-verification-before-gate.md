---
id: LESSON-0218
type: pattern
domain: content-generation
tags: [case-study, verification, circular-source, invented-detail, owner-gate, portfolio]
context: a case-study or portfolio draft includes a numeric claim (a metric, a count) sourced from the case's own prior write-up, or a process detail added because a rewrite pass asked for "more context"
trigger: use this when a case-study/portfolio draft cites a number whose only source is the case's own earlier material, or when a rewrite pass is asked to add context and produces plausible-sounding process detail
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-09, agent-inferred (2 incidents, same session): (1) a case study's '70+ section types' claim traced back only to the case file itself (circular) while the live repo showed the owner's engine covers 16, the other ~56 being teammates' renderer types; (2) a round-3 verifier caught 4 factual claims a rewrite agent invented from plausible inference when asked for context (a time budget per step, a failure-mode description, a claim about tooling not existing yet at the time)"
provenance: agent-inferred
created: 2026-09-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0069, LESSON-0128, LESSON-0204, LESSON-0214]
---

**Situation:** two distinct incidents in the same case-study rewrite pass shared one root cause. First, a
numeric claim ("70+ section types") that read as authoritative was traced to its only source — the case
study's own earlier draft — a circular reference with no independent grounding; the live repository showed
the true, verifiable split (16 owned by the person, ~56 by teammates). Second, when a rewrite agent was
asked to add "context" to a decision, it produced plausible but UNSOURCED process detail (a time budget, a
failure mode, a claim about what tooling existed at the time) that a later verification pass caught only
because it ran independently against evidence, not because the claim looked suspicious on its face.

**Lesson:** both failures are the same shape as LESSON-0069's "stand-in for ground truth" family, applied
specifically to case-study content generation: a number that is "already published" (even by the same
author, in the same case study) is not thereby verified — it is a secondary source pointing back to
itself; and a vague instruction like "add more context" is an invitation for a writer to invent plausible
detail rather than admit it lacks evidence for it. Both need the same fix: an independent verification pass
against primary evidence (the live repo, the owner's direct confirmation), run BEFORE the content reaches
the owner's human gate, not discovered after.

**Apply next time:** for any numeric or process claim in AI-drafted case-study/portfolio copy, trace it to
a source OTHER than the case study's own prior text (the live codebase, an owner interview, an external
verifiable record) before it ships; if no independent source exists, cut the claim or mark it explicitly
unverified — never publish a guessed or circularly-sourced number. Run the independent verifier as a
mandatory step BEFORE showing the owner a draft for approval, not as an optional check after. Treat every
sentence added in response to a vague "add context"/"expand this" instruction as needing its own citation,
the same discipline LESSON-0204 already applies to biographical claims.
