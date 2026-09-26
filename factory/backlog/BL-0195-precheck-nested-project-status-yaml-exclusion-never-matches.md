---
id: BL-0195
type: bug
area: build-engine
title: "baseline pre-check escalated to an opus judge-baseline in a NESTED project: porcelain paths are repo-root-relative, the BL-0124 exclusion compared project-relative"
status: done
severity: p2
opened: 2026-09-26
closed: 2026-09-26
source: "canary E2 report §4.6 (journal #2: dirtyPaths [\"mission-control/.pandacorp/status.yaml\"])"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js PRECHECK_SCHEMA.projectPrefix + PRECHECK_PREFIX/projectRelativeDirtyPath before leasedStatusOnly — 7c741f90"
links: [BL-0124, BL-0160]
---

## Problem
Canary E2's pre-check returned `dirtyPaths: ["mission-control/.pandacorp/status.yaml"]` (the lease's own write). The
BL-0124 exclusion compared `dirtyPaths[0] === '.pandacorp/status.yaml'`, which can never match in a nested project, so
the run paid an opus judge-baseline on the critical path (2.47 min, 0.17 $). BL-0160 residue specific to nesting.

## Root cause
`git status --porcelain` always prints paths from the repository root (porcelain ignores `status.relativePaths`); the
pre-check prompt called them "project-relative" and the engine compared as if they were.

## Fix plan
The pre-check also returns `projectPrefix` (`git -C <project> rev-parse --show-prefix`, verbatim) and reports paths as
git prints them. The engine strips a well-formed prefix (no leading `/`, no `..`, ends in `/`) only from a path that
starts with it, then compares. Anything else stays unmatched and escalates — the exclusion never widens.

## Tests (prove the fix — TDD, RED → GREEN)
E2-2a (nested payload + prefix → fast path, prompt asks for show-prefix), E2-2b..e controls (WIP next to it, a path
outside the project, no prefix, malformed `../` prefix → all escalate), E2-2f (payload built from REAL git output of a
nested fixture repo). E2-2a/f were RED on 9.113.0. BL-0160a..d still green.

## Done when
- [x] RED → GREEN, suites green (see BL-0194).
- [ ] **Not verified live** on a real nested run.

## Out of scope
The pre-check still lists dirt from the WHOLE repository (factory files outside the project), see BL-0202.
