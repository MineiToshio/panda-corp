---
id: LESSON-0122
type: gotcha
domain: content-rendering
tags: [mdx, content-collections, structured-content, i18n, runtime-throw]
context: a content-collections/MDX page whose renderer splits the compiled body by heading and maps each resulting section to a fixed, index-based i18n label (an eyebrow, a step number)
trigger: use this when a page's MDX/Markdown content is split into sections by an index-based mapping to a fixed set of i18n labels (eyebrows, step numbers) rather than rendered as free-flowing prose
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-09 — content/about/*.mdx requires EXACTLY 3 '## ' sections with zero text before the first heading, or the splitAboutSections helper throws at runtime (ABOUT_SECTION_COUNT); the 3 sections map by array index to 3 fixed i18n eyebrows (01·Professional/02·Personal/03·Ways of working) (agent-inferred)"
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0106]
---

**Situation:** a page renders MDX content by splitting the compiled body into per-`##`-heading
sections, then mapping each section to a fixed, positional label (an i18n eyebrow, a step number) —
e.g. section index 0 always gets "01·Professional", index 1 always gets "02·Personal", etc. The
splitting helper enforces an exact section count and zero preamble text (throwing at runtime otherwise),
but this contract lives only in the helper's code/constant (e.g. an `ABOUT_SECTION_COUNT` check), not in
the MDX content file itself.

**Lesson:** this is a sibling gotcha to LESSON-0106 (compiled MDX is flat, so grouping-by-section
requires an explicit split/wrap step) — but the NEW trap here is that a positional/count contract
enforced entirely in code is invisible to whoever edits the MDX content later (an owner doing a
copy-truth pass, a future agent). Editing an MDX file to add, remove, or reorder a `## ` heading (or add
text before the first heading) silently breaks the page at runtime with no compile-time signal from the
content file itself.

**Apply next time:** when a renderer imposes a positional/count contract on MDX sections (exact count,
no preamble, index-mapped labels), document that contract with an explicit comment at the TOP of every
MDX file under the contract (e.g. `{/* Exactly 3 "## " sections required, mapped by order to
Professional/Personal/Ways-of-working — do not add/remove/reorder */}`), not only in the helper code —
so a content-only edit surfaces the constraint before it breaks at runtime. Prefer a build-time/lint
check over a runtime throw if the framework allows it.
