---
id: LESSON-0107
type: anti-pattern
domain: data-seeding
tags: [seed-data, placeholder, bootstrap-content, invariant, content-authenticity, sequencing]
context: a placeholder/seed record was generated during a build to satisfy a system invariant (at least one published item) and got asserted elsewhere as if it were real author material, then could not simply be deleted because removing it would break that same invariant
trigger: use this when a build generates placeholder/seed content (a first blog post, a demo record, a bootstrap entry) to satisfy an "at least one X must exist" invariant
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-06/07 — FRD-05's seed post `content/blog/hello-world` was invented content (an AI-topic post with a code block), shipped `draft:false`, and the voice-guide extraction step (FRD-08) documented it as 'mirrored from the real reference post' — biasing the voice guide toward a register that was never the owner's; retiring it is blocked until the owner's real post (`welcome`) is published, because FRD-05 requires >=1 published post for the blog routes/RSS to render (tracked as the project's own `retire-fake-hello-world-seed` change, not a factory defect)"
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0015]
---

**Situation:** A build needs at least one real-looking record to satisfy an invariant before real content
exists (a blog needs >=1 published post for its routes/RSS to render; a demo needs >=1 seeded item). The
build generates a placeholder and, downstream, another step (here: voice-style-guide extraction, LESSON-
0015) treats that placeholder as genuine source material — because nothing marked it otherwise — and the
placeholder ships `published`/`draft:false` to satisfy the invariant, so it cannot be deleted the moment
real content is ready without re-breaking the very invariant it was created to satisfy.

**Lesson:** two distinct traps compound here: (1) a generated seed/placeholder record is invisible as a
placeholder to any LATER step that reads it as data (a style-guide extractor, a fixture consumer, a
metrics baseline) unless it is EXPLICITLY tagged as synthetic — never assert or document a placeholder as
"derived from the real thing"; (2) when a seed satisfies a structural invariant (>=1 published item), its
retirement is COUPLED to that invariant — it cannot be removed until a real record independently satisfies
the same invariant, so the removal must be sequenced strictly AFTER the real replacement is published, not
scheduled as an independent cleanup task.

**Apply next time:** when a build must generate placeholder/seed content to satisfy an "at least one X"
invariant: (a) tag it unambiguously as synthetic in its own metadata/docs (never claim it mirrors real
material); (b) treat any downstream step that could read it as ground truth (style/voice extraction,
analytics baselines, fixtures) as a risk surface and exclude the seed explicitly; (c) file its removal as a
change gated on "after the real replacement is published/created", not as a standalone task that could run
too early and re-break the invariant.
