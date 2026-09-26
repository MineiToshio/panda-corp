---
id: BL-0196
type: bug
area: build-engine
title: "apply-gate committed the reviewer test under mission-control/mission-control/… and left reverify's correct copy untracked (prose 'let TOP' ignored by the MECH agent)"
status: done
severity: p1
opened: 2026-09-26
closed: 2026-09-26
source: "canary E2 report §4.3 — commit 4ceac8e0 in the canary worktree; transcript agent-a8d161c1f223a32e8 (apply-gate:frd-05-work-orders)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js repoRootPortCommand/repoRootHashCommand/repoRootStageCommand used by portReviewerTests, checkReviewerTestIntegrity, reverifyAtLanding, applyGate, certifyPatched (commit protocol), unportReviewerTests, and --literal-pathspecs in the gate release — 7c741f90"
links: [BL-0182, BL-0184, BL-0186]
---

## Problem
In canary E2 the stale-PASS path for FRD-05 committed
`mission-control/mission-control/src/app/projects/[slug]/_components/_tests/frd-05-wo-05-007.gate.reviewer.test.tsx`
(4ceac8e0). Reverify had ported the same file (byte-identical) to the correct path; it stayed **untracked** on main.
vitest ran both copies, so the close-out stayed green, but the tree gained a stray directory and ended dirty.

## Root cause
The salvaged paths are repo-root-relative (git's own listing). The prompts said "let TOP = `git … --show-toplevel`,
copy to $TOP/<path>". The haiku apply agent, working from the project directory, wrote its own `cp … <path>` and
`git add <path>` relative to its cwd (transcript: `DEST="mission-control/src/…"` after `cd …/mission-control`),
doubling the prefix. A second latent defect: `git add/clean -- <path>` treats `[slug]` as a glob class and also matches
siblings (verified: `git add -- 'mc/src/[slug]/x.ts'` staged `mc/src/s/x.ts` too).

## Fix plan
One convention: repo-root-relative paths, and every copy/hash/stage/clean is a LITERAL command the agent runs verbatim,
anchored with `TOP="$(git -C '<project>' rev-parse --show-toplevel)"`, single-quoted paths and
`git --literal-pathspecs`. Applied to port-reviewer-tests, reviewer-test-hash (hash + per-file restore), reverify's
port, apply-gate's port and staging, certify-patch's staging, unport, and the gate release's clean/checkout.

## Tests (prove the fix — TDD, RED → GREEN)
E2-3a / E2-3b EXECUTE the commands from the prompts against a nested fixture repo, from the project cwd (like the E2
agent): the test lands once at `mission-control/src/…` with the reviewer's sha256, no `mission-control/mission-control`
directory, staged at its single path, a `[slug]`-glob sibling not swept in, no untracked copy; the hash command reads
the ported copy. RED on 9.113.0 (no literal commands). D1q and BL-0191g assertions updated to the literal forms.

## Done when
- [x] RED → GREEN, suites green (see BL-0194).
- [ ] **Not verified live:** the tests prove the commands are right, not that a MECH agent always runs them verbatim.
