---
id: LESSON-0214
type: pattern
domain: content-generation
tags: [persona-copy, case-study, portfolio, ai-writing, verification, red-team, synthesis]
context: planning or reviewing the end-to-end workflow for AI-drafted first-person copy that represents a real owner (portfolio, about page, case studies, blog)
trigger: use this when kicking off or reviewing an AI-authored persona/case-study copy workflow that will make first-person claims about a real owner, before treating any single sub-check (voice, authorship, tone, positioning, AI-tells) as sufficient on its own
source: "synthesis over personal-page-v2's content-generation cluster, harvested across three separate sweeps (2026-06-30, 2026-07-09/10, 2026-09-08): LESSON-0015, LESSON-0123, LESSON-0128, LESSON-0129, LESSON-0130, LESSON-0202, LESSON-0204, LESSON-0205, LESSON-0206 — 9 evidence-anchored lessons on the same underlying task (AI drafts copy that speaks AS the owner) each catching a DIFFERENT failure mode of that task"
provenance: agent-inferred
created: 2026-09-08
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0015, LESSON-0123, LESSON-0128, LESSON-0129, LESSON-0130, LESSON-0202, LESSON-0204, LESSON-0205, LESSON-0206]
---

**Situation:** across personal-page-v2's build, nine separate incidents landed on the same underlying
task — an AI agent drafting first-person copy that represents a real person (case studies, an about
page, a portfolio, blog posts) — and each caught a genuinely different way that task fails: a voice
guide extracted from a fabricated seed post (LESSON-0015), the em dash as an AI-prose tell (LESSON-0123),
decisions credited to the wrong contributor (LESSON-0128), copy that leans on cleverness or repeats the
same "I'd do it differently" confession (LESSON-0129), ordering that under/over-states capability
(LESSON-0130), screenshot/photo assets that leak sensitive data or crop badly (LESSON-0202), invented
biographical claims never confirmed by the owner (LESSON-0204), positioning that drops either the
hand-coding or the AI-orchestration pole (LESSON-0205), and AI-tell signals that survive to shipping
without an explicit checklist gate (LESSON-0206). No single one of these lessons, read alone, would have
caught the others — they are siblings of one task, not one bug.

**Lesson:** "AI writes copy that speaks as a real person" is not one check, it is a small pipeline with
distinct failure surfaces at each stage — treating it as satisfied by any single sub-lesson (e.g. "I
banned the em dash, so the copy is fine") is a false sense of coverage. The stages, in order: (1)
**source-of-truth** — ground every factual/biographical claim in owner-confirmed input (interview,
verified git history), never invent or infer it (LESSON-0204, LESSON-0128); (2) **voice** — extract
style from the owner's REAL writing, never a synthetic seed (LESSON-0015); (3) **positioning** — keep
every relevant capability pole visible, don't let the narrative drop one to flatter another
(LESSON-0130, LESSON-0205); (4) **taste** — concrete over clever, restrained self-critique, explained
jargon (LESSON-0129); (5) **assets** — screenshots/photos cropped, redacted and sized deliberately, not
lifted raw (LESSON-0202); (6) **AI-tell sweep** — a named checklist (em dash and other punctuation
tells, contractions, impersonal aphorisms) run explicitly before the content gate, not assumed
(LESSON-0123, LESSON-0206).

**Apply next time:** when planning or reviewing a persona/case-study copy workflow, walk the six stages
above as a checklist rather than trusting that fixing one failure mode covers the task; open the linked
lessons for the concrete rule at each stage. If a new project's content pipeline is caught by only ONE
of these lessons in isolation, treat that as a signal to check the other five stages too, not as
evidence the pipeline is sound.
