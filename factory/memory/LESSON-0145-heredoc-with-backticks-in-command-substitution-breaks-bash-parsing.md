---
id: LESSON-0145
type: gotcha
domain: bash-scripting
tags: [bash, heredoc, command-substitution, parsing]
context: building a multi-line string via `$(cat <<EOF ... EOF)` (or similar) where the heredoc body contains backticks
trigger: use this when authoring a bash script or inline command that embeds a heredoc inside $() command substitution
source: "panda-corp 2026-07-11/12 factory memory inbox note, agent-inferred"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a script built a string with `$(cat <<EOF ... EOF)`; the heredoc body contained backticks
(for inline-code markdown). Bash parsed the backticks as a NESTED command substitution inside the outer
`$()`, breaking the script (wrong output, or a parse error) instead of treating them as literal
characters of the heredoc content.

**Lesson:** `$()` command substitution and backtick command substitution nest and interact even when the
backticks are semantically "just text" inside a heredoc — bash does not know the heredoc body is meant
to be inert. Any heredoc embedded inside `$(...)` is a parsing hazard the moment its content can contain
`` ` ``, `$(`, or `$`.

**Apply next time:** avoid nesting a heredoc inside `$()` when the heredoc body may contain backticks or
`$`. Prefer `IFS= read -r -d '' varname <<'EOF' ... EOF` (quoted delimiter disables all substitution
inside the heredoc, and reading into a variable avoids the outer `$()` entirely) or write the content to
a temp file and read it back, rather than capturing a heredoc's stdout through command substitution.
