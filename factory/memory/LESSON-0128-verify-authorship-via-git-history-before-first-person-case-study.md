---
id: LESSON-0128
type: pattern
domain: content-generation
tags: [case-study, authorship, git-history, portfolio, first-person, verification]
context: drafting a first-person case-study narrative (portfolio, blog post) about a past project that had more than one contributor
trigger: use this when about to write or finalize first-person copy ("I designed...", "I decided...") attributing a technical decision to the author, for a project that was not solo-built
source: "personal-page-v2 .pandacorp/run/lessons.md (agent-inferred) — a case-study draft attributed 6 decisions to the author in first person; checking `git log --diff-filter=A` (who created each file) and per-file commit counts (who actually maintained it) showed 4 of the 6 were a teammate's work, not the author's"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0069]
---

**Situation:** a first-person case-study draft credited the author with six technical decisions on a
past project. A git-history check (`git log --diff-filter=A` for who created each relevant file, plus
per-file commit counts for who actually maintained it over time) revealed that 4 of the 6 decisions were
in fact a teammate's work — the draft's attributions came from memory/assumption, not from checking the
record.

**Lesson:** for any past, multi-contributor project, "I did X" is a factual claim with a checkable ground
truth (the commit history) — and memory/assumption about who owned which decision is unreliable even for
someone who was genuinely on the project, because perceived ownership drifts from actual authorship over
time. This is a case-study-specific instance of the broader "verify against the live artifact, not a
stand-in" family (LESSON-0069): here the stand-in is the writer's own recollection, and the live artifact
is the git log.

**Apply next time:** before finalizing any first-person claim in a case study or portfolio piece about a
multi-contributor project, check `git log --diff-filter=A -- <path>` (who created it) and commit counts per
file/area (who maintained it) for every decision being claimed in first person. Rewrite any claim the
history contradicts to the accurate voice (team-credited, or dropped) before publishing.
