---
id: BL-0068
type: bug
area: build-engine
title: "Make stop detection deterministic and pre-loop closure capability-bounded"
status: done
severity: p0
opened: 2026-07-12
closed: 2026-07-12
source: "R10-C installed canary incident on plugin 9.93.0"
closes: "Deterministic stop inspection and capability-bounded pre-loop close; plugin 9.94.0; overlay 8.75.0"
links: [DR-050, DR-118]
---

## Problem

R10-C exposed two independent trust-boundary failures. The Claude baseline precheck used ambient shell
`test -f` to detect `.pandacorp/run/stop`; a user alias `test=npm test` returned zero and fabricated an
owner stop although the signal file was absent. The subsequent `ensureStopped` call dispatched a broad
implementer which ignored its shutdown-only role and built product code, tests and the BL-0066 A+B
commit pair during what should have been a mechanical lease close.

## Root cause

Owner-stop detection and pre-loop shutdown were expressed as natural-language agent instructions. The
first depended on mutable shell resolution; the second granted a general implementation agent more
authority than its task required and had no deterministic allowed-diff receipt.

## Fix plan

Add deterministic Node CLI operations for stop inspection and fenced pre-loop closure. Make the engine
consume the inspection receipt instead of ambient shell builtins. Replace the broad `ensureStopped`
role with a mechanical command runner that invokes exactly the closure operation; the operation must
reject product/staged drift, mutate and commit only `.pandacorp/status.yaml`, release through the
two-phase fence, and return an auditable allowed-path receipt. Propagate the canonical engine to Mission
Control and update the build contract, implement skill, Manual and decision logs.

## Tests (prove the fix — TDD, RED → GREEN)

Extend `test-build-state.mjs` and `test-pandacorp-build.mjs`: an adversarial shell alias cannot fabricate
a stop; an absent stop reaches the planner; a real stop exits before planning; dirty product/staged
state makes pre-loop close fail without a commit; and the engine source binds the exact mechanical
command plus its receipt. Run the complete build-engine, lifecycle, runtime-switch and drift corpus.

## Done when

Both deterministic commands and adversarial tests pass; the engine template and Mission Control copy
are identical; standards, skill, Manual and decision logs describe the bounded contract; overlay is
8.75.0; plugin is 9.94.0; backlog and derived-artifact validators are green.

## Out of scope

Promoting R10, changing normal FRD construction/review semantics, or deleting any failed-canary evidence.
