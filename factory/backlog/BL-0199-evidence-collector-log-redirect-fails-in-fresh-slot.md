---
id: BL-0199
type: bug
area: build-engine
title: "digested evidence collector failed its first attempt in a fresh gate slot: .pandacorp/run/ does not exist there, so the log redirect fails"
status: done
severity: p2
opened: 2026-09-26
closed: 2026-09-26
source: "canary E2 report §4 (BL-0193 row) — transcripts ad875666…, a40648e4… (evidence:frd-02, evidence:frd-03)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js collectGateEvidence command: mkdir -p the slot run dir first — 7c741f90"
links: [BL-0193]
---

## Problem
In 2/2 fresh slots of canary E2 the collector's first attempt failed with `no such file or directory
…/.pandacorp/run/evidence-verify.log`; the agents recovered with `mkdir -p`. Reused slots passed first time.

## Root cause
`.pandacorp/run/` is gitignored, so a new worktree never has it; the BL-0193 command redirects to `$LOG` inside it
before verify.sh (which creates the directory) runs.

## Fix plan
The command now starts with `mkdir -p "<slot run dir>"`.

## Tests (prove the fix — TDD, RED → GREEN)
E2-6a executes the collector command against a nested fixture slot with no `.pandacorp/run/`: first attempt prints
`verify exit=0` and the slot's report, and the log file exists. RED on 9.113.0 (`verify exit=1`).

## Done when
- [x] RED → GREEN, suites green (see BL-0194).
