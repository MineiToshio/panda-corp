---
id: LESSON-0657
type: gotcha
domain: build-orchestration
tags: [worktree, dr-096, git-common-dir, test-fixtures, bash]
context: writing a test fixture or script that reads `git rev-parse --git-common-dir`'s output directly (string comparison, path join) rather than resolving it via `cd ... && pwd`
trigger: use this when a test fixture or script compares/joins `git rev-parse --git-common-dir`'s raw output and the assertion only fails when run from a MAIN checkout (not a worktree), or passes/fails inconsistently depending on which checkout the test runs from
source: "panda-corp — DR-147/BL-0307 change-queue-reconciler work (2026-11-10): `git rev-parse --git-common-dir` prints a RELATIVE path (`.git`) when the common dir equals the cwd's own `.git` (i.e. run from a main checkout), but an ABSOLUTE path when run from a linked worktree (where the common dir lives elsewhere). A test fixture that joins or string-compares the raw value breaks specifically in the main-checkout case. Agent-inferred."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0111, LESSON-0533]
---

**Situation:** `git rev-parse --git-common-dir` is the standard way to locate the shared `.git` directory
across a main checkout and its linked worktrees (LESSON-0111's root-resolution technique). Its raw output
is NOT format-stable: from a linked worktree it returns an absolute path (the common dir lives elsewhere);
from the main checkout itself it returns the relative string `.git` (the common dir IS the cwd's own
`.git`). Production scripts in this repo already sidestep this by resolving it with
`cd "$(git rev-parse --git-common-dir)" && pwd` (always absolute) — but a test fixture that reads the raw
value directly, to build a path or compare it against an expected string, only breaks in the main-checkout
branch of its own test matrix, which is easy to not exercise.

**Lesson:** this is a sibling gotcha to LESSON-0111 (which covers USING `--git-common-dir` to find the real
root from inside a worktree) one level more mechanical: the command's own output format depends on WHERE it
is invoked from, and any direct consumer of the raw string — not just the "resolve the real root" use case —
needs to normalize it, whether that consumer is production code or a test fixture.

**Apply next time:** never consume `git rev-parse --git-common-dir`'s raw output directly in a fixture or
script. Either resolve it the way this repo's scripts already do (`cd "$(git rev-parse --git-common-dir)" &&
pwd`), or pass `--path-format=absolute` (newer git) and still verify the result is absolute before using it.
When writing a test matrix for anything worktree-related, include a case run from the MAIN checkout
explicitly — not only from a worktree — since this is exactly the branch that surfaces the relative-path
form.
