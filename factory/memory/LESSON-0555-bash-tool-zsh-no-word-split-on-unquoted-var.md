---
id: LESSON-0555
type: gotcha
domain: shell-scripting
tags: [zsh, bash-tool, word-splitting, set, shell-functions]
context: writing an inline Bash-tool command (or a MECH shell step) that needs to loop over a space-separated list stored in a single shell variable, on a machine whose default shell is zsh
trigger: use this when a Bash-tool/shell script loop over pairs or lists built from an unquoted variable (e.g. `set -- $p`) silently processes only one element or the wrong fields
source: "mission-control .pandacorp/run/lessons.md 2026-10-29 (agent-inferred): the Bash tool runs zsh (not bash) for its underlying shell, so `set -- $p` on an unquoted multi-word string variable does NOT word-split the way it would under bash/sh — zsh's default `SH_WORD_SPLIT` option is off, so the whole string becomes a single positional parameter."
provenance: agent-inferred
created: 2026-10-29
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a loop over path pairs built by assigning a space-separated string to a shell variable and
then running `set -- $p` to split it into positional parameters relied on bash/POSIX word-splitting
semantics. Under the Bash tool's actual shell (zsh), unquoted variable expansion does NOT word-split by
default (`SH_WORD_SPLIT` is off unless explicitly set) — `set -- $p` assigns the WHOLE string as `$1`,
leaving `$2`/`$3`... empty, silently breaking the loop instead of erroring.

**Lesson:** scripts authored assuming bash/sh word-splitting rules can silently misbehave under zsh — this
particular construct doesn't fail loud, it just processes the wrong (or no) data, which is worse than a
syntax error because nothing flags it.

**Apply next time:** don't rely on unquoted-variable word-splitting for a pair/list loop in a Bash-tool
script on this machine. Use a two-argument shell FUNCTION called once per item instead of building and
splitting a combined string (`pair() { ...; }; pair "$a" "$b"`), or explicitly set `setopt SH_WORD_SPLIT`
first if zsh-specific splitting behavior is unavoidable, or use an array (`arr=($p)`) rather than `set --`.
