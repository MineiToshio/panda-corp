---
id: LESSON-0305
type: gotcha
domain: tooling
tags: [zsh, shell, path, scripting, scoping]
context: writing a zsh loop that destructures/reads multiple fields per line (e.g. `while read name path; do ...; done`) inside a script or interactive shell
trigger: use this when naming a loop/read variable in a zsh script, especially a second or later field in a `read`/`for` statement
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred)"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0188]
---

**Situation:** a zsh loop (e.g. `while read name path; do ...; done`) assigned a per-iteration value to a
variable literally named `path`.

**Lesson:** in zsh, the lowercase `path` is a special array variable TIED to `$PATH` (it is the same
storage, just a different representation — array vs colon-separated string). Assigning a scalar string to
`path` inside a loop silently corrupts `$PATH` for the rest of that shell/script, so every subsequent
command in the loop (and the rest of the session, if not scoped) starts failing with "command not found"
— a confusing symptom disconnected from the actual cause.

**Apply next time:** never name a zsh variable `path` (or `PATH`, `fpath`, `cdpath`, `manpath` — the other
special arrays) for ordinary scalar use, even as a throwaway loop/read variable; pick an unambiguous name
(`p`, `filepath`, `item_path`) instead. If "command not found" errors start mid-script with no
corresponding edit to actual commands, suspect a shadowed special variable before anything else.
