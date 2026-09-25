---
id: LESSON-0251
type: pattern
domain: content-generation
tags: [copywriting, narrative-structure, blog, headings, argument-arc, red-team]
context: drafting or reviewing a blog post's narrative structure (its argument arc, its section headings, its illustrative examples) before it ships
trigger: use this when finalizing an AI-drafted blog post's structure — heading phrasing, example questions/illustrations, and how a later safeguard/complication is justified relative to an earlier stated problem — before the content gate
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-20, 3 owner-stated findings from one blog-post draft review (the AI-direction post): (1) 3 of 4 illustrative example questions assumed domain context the reader didn't have; the ones that worked were about cross-cutting state invisible to a single session; (2) a '##' heading phrased as a how/what-for question ('¿Para qué sirve X?') presupposed X had already been introduced, when the prior section never mentioned it — the reader fell off a cliff; (3) a later safeguard (human review gates) was justified by restating the SAME symptoms the earlier solution (documentation/rules) was introduced to fix, reading as self-contradiction ('¿para qué me he matado documentando?') instead of naming the RESIDUAL risk the safeguard actually covers"
provenance: owner-stated
created: 2026-09-22
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0206, LESSON-0214, LESSON-0221, LESSON-0263]
---

**Situation:** a blog post drafted by an AI writer can pass every prose/voice/AI-tell check (LESSON-0206)
and still fail on narrative structure: illustrative examples that assume context the reader doesn't have, a
heading that presupposes something not yet introduced, or a later complication justified by restating the
very problem the piece already claimed to solve. Three such failures surfaced across one draft review of
the same post.

**Lesson:** narrative coherence is a distinct checklist from voice/AI-tell (LESSON-0206) and
content-rules-per-format (LESSON-0221/LESSON-0224) — it needs its own pass, checking: (1) **example
self-containment** — any illustrative question/example in the prose must be answerable with ZERO domain
context; if it requires knowing an internal field name, a former employer's product terminology, or a prior
unstated decision, it fails, while examples about cross-cutting state genuinely invisible to a single
session (a stale decision, drift from a stated objective, a regression) work as intended; (2) **heading
presupposition** — a "how/what-for" heading ("¿Para qué sirve X?") presupposes X was already introduced in
a prior section; if it wasn't, rephrase to a "why" heading ("¿Por qué hacemos X?") that introduces X while
justifying it, rather than reformulating the same presupposing question; (3) **safeguard justification must
name the residual risk** — when a piece's arc is "problem P → solution S" and later introduces a safeguard,
that safeguard must be justified by the risk S left OVER (a genuinely different class of failure), never by
restating P unchanged, which reads as an admission that S didn't work.

**Apply next time:** before shipping an AI-drafted post with an argument arc, run this narrative-coherence
checklist alongside (not instead of) the AI-tell red-team (LESSON-0206): every example is
zero-context-answerable, every "how/what-for" heading follows a section that already named its subject, and
any safeguard introduced after a solution is justified by the residual risk, not the original problem.

**Fourth facet, corroborated 2026-09-24 (owner-stated, same post, a later review pass) — anecdote
placement:** an anecdote about the method FAILING must sit where the post has already predicted its
failure class, and must be explicitly labelled as an instance of that class. The AI-direction draft named 2
residual causes of error, then told an "the AI built the opposite of the plan" failure story AFTER the
human-gates paragraph, tied to neither named cause — so it read as the very "error from not knowing" the
post had just claimed to eliminate, undermining 3 sections of argument. Moving the anecdote directly under
the bullet it illustrates, and opening it with a phrase that ties it explicitly to that bullet, turned a
self-contradiction into supporting evidence. **Principle: a PREDICTED exception strengthens an argument, an
unpredicted one undermines it — never cut the counter-example, place it immediately after its own
prediction, labelled as that prediction's instance.** Add this as a 4th checklist item: (4) **anecdote
placement** — any failure-mode anecdote must appear directly after the passage that predicted that failure
class, explicitly tied to it, not floating loose or placed after an unrelated later section.
