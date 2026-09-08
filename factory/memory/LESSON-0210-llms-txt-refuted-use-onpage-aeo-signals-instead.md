---
id: LESSON-0210
type: library-verdict
domain: seo
tags: [llms.txt, aeo, seo, answer-engines, faq-schema]
context: deciding whether to invest effort in an `llms.txt` file or FAQ schema markup as an AI-answer-engine-optimization (AEO) tactic for a site
trigger: use this when evaluating whether to add llms.txt or FAQ schema as an AEO/SEO tactic
source: "personal-page-v2 scratchpad research (blog-generator v2 spike), .pandacorp/run/lessons.md 2026-09-07, agent-inferred, citing Google's Mueller (2026-06-02: 'none of the AI systems use it') and Illyes (no plans to support it), plus server-log evidence (97% of files served with zero AI-bot requests); contrasting AEO evidence citing Indig's analysis (18k ChatGPT citations, Feb 2026) showing FAQ schema correlates with FEWER citations, while answer-in-first-30%, H2-question-with-answer-below, and definitional phrasing correlate with more"
provenance: agent-inferred
created: 2026-09-08
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** `llms.txt` is a proposed convention (an `robots.txt`-style file listing content for AI
crawlers) that gained adoption hype but has been explicitly disclaimed by Google (Mueller, Illyes) as
unused by any AI system, corroborated by server logs showing ~97% of files getting zero AI-bot requests.
Separately, FAQ schema markup — a common on-page AEO tactic — was found in a citation-count analysis to
correlate with FEWER AI-answer-engine citations, not more.

**Lesson:** both `llms.txt` and FAQ schema are commonly recommended AEO tactics with actual evidence
pointing the opposite direction from their reputation — one is unused infrastructure, the other
anti-correlates with the outcome it is supposed to help. The evidence that DOES correlate with more
citations is about on-page content structure, not markup: placing the direct answer within the first ~30%
of the content, using an H2 phrased as a question with the answer immediately below it, and using clear
definitional phrasing.

**Apply next time:** do not invest AEO effort in `llms.txt` or FAQ schema expecting a citation-rate payoff
— re-verify each against current evidence before adopting, since this space moves fast. Prioritize on-page
structure instead: put the direct answer early (first ~30% of the content), use question-phrased H2s with
the answer immediately following, and favor clear definitional sentences over cleverness.
