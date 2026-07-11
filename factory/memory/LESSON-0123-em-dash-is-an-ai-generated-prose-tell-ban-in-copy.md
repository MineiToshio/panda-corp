---
id: LESSON-0123
type: pattern
domain: content-generation
tags: [ai-writing, style-guide, em-dash, prose, human-voice]
context: writing or reviewing site/product copy (UI strings, MDX pages, blog posts, metadata) that must read as human-written rather than generic AI-generated prose
trigger: use this when writing or generating any user-facing copy and deciding what punctuation/style rules keep it from reading as AI-generated
source: "personal-page-v2 docs/voice/style-guide.md 2026-07-09 (owner-stated) — the em dash (—) and en dash (–) as sentence-level separators are BANNED across all site copy (UI i18n, MDX, blog, metadata) as the single most reliable tell of AI-generated prose; replace with a period, colon, comma, or parentheses; a normal hyphen inside compound words and a middle-dot (·) as a structural eyebrow separator both remain fine; the rule also binds an automated blog-generator's drafts"
provenance: owner-stated
created: 2026-07-09
status: candidate
promotion: proposed
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0015]
---

**Situation:** an owner reviewing site copy identified the em dash (`—`) as the single most reliable
tell that a sentence was AI-generated, and banned it (along with the en dash `–` used as a sentence
separator) across every piece of visible copy — UI strings, MDX pages, blog posts, metadata — including
copy produced by an automated generator (e.g. a blog-draft pipeline), not just hand-written text.

**Lesson:** LLM-generated prose has a small set of recognizable stylistic tells (the em dash used as a
soft aside/pause is one of the most common), and a project that cares about copy reading as genuinely
human-written should treat these as a concrete, checkable style rule, not just a vague "sound more
natural" instruction. This is a specific, corroborating instance of LESSON-0015's broader "extract a
real voice, human-edit gate" pattern: LESSON-0015 covers the process (style guide + few-shot + human
gate); this lesson supplies a concrete, mechanically-checkable banned-token rule that can gate an
automated pipeline's output before it ever reaches the human edit step.

**Apply next time:** when a project's copy (human- or AI-drafted) needs to read as unmistakably human,
add an explicit, enforceable rule to the style guide banning the em dash (and en dash as a sentence
separator) as an AI-prose tell — substitute period/colon/comma/parentheses instead. Where an automated
content pipeline exists (e.g. a blog-generator), make this a mechanical check on its output (grep for
`—`/`–`), not just a written guideline a human might forget to apply.

**Proposed for promotion** (librarian, 2026-07-09): owner-stated, high confidence, mechanically checkable
(a grep-based verifier is trivial to write), and generalizes past the one project it was captured in —
any project's user-facing copy benefits from the same rule.

**Target:** `factory/standards/conventions.md` — add a SHOULD rule under a copy/content-voice section (new
or alongside "interaction style"): user-facing product copy should avoid the em dash / sentence-separator
en dash as a recognizable AI-prose tell, substituting period/colon/comma/parentheses; pair with an optional
grep-based doc-lint check for projects with an automated content pipeline.

**Rationale:** owner-stated is one of the two provenance tiers DR-047 treats as sufficient trust without
needing cross-project corroboration first; the rule is low-risk, deterministic, and easy for the owner to
approve or reject in one glance at `/pandacorp:learn`.
