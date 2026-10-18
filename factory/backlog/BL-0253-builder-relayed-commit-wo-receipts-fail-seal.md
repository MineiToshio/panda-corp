---
id: BL-0253
type: bug
area: build-engine
title: "Fast-lane builders' relayed commit-wo receipts fail their integrity seal ('the relay altered it' / 'not valid JSON')"
status: open
severity: p2
opened: 2026-10-18
closed:
source: "funko-tracker run_20261018T033601Z_80858: WO-01-002, WO-01-003, WO-01-004, WO-01-005"
closes:
links: [BL-0251]
---

## Problem

In funko-tracker's run the lane builder for chain c-wo-01-002 returned `{ wos: [{ id, line }] }` whose `line` failed
`parseMechLine` for WO-01-002/003/004 (`the commit-wo line failed its integrity seal (the relay altered it)`) and the
main-built chain c-wo-01-005 for WO-01-005 (`the commit-wo line is not valid JSON`). The engine recovered each through
`fastRecommit` (status `nothing`: already committed), so no work was lost, but every lost receipt costs one MECH spawn
and a log warning, and a receipt that is mis-copied and NOT already committed would park and rebuild a WO.

## Root cause

Not confirmed. Hypothesis to check first: the sealed line escapes non-ASCII as `\uXXXX` (e.g. an em dash in a `reason`
or a path) and the builder model "normalizes" it when copying the line into its JSON answer, or truncates a long line.
The same class is already documented for the plan line (test-build-engine.mjs F39-31: "the relay decoded ó"), which
was fixed by giving the compact plan no free text; commit-wo's receipt may still carry free text (`reason`, paths).
Evidence: the per-agent results under
`/Users/sergio/.claude/projects/-Users-Shared-Proyectos-funko-tracker/d812059e-8648-4f26-b2d9-3bb8a5692ffe/subagents/workflows/wf_751dec65-1f7/`
(the lane-build agents' final answers) against what `commit-wo` printed.

## Fix plan

1. Diff the relayed `line` against the committed receipt for each failing WO; name the alteration class.
2. Then either make the commit-wo line relay-robust (ASCII-only body, shorter line) or let the builder answer only the
   receipt's file/nonce so the engine re-reads it (the bench FM-8 `receipt:` re-read already exists for lane-next).

## Tests (prove the fix — TDD, RED → GREEN)

A `test-build-engine.mjs` scenario feeding the observed altered line: today it logs the seal failure and spawns
`recommit:`; after the fix the receipt is accepted (or re-read) with no recommit spawn.

## Done when

The alteration class is named with evidence, the scenario is green, and a lane build of N WOs spawns no `recommit:`.
