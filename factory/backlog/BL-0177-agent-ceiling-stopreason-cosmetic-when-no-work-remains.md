---
id: BL-0177
type: bug
area: build-engine
title: "stopReason:'agents' fires even when the crossing spawn already cleared every queue — a cosmetically wrong 'agent-cap stop' on a run that actually finished"
status: done
severity: p2
opened: 2026-09-25
closed: 2026-09-25
source: "canary D2 (wf_faf48b18-881), canary-d-frd02-forensics.md §4 finding H6 / canary-d-wave-investigation.md"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js main loop MAX_AGENTS brake (~:2889) — F5"
links: []
---

## Problem
Canary D2's build-journal/notify-end narrative reported "Paro por techo de agentes" (agent-ceiling
stop), but the forensic re-analysis of the run (canary-d-frd02-forensics.md §4) found the loop's next
iteration would never have gated frd-02 again regardless (needs-owner is terminal within a run) and
that `allDone` was already false for other reasons — the ceiling label added no real information and,
per the wave-investigation's independent structural analysis, the SAME class of cosmetic mislabel
recurs any time the exact spawn that crosses `MAX_AGENTS` is also the one that finishes the last real
piece of work: the run reports a budget-exhaustion story about work that, in fact, all got done.

## Root cause
The loop-top brake (`if (MAX_AGENTS && agentSpawned >= MAX_AGENTS) { stopReason = 'agents'; ...break }`)
fires unconditionally the instant the weighted counter crosses the cap, with no check for whether any
work actually remains queued (`globalQueue`/`gateQueue`/`gatesInFlight`/`gateResults`/`convergeQueue`).
When the crossing spawn is the SAME one that emptied all five, the brake still claims credit for
stopping something — nothing was cut off.

## Fix plan
Gate the `'agents'` label on a real remainder check: `workRemains = globalQueue.size>0 ||
gateQueue.length>0 || gatesInFlight.size>0 || gateResults.length>0 || convergeQueue.length>0`. Only
set `stopReason='agents'` and break when `workRemains` is true; otherwise fall through unlabeled
(`stopReason` stays its default `null` = "ran to completion") and let the natural end-of-queue check a
few lines later close the run honestly.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`: two pre-existing scenarios ("22. A3 honest degrade" and
"C2-v. run-end awaits in-flight gates") had their `stopReason === 'agents'` assertions updated to
`=== null` with an explanatory comment (both were, on inspection, exercising the exact "nothing left
when the ceiling trips" shape this fix targets — their assertions were testing the OLD, cosmetically
wrong behavior). A new, purpose-built `BL-0177a` (marker `// ---- BL-0174..0177 ----`) tunes
`maxAgents` to the exact cost-weighted total through a trivial single-WO build's completion, asserting
`stopReason === null` and the FRD still verifies. The pre-existing 'agents'-asserting scenarios at
lines ~357/385/421/1419 (real work genuinely remains queued at the ceiling) were re-run unchanged and
still pass — proving the OTHER half of the branch (a real cutoff still reports 'agents') is untouched.

## Done when
- [x] `BL-0177a` is green; the two updated pre-existing scenarios are green with their corrected
  assertions; the four untouched 'agents'-asserting scenarios still pass (no regression on genuine
  cutoffs). Confirmed RED against the pre-fix engine (unconditional `stopReason='agents'`).
- [x] `bash plugin/scripts/run-engine-tests.sh` green (173/173).
- [x] Shipped in the same release batch as BL-0174/0175/0176 (plugin 9.109.0).

## Out of scope
Re-deriving or asserting the EXACT `stopReason` enum value for every possible brake combination beyond
`'agents'` — `'budget'`/`'blocks'`/`'maxFrds'`/`'rethink'` were not touched by this fix and are out of
scope.
