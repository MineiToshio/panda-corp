---
id: BL-0078
type: bug
area: plugin-agent
title: "Make whole-FRD edge contracts mandatory gate oracles"
status: open
severity: p1
opened: 2026-07-13
closed:
source: "R10-I Stage 1 independent audit"
closes:
links: [DR-015]
---

## Problem

R10-I Stage 1 passed its independent Claude FRD gate even though the implementation contradicted the
FRD's explicit edge-case contract: unsafe integers had to be rejected, but `Number.isInteger` accepted
them. The reviewer tested the numbered acceptance criteria, omitted the FRD's separate Edge cases
section, and its status note acknowledged but dismissed the contradiction. A green gate can therefore
narrow the source of truth to a convenient subset of the approved spec.

## Root cause

The reviewer and implement orchestration require whole-feature review, but do not state a mechanical
source-coverage step that inventories every normative FRD section before authoring adversarial tests.
The certification fixture likewise lacked a pre-seeded RED oracle for the stated boundary.

## Fix plan

1. Update the canonical reviewer prompt and implement gate contract so the reviewer builds a normative
   checklist from the entire FRD (requirements, numbered ACs, invariants, edge cases, limits, errors and
   exclusions), and may never waive a contradiction outside a numbered AC.
2. Require at least one adversarial boundary test for each normative edge/limit class and record
   traceability in the verdict; missing coverage is RED.
3. Add deterministic prompt/source tests that fail if whole-FRD coverage or the no-waiver rule drifts;
   regenerate Codex agent mirrors from the canonical Claude agent source.
4. Update the applicable standard/Manual narrative and decision logs; bump plugin semver and overlay
   only where propagation requires it.

## Tests (prove the fix — TDD, RED → GREEN)

- Add a reviewer/source regression fixture where numbered ACs pass but a separate FRD Edge cases clause
  fails (unsafe integer versus safe integer); prove the gate contract rejects it.
- Run agent mirror drift, prompt policy, engine source, manifest, backlog and Manual checks relevant to
  the touched files.

## Done when

- The canonical reviewer and implement gate explicitly treat the whole FRD as the oracle and prohibit
  waiving any normative section merely because numbered ACs pass.
- Deterministic tests go RED when the whole-FRD checklist/no-waiver language or edge traceability is
  removed.
- Codex mirrors are regenerated, canonical docs and decision logs agree, plugin version is bumped, and
  all relevant validation suites pass.

## Out of scope

This item does not repair or reuse R10-I, change an approved project FRD, or replace independent review
with self-authored implementation tests.
