---
name: iterate
user-invocable: false
description: Internal guidance for the documentation delta of a scoped implement change.
---

# /pandacorp:iterate

## Goal

Keep the documentation for the selected change consistent with the delivered
behavior under [/pandacorp:implement](../implement/SKILL.md). Produce the smallest
delta that makes the scope, intended behavior, and verification understandable.

## What belongs in the delta

Include the relevant FRD acceptance criteria, blueprint, and dated decision-log
entry. Use the applicable WOs, design references, and project rules. Add an ADR for
a platform decision and update the canonical `data-model.json` if the schema changes.
Preserve historical decisions and other sessions' work. The case determines which
documents need edits and when those edits are useful.
