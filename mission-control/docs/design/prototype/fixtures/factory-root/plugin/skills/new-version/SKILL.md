---
name: new-version
description: Internal engine that groups a large batch of changes into a formal
  milestone (v2, v3…) of a shipped project, with its own mini-PRD. Reached
  through the single front door /pandacorp:change (which routes a large redesign
  / package that justifies a new PRD here); the day-to-day (adding a feature or
  an adjustment) is the same /pandacorp:change routed to the iterate engine
  instead.
user-invocable: false
---

# /pandacorp:new-version

New iteration of an existing project. Runs IN the project. This is an **internal engine**, not an owner command: the owner reaches it through the single front door **`/pandacorp:change`**, which routes a large redesign / batch that justifies its own mini-PRD here (the day-to-day is the same `/pandacorp:change` routed to the `iterate` engine). `$ARGUMENTS`: what the milestone should achieve.

Runs inside the project.

## Team

- product-manager
- architect
