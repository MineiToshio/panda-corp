---
id: BL-0302
type: bug
area: templates
title: "Make Stack A e2e pass its own template gate"
status: doing
severity: p1
opened: 2026-11-04
source: "Owner-reported funko-tracker upgrade to overlay 8.117.0"
links: [DR-059, DR-103]
---

## Problem and root cause

Stack A shipped formatter errors, excessive token callback complexity, no
`waitForHydrated` export and a live-data scanner that entered `.claude/worktrees`.
Byte conformance did not execute the template's own Biome configuration.

## Repair and proof

Format the complete `e2e/`, split token sampling without changing its advisory
threshold, port the hydration helper/test and exclude `.claude`. The existing
engine corpus discovers `plugin/scripts/test-template-e2e-conformance.mjs`, which
runs the real template Biome and checks spec hydration imports, with negative
controls. Before repair it reports 7 errors and 1 warning across 18 files.

## Done when

The new suite and quick related template/plugin suites pass; both hydration files
diff identically against the supplied project; shell syntax is valid; overlay
8.117.1 and plugin 9.149.1 manifests agree. See the plugin decision log v9.149.1.

## Local verification — 2026-11-04

The conformance suite passes on all 18 e2e files with Biome 2.5.15, checks five
hydration imports and rejects both negative controls. The two hydration files
match funko-tracker byte for byte. E2e sentinel, tier, gate-inventory and live-data
scanner suites pass, as do shell syntax, derived drift and plugin validation.
A separate scanner fixture proves `.claude/worktrees` is excluded while the visible
control still warns. Other stacks contain none of the affected harness/scanner.

Additional browser verification could not start Chromium: the sandbox denies
macOS `bootstrap_check_in` (1100); none of the six hydration test bodies ran.
The required commit is also blocked: Git cannot create the common-repository
`index.lock` outside this worktree's writable boundary. Keep this item `doing`
until the owner can commit the verified repair in an environment allowing Git
metadata writes. No push or plugin-cache update was attempted.
