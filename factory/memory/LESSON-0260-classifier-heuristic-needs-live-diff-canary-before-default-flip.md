---
id: LESSON-0260
type: pattern
domain: build-engine
tags: [classify-change, fail-closed-heuristic, synthetic-fixture, live-canary, default-flip, calibration]
context: a new fail-closed size/pattern classifier or gate (rigor tiers, risk floors) is built and unit-tested against synthetic/hand-built fixtures, and the question is when it is safe to flip its default from opt-in to always-on
trigger: use this when a new automated classifier/heuristic gate passes its full synthetic test suite and the team is deciding whether that is sufficient evidence to make it the default path
source: "panda-corp — five distinct false positives in classify-change.mjs (S3/S8/S9/S17, plus a --card worktree-path ENOENT) were found ONLY by running the real classifier against real diffs on Mission Control across four separate live canaries of /pandacorp:change --now (2026-09-23..24), none of them caught by the script's own pre-existing synthetic test suite: S17 (BL-0161, madge lookup broke for a nested-git project), a --card ENOENT (BL-0162, gitignored inbox missing inside an isolated worktree), S3 (BL-0164, escalated to critical on any new file under src/ and on ordinary TDD test-file churn), S8 (BL-0165, floored on a test's own mkdtempSync/rmSync cleanup idiom already used unflagged in 66 existing test files), S9 (BL-0170, --files mode floored on any listed test path as a false net-deletion). /pandacorp:change --now stayed opt-in (not default) through every one of these fixes, per docs/proposals/37 and plugin/docs/decision-log.md."
provenance: agent-inferred
created: 2026-09-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0161, BL-0162, BL-0164, BL-0165, BL-0170, BL-0163]
---

**Situation:** `classify-change.mjs`'s rigor classifier had a substantial synthetic test suite (100+
fixture cases) that stayed green throughout, yet the FIRST four live runs against a real project each
turned up a NEW false positive the suite had never anticipated: a nested-git topology breaking a tool
lookup, a worktree-isolation path assumption, ordinary TDD test-file churn tripping a size floor, a
well-known test-teardown idiom tripping a destructive-operation floor, and a `--files`-only mode
misreading a listed (not-yet-diffed) test path as a net deletion. Every one of these traces to something a
REAL project's own conventions and topology produce routinely — none of them is exotic — but none of them
existed in the synthetic fixtures the classifier had been calibrated and tested against.

**Lesson:** a fail-closed heuristic classifier's own synthetic test suite, however large, systematically
under-samples the specific idioms a REAL target codebase produces (this project's own TDD discipline, its
test-teardown conventions, its git topology, its worktree-isolation interactions) — because a synthetic
fixture is authored by someone already thinking about what the classifier should catch, not by an ordinary
change happening for unrelated reasons to brush against an edge case nobody anticipated. A green synthetic
suite is evidence the classifier's INTENDED rules work; it is not evidence the classifier is safe to trust
by default against real, unplanned diffs — that requires running it against the real target and watching
what breaks, which is a fundamentally different (and slower) source of coverage than writing more synthetic
cases.

**Apply next time:** before flipping a new fail-closed classifier/heuristic gate's default from opt-in to
always-on, budget for MULTIPLE live runs against real diffs on the actual target project(s) — not just a
comprehensive synthetic suite — and expect each run to surface at least one new false-positive class the
synthetic fixtures missed, especially around: file-churn conventions the project's own engineering rules
mandate (e.g. TDD test files), well-known test-hygiene idioms that share vocabulary with a genuinely
dangerous pattern (temp-cleanup calls, mock setup), and any non-standard repo topology (nested projects,
nested worktrees, shared `.git`). Treat "the synthetic suite is green" and "a live canary against the real
target ran clean" as two SEPARATE, both-required gates before a default flip — the second one is where the
false positives actually live, and it typically takes more than one clean run to exhaust the class.
