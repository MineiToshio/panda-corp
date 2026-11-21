---
id: LESSON-0708
type: gotcha
domain: tooling
tags: [transcripts, permissions, allowlist, bash, parsing]
context: scanning historical Bash-transcript JSONL for command-frequency statistics (e.g. to propose a `fewer-permission-prompts`-style allowlist) by naively splitting each recorded command on `&&`/`;`/`|` and taking the leading token as "the command"
trigger: use this when building a command-frequency ranking from recorded Bash invocations to seed or audit a permission allowlist
source: "panda-corp agent-inferred note, 2026-11-20 memory-review sweep: 'a naive Bash-transcript command-frequency scan (split on &&/;/| to find the leading token) for fewer-permission-prompts-style allowlist proposals misparses multi-line heredocs/for-loops/echo blocks as fake top-level commands (e.g. \"do echo\", \"done\", \"\\\\\", \"RESULT\\\"\"), polluting the frequency ranking with noise that must be filtered by hand before trusting it'"
provenance: agent-inferred
created: 2026-11-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** building a frequency ranking of the commands an agent actually runs (to propose which
ones an allowlist should cover), a naive scan split each recorded command string on `&&`, `;` and `|`
and treated the leading token of every resulting segment as "a command."

**Lesson:** a real-world Bash invocation is frequently a multi-line heredoc, `for` loop, or `echo`/
variable-assignment block whose INTERIOR lines (`do echo ...`, `done`, a trailing `\`, a quoted
`"RESULT"` fragment) look like independent top-level commands to a naive splitter once it's blind to
heredoc/loop boundaries — these are not real invocations of a tool named `do`/`done`/`RESULT`, they are
fragments of ONE compound command's body. Splitting on shell connectors without tracking whether you are
inside a heredoc (`<<'EOF' ... EOF`) or a control-flow block (`for`/`do`/`done`, `if`/`then`/`fi`)
manufactures fake "commands" that pollute the frequency ranking.

**Apply next time:** when scanning transcripts for command frequency, either (a) parse with real shell
awareness (track heredoc/here-string open-close markers and `for`/`while`/`if` block boundaries before
splitting on connectors), or (b) accept the naive scan's output only as a rough first pass and manually
filter out loop/heredoc-body fragments (recognizable by shape: bare `do`/`done`/`then`/`fi`, a lone
trailing backslash, an unmatched quote fragment) before trusting any count derived from it for an
allowlist decision.
