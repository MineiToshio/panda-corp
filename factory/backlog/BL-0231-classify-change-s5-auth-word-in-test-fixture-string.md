---
id: BL-0231
type: bug
area: plugin-skill
title: "classify-change S5 content scan floors a pure UI change to critical on the word 'Auth' inside a test fixture string"
status: open
severity: p2
opened: 2026-10-13
closed:
source: "owner conversation 2026-10-13 — Mission Control /change --now board-card-default-tab-by-phase"
closes:
links: [BL-0140, BL-0164, DR-069]
---

## Problem
A pure UI change in Mission Control (board card default tab by stage, branch
`change/board-card-default-tab-by-phase`, range `041139e4..0419865b`) was reclassified `critical` at
`/change --now`'s definitive `--range` pass, blocking the fast-path landing and forcing an owner
`--force-critical`. The only floor hit was:

`S5 critical — auth token in added content: 'Auth' (mission-control/src/app/board/_tests/frd-02.stage-default-tab.reviewer.test.tsx)`

The matching line is a markdown fixture string in a reviewer-authored test:
`const SPEC = "## Requisitos\n\n- REQ-01-001 Auth";` — prose data, not auth code.

Impact: every `--now` change whose tests carry realistic product prose (FRD titles like "Auth",
"Session", "Permissions") gets floored to `critical`, so the owner is asked to override a false alarm —
which trains the owner to rubber-stamp `--force-critical`, eroding the floor's value.

## Root cause
`plugin/scripts/classify-change.mjs` `S5_CONTENT` (around line 82) runs the bare-word regex
`/\bauth(?!or…)[A-Za-z_]*/i` over every added line, including test files (by design: "every
content/path floor signal (S5-S9) still scans test files' added lines exactly as before", ~line 648).
It does not distinguish string-literal/markdown content from code identifiers.

## Fix plan
1. For test surfaces only (`isTestSurface`), strip string-literal contents (quoted / template
   literals) from added lines before applying the vocabulary regexes of S5_CONTENT (keep the
   API-shaped ones like `getServerSession(`, `cookies()`, `session?.` on raw lines).
2. Keep production files scanned exactly as today (no relaxation there).
3. Keep the structural ownership guard (BL-0140) unchanged.

## Tests (prove the fix — TDD, RED → GREEN)
- A test-file added line `const SPEC = "- REQ-01-001 Auth";` → no S5.
- A test-file added line `await signIn("x")` → S5 still fires.
- A production-file added line `const label = "Auth";` → S5 still fires (unchanged behaviour).
- Re-run the classifier on the Mission Control range above → no S5 floor hit.

## Done when
The four tests above pass in the classifier's suite and the Mission Control range reclassifies without
an S5 floor hit.

## Out of scope
Relaxing S5 on production files, or the S17 "madge unavailable" note in worktrees.
