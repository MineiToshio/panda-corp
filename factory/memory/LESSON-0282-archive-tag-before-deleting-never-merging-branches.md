---
id: LESSON-0282
type: pattern
domain: git
tags: [git, branches, canary, cleanup, no-merged]
context: a repo accumulates canary/experiment/benchmark branches that are intentionally never merged into the default branch, so any "pending merge" view built on `git branch --no-merged` lists them as permanently stuck
trigger: use this when a "branches pending merge" report (a dashboard panel, a cleanup script, a manual `git branch --no-merged` check) lists a branch that was never meant to be merged (a canary, an experiment, a benchmark run)
source: "mission-control .pandacorp/run/lessons.md 2026-10-06 (agent-inferred) — Mission Control's own 'Pendientes de merge' panel counts every branch via --no-merged; canary/experiment branches that are intentionally never merged show as stuck forever, because the panel has no way to distinguish a genuinely abandoned branch from one that already landed its useful commits under a DIFFERENT hash (a squash/cherry-pick/rebase-merge) or was never meant to land at all"
provenance: agent-inferred
created: 2026-10-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a repo's canary/experiment branches (created to run a benchmark or try a throwaway
approach) are never actually merged with a real merge commit — either they're abandoned, or their useful
commits already landed under a different hash (squash, cherry-pick, or a rebase-and-fast-forward). A
`--no-merged` check can't tell these apart from genuine unmerged work in progress, so any tooling built
directly on it (a "pending merge" dashboard panel, a cleanup script) reports them as permanently stuck.

**Lesson:** `git branch --no-merged <default>` answers "does this branch's tip have an ancestor edge into
<default>", which is NOT the same question as "does <default> already contain everything useful this
branch did." A branch whose commits landed via squash/cherry-pick/rebase has no such ancestor edge and
will show as unmerged forever, even though nothing is actually lost or pending.

**Apply next time:** before treating a `--no-merged` branch as stuck work needing a decision, check
`git cherry <default> <branch>` — if it reports NO `+` lines, every commit on the branch is already
reachable (by patch-id) from `<default>` under some other hash, and the branch is safe to delete outright.
If it DOES report `+` lines (or the branch was always meant to be a dead-end experiment, not landing
work), archive it instead of deleting outright: `git tag archive/<branch> <branch> && git branch -D
<branch>` preserves the history under a tag while removing it from any `--no-merged`-based view. Any
tooling that reports "branches pending merge" should itself run this `git cherry` check (or filter out
`archive/*`-tagged branches) rather than trusting a raw `--no-merged` listing.
