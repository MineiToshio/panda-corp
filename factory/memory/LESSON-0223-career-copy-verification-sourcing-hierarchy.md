---
id: LESSON-0223
type: gotcha
domain: content-generation
tags: [career-copy, cv, linkedin, verification, sourcing, git-history]
context: drafting or reviewing CV/LinkedIn/career-narrative copy where a fact (an employer's tech stack, a skill, a technical-capability claim) cannot be verified from locally-cloned repos alone
trigger: use this when writing career/CV/LinkedIn copy and a fact can't be confirmed from the locally-cloned repos, or when a rewrite would use an industry buzzword (e.g. "agents") to describe a technical capability
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-12/2026-09-13 (owner-stated, 3 facets; agent-inferred, 1 facet), LinkedIn-rewrite and career-copy sessions — (1) for an employer role with no public detail, mine the project's own internal docs and the employer repos' git history before marking [FALTA DATO]; (2) absence of a tool in the site's cloned repos is not absence of experience (the owner used LangChain in a project that isn't cloned locally) — the owner's own word counts as a source for skills, don't remove one only because local repos don't show it; (3) when sources contradict on a career fact (figures, titles, dates), LinkedIn is the source of truth, and never assume a candidate lacks an experience (e.g. rich-text editor work) from memory — check the actual repos (package.json + git blame) first; (4, agent-inferred) before calling a feature 'agents' in career copy, grep the code for tool-calling-loop signatures (tools:, tool(, maxSteps, stopWhen) — a fixed structured-output pipeline with none of those is an overclaim a technical interviewer can catch."
provenance: owner-stated
created: 2026-09-13
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0128, LESSON-0120, LESSON-0069]
---

**Situation:** writing career/CV/LinkedIn copy repeatedly hit facts that couldn't be settled from what an
agent could directly inspect (a locally-cloned repo, its own memory of a technology) — leading to either
a wrongly-invented "gap" or a wrongly-invented "capability."

**Lesson:** career-copy verification has its own sourcing hierarchy, distinct from general code-verification
(LESSON-0069's "verify against the live artifact"): (1) when a repo isn't locally cloned, the owner's own
word IS a valid source for a skill/experience claim — don't remove or omit it just because local evidence
is silent; (2) for a role/period with no public detail, mine the project's own internal docs plus the
*employer's* repos' git history before declaring a fact missing; (3) when two sources of career fact
disagree (a case study's own numbers vs. LinkedIn, memory vs. an actual repo), LinkedIn is the tie-breaker
for career facts specifically, and a repo check (`package.json` + `git blame`) beats "I don't recall this
being used"; (4) before labeling a technical capability with an industry buzzword ("agents"), grep the
actual code for the mechanism the word implies (tool-calling loops: `tools:`, `tool(`, `maxSteps`,
`stopWhen`) rather than trusting the feature's marketing name — a fixed pipeline with none of those
signatures is an overclaim a technical reader will catch.

**Apply next time:** for career/CV/LinkedIn copy, treat "not found in a local repo" as insufficient
evidence of absence — ask the owner or check the employer's actual repos before marking `[FALTA DATO]` or
omitting a claimed skill; on any factual contradiction between sources, prefer LinkedIn; before using a
loaded technical term (agents, autonomous, etc.), grep for its defining mechanism in the actual code.
