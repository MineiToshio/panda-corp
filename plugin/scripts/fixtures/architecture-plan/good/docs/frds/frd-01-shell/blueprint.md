---
id: BP-01
type: blueprint
slug: shell
title: Shell
status: DRAFT
parent: FRD-01
implementation_status: PLANNED
readiness_gate:
grounding_gate:
consistency_gate:
last_updated: 2026-10-01
---

# Blueprint — FRD-01 Shell

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-01-001 | — | `src/app/layout.tsx`, `src/components/core/**` | true | — |
| WO-01-002 | WO-01-001 | `src/app/settings/**`, `e2e/settings/**` | false | W1: WO-02-001 |

- **Order & parallelism:** the shell first.
