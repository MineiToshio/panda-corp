---
id: LESSON-0204
type: anti-pattern
domain: content-generation
tags: [copywriting, first-person, biography, interview, sourcing, owner-feedback]
context: drafting first-person biographical/persona copy about the owner (an "About" page, a bio blurb, an identity claim) rather than a technical case-study narrative
trigger: use this when about to write or finalize first-person copy that makes a claim about who the owner IS or DOES (a trait, a habit, a current practice, a fact about their identity) — not a technical decision on a past project
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-07/08 (owner-stated, 3 corroborating corrections in the same About-page rebuild session): (1) the /about copy (How I work / The person / What I'm looking for) was drafted with agent judgment and the owner flagged it as 'doesn't reflect me, there are invented things'; (2) a content/about claim ('most people call me Sergio') directly contradicted an earlier fact-sheet ('Toshio to almost everyone') because neither had an owner-source attached, so the two self-contradicted; (3) the hero claimed 'I still write the hard parts myself' and the owner clarified today 90-95% of their code comes from AI orchestration — a first-person claim about CURRENT practice can't be deduced from old case studies, it has to be asked"
provenance: owner-stated
created: 2026-09-08
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0128, LESSON-0206]
---

**Situation:** across one About-page rebuild session, the owner corrected the same underlying mistake
three separate times: first-person copy about the owner's habits, preferred name, and current work
practice was drafted from the agent's judgment/inference (case studies, prior fact-sheets, plausible
narrative) instead of from something the owner actually said. One instance directly self-contradicted
across two documents because neither carried a source; another asserted a specific, checkable practice
claim ("I still write the hard parts myself") that was flatly wrong for the owner's actual current
workflow.

**Lesson:** LESSON-0128 already established that first-person claims about PAST decisions on a
multi-contributor project must be checked against the git record, not memory. This is the sibling case for
claims about the person themselves: there is no equivalent "record" to check — the only valid source is the
owner's own words, obtained by asking. Any biographical/identity claim the agent infers or reconstructs
(from an old case study, a prior draft, a plausible-sounding narrative) is invented until an owner
statement exists behind it, and invented facts don't just risk being wrong — they can silently contradict
each other across different documents/pages because nothing forces them to agree.

**Apply next time:** before drafting or finalizing any first-person claim about who the owner is or does
(a trait, a current practice percentage, a preferred name, a habit), interview the owner for it explicitly
— do not infer it from case studies, prior copy, or what "sounds right." Keep a gitignored source dossier
with one `[source]` annotation per claim (see LESSON-0206 for the fuller workflow this feeds into) so
claims stay traceable and cross-document contradictions surface before publishing, not after.
