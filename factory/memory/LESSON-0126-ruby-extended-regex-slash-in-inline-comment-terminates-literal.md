---
id: LESSON-0126
type: gotcha
domain: platform-tooling
tags: [ruby, regex, extended-mode, parsing, gotcha]
context: authoring a Ruby (or Perl) regex literal in extended mode (/x) that carries inline # comments
trigger: use this when writing or debugging a Ruby/Perl regex literal in extended (/x) mode and an inline comment needs to mention a path, fraction, or anything containing a forward slash
source: "panda-corp — validate-memory.sh MEM-1 anchor regex authoring, 2026-07-09, factory/memory/_inbox.md; see plugin/scripts/validate-memory.sh's ANCHOR regex and its comments"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** while authoring `validate-memory.sh`'s `ANCHOR` regex (a Ruby `/x`-flagged pattern with
inline `#` comments documenting each alternative), a comment that itself contained a `/` (e.g. describing
"a factory/project id") terminated the regex literal early — Ruby raised `unknown regexp options` at parse
time, a confusing error that does not point at the comment as the cause.

**Lesson:** in Ruby's (and Perl's) extended/free-spacing regex mode (`/x`), an unescaped `/` appearing
inside an inline `#` comment is NOT inert — the comment is not a separate lexical context, so the parser
still sees the `/` as the literal's closing delimiter and stops there. The rest of the intended pattern
becomes trailing content, which Ruby then tries to parse as regexp options, producing an opaque
`unknown regexp options` error far from the true cause (the comment text, not the pattern logic).

**Apply next time:** when writing a `/x`-mode regex with inline comments, never put a literal `/` in a
comment — rephrase ("a factory or project id" instead of "factory/project id") or avoid slash-bearing
examples entirely. If `unknown regexp options` (or an equivalent "trailing garbage after regex" error)
shows up while editing an `/x` pattern, first grep the comments for a stray `/` before suspecting the
pattern's actual alternatives. For patterns non-trivial enough to need `/x` and comments, consider building
the string in a file rather than an inline `ruby -e` one-liner, so the error's line number is meaningful.
