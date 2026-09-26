---
id: BL-0202
type: bug
area: build-engine
title: "for a nested project the baseline pre-check and judge-baseline read the WHOLE repository's git status, so factory WIP outside the project escalates the baseline and falls under its restore step"
status: open
severity: p1
opened: 2026-09-26
closed:
source: "found reading the pre-check while fixing BL-0195 (code reading, NOT exercised live)"
closes:
links: [BL-0195, BL-0124, DR-099]
---

## Problem
`git -C <project> status --porcelain` lists every dirty path of the repository, not only the project's. For Mission
Control (nested in the factory repo) a parallel session's WIP under `plugin/` or `factory/` makes the pre-check escalate
to the opus judge-baseline, whose STEP 1 restores "the other tracked MODIFIED files" to `last_green_sha` with
`git checkout <last_green_sha> -- <files>`. Read literally, that would overwrite another session's factory WIP.

## Fix plan (not implemented)
Scope both steps to the project: `git -C <project> status --porcelain -- .` in the pre-check and in the baseline's
reconciliation (and never restore a path outside the project prefix). Add a nested-fixture test with dirt outside the
project that must neither escalate nor be touched.

## Done when
- [ ] The scenario above is RED → GREEN in `test-pandacorp-build.mjs`.
