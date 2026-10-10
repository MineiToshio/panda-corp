---
id: BL-0227
type: bug
area: plugin-agent
title: "Fast-lane builder's self-verify pipes verify.sh through tail, masking a red gate as EXIT=0"
status: open
severity: p1
opened: 2026-10-10
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-03 (agent-inferred, fast-lane builder 9.121.0 candidate F-6); corroborates the existing LESSON-0078 (now a third occurrence, see that lesson's updated source)"
closes:
links: [LESSON-0078, DR-126]
---

## Problem
The fast-lane builder (9.121.0 candidate, proposal 41 F-6) ran its own self-verify step as
`verify.sh ... | tail -15; echo EXIT=$?`. Without `pipefail`, `echo EXIT=$?` captures the exit status of the
immediately preceding command in the pipeline — `tail`, not `verify.sh` — so `EXIT=0` was reported even
though the e2e layer had 6 real failures. The builder prompt's "readable exit code" clause (DR-126 C3) exists
but isn't phrased strongly enough to prevent this: the model reached for the common `| tail -N` idiom to keep
output short and silently reintroduced the exact trap LESSON-0078 already documents (first seen 2026-07-05,
corroborated 2026-07-07) — this is the THIRD occurrence of the identical mechanism, now inside an autonomous
build agent's own self-check rather than a human-run or test-writer invocation.

## Root cause
Neither the builder agent's prompt nor the engine's generated self-verify instruction enforces
`set -o pipefail` or captures `${PIPESTATUS[0]}` before piping the gate's output through `tail`/`grep` for
readability — the same root cause LESSON-0078/BUILD-2 already names, now reproduced in a new surface (the
fast-lane builder's own generated self-verify block in `pandacorp-build.src.js`).

## Fix plan
1. Locate the fast-lane builder's self-verify instruction in `plugin/runtime/engine/pandacorp-build.src.js`
   (or wherever the builder agent prompt embeds the "run verify.sh and report EXIT=" directive) and rewrite
   it to either (a) forbid piping the gate command through `tail`/`grep` entirely (run it un-piped, truncate
   only the TEXT shown to the model afterward), or (b) require `set -o pipefail` before the pipe and read
   `${PIPESTATUS[0]}` explicitly, never a bare `$?` after a pipe.
2. Apply the same fix to any other generated agent prompt (reviewer, gate prompts) that invokes the gate
   through a pipe for output-length reasons.
3. Regenerate the engine artifact; bump plugin PATCH; note in the decision log.

## Tests (prove the fix — TDD, RED -> GREEN)
Extend the engine's own test suite (`test-pandacorp-build.mjs` or equivalent) with a scenario: a fixture
`verify.sh` that exits 1 but prints >15 lines of readable passing-looking output on stdout before the failure
line — assert the generated self-verify instruction, when executed literally, reports the real non-zero
exit code, not `tail`'s 0.

## Done when
The RED canary above goes GREEN; every generated agent prompt that pipes the gate for readability uses
`pipefail`/`PIPESTATUS[0]` or doesn't pipe at all; plugin version bumped.

## Out of scope
Changing verify.sh's own output format.
