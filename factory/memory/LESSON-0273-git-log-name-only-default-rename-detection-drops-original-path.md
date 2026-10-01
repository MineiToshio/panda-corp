---
id: LESSON-0273
type: gotcha
domain: tooling
tags: [git, rename-detection, name-only, scripting]
context: writing a script that walks git history (git log --name-only or similar) to reconstruct which files a commit touched, when a commit may contain a file rename
trigger: use this when writing a script that uses `git log --name-only` (or `--name-status`) to enumerate the files a commit touched, especially one that then acts on those paths (revert, copy, diff)
source: "mission-control .pandacorp/run/lessons.md 2026-09-30 (agent-inferred, red-team of wo-revert.mjs) — git log --name-only detects renames by default and lists only the DESTINATION path, so a script trying to revert/reconstruct 'the files of a commit' silently loses the original path; fixed by passing --no-renames (and -z for safe parsing)"
provenance: agent-inferred
created: 2026-10-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a script walked `git log --name-only` to reconstruct which files a given commit range
touched, in order to act on those paths (e.g. revert them). Git's rename detection is ON by default for
this kind of history walk, so a commit that renamed a file showed up with only its NEW path in the
`--name-only` output — the OLD path silently disappeared from the listing, even though the commit's diff
genuinely touched both.

**Lesson:** `git log --name-only`/`--name-status` (and several other git history-walking subcommands)
perform rename detection by default, collapsing a rename into "one file, new name" rather than "two paths,
old and new." Any script that needs the COMPLETE, literal set of paths a commit range touched — to revert,
copy, or audit them — will silently lose the old path of any rename unless it disables detection.

**Apply next time:** when a script enumerates "the files touched by a commit/range" for any purpose that
needs the complete and exact path set (not just what changed semantically), pass `--no-renames` to the git
command doing the walk (combine with `-z` for null-separated, parse-safe output). Never assume
`--name-only`'s output is the full list of paths a commit touched when renames are possible.
