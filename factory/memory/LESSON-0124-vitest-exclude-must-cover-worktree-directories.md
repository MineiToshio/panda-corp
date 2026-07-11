---
id: LESSON-0124
type: gotcha
domain: testing
tags: [vitest, worktree, dr-096, test-globbing, false-red, node-resolution]
context: a project's test runner config that globs test files across the whole checkout while sibling git worktrees (DR-096 isolation) exist as subdirectories under a tracked-but-locally-populated path (e.g. .claude/worktrees/*)
trigger: use this when a test-runner config's include/exclude globs are set up, or when a test run reds with paths under a sibling worktree directory or an "invalid hook call" from a dependency resolved out of a different node_modules
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-09 — vitest.config.ts only excluded [\"e2e/**\",\"node_modules/**\"], not \".claude/**\"; the gate globbed sibling git worktrees' (created under .claude/worktrees/* by parallel sessions, DR-096) in-flight, half-edited test files and ran them against the main checkout, which also let vitest resolve react-dom from the OTHER worktree's node_modules (breaking every React-rendering test with 'invalid hook call'; pure-data tests were unaffected); fixed by adding '.claude/**' to the exclude list (commit 'test(config): exclude .claude/** so sibling worktrees aren't globbed', 2026-07-09) (agent-inferred)"
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0111, LESSON-0090, LESSON-0093, LESSON-0073, LESSON-0099, LESSON-0125]
---

**Situation:** a git worktree (DR-096 isolation) created under a subdirectory of the main checkout (e.g.
`.claude/worktrees/<branch>/`) carries its own full copy of the project, including `node_modules` and any
in-flight, half-edited test files a parallel session is working on. A test runner's default include glob
(everything except a short exclude list) has no reason to know that subdirectory is a SEPARATE checkout —
it globs those test files too, and Node module resolution inside the runner can pick up the sibling
worktree's `node_modules` (a different `react-dom` copy) instead of the main checkout's, breaking every
React-rendering test with an "invalid hook call" — while pure-data (non-rendering) tests keep passing,
which is a useful diagnostic signature.

**Lesson:** this is the SAME underlying class LESSON-0111/0090/0093/0073 already track (a worktree is a
second, independent checkout nested in a path the main checkout doesn't expect to be "someone else's
tree") wearing a FOURTH symptom: not missing gitignored state, not a stray edit, not an environment gap —
here, a test runner's own glob accidentally treats a sibling worktree's files as part of the main
checkout's suite, causing false REDs and cross-worktree dependency-resolution corruption. Any project
using DR-096 worktree isolation under a path inside the repo tree needs its test runner's exclude list to
explicitly cover that path, or every parallel session's WIP becomes a landmine for every OTHER session's
test run.

**Apply next time:** when a project adopts git-worktree isolation with worktrees nested under a
repo-relative path (e.g. `.claude/worktrees/`), audit the test runner's config (`vitest.config.ts` and
equivalents) and add that path to the exclude/ignore list up front, not after hitting a false red. If a
test run reds with paths under a worktree directory, or a "invalid hook call"/similar cross-dependency
error appears only intermittently (only when a parallel session happens to be active), suspect this class
before suspecting a real code regression — check whether pure-data tests in the same run stayed green
(the tell that it's resolution contamination, not a logic bug).
