---
name: iterate
description: Internal engine that integrates a feature or a change into a
  Pandacorp project at any time (building or shipped). Reached through the
  single front door /pandacorp:change (and invoked by the build when it drains
  the queue), not an owner command. The PM decides the minimum scope (one work
  order, a new FRD, or a mini design step) and produces the canonical docs. It
  is the day-to-day iteration engine.
user-invocable: false
---

# /pandacorp:iterate

Continuous iteration mechanism. Runs IN the project. `$ARGUMENTS` (or the conversation): what you want to add/change (a new FRD, an adjustment like "sort the list", a fix).

Runs inside the project.

## Team

- architect
- researcher
- product-manager
- reviewer
- implementer
