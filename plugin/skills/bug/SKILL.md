---
name: bug
user-invocable: false
description: Internal bug guidance for implement. Reproduce the reported defect with a failing test before fixing it.
---

# /pandacorp:bug

## Goal

Deliver the scoped fix under the goal and invariants of
[/pandacorp:implement](../implement/SKILL.md). Capture the symptom, expected behavior,
and smallest reliable reproduction that explains the reported failure.

## Extra invariant

Reproduce the bug with a test that fails against the unfixed code before writing
the fix. The same test must pass with the fix. Preserve both results and report in
Spanish if a reliable reproduction is blocked. An unrelated failure is insufficient
evidence. For a capture-only request, record a draft card with `type: bug`.
