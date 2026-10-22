---
name: bug
description: Reports a bug found while testing a Pandacorp project. You describe
  the bug in plain language and the skill documents it in the project's unified
  change queue .pandacorp/inbox/changes/ (as type bug); the build in progress
  (/pandacorp:implement) picks it up at its next safe point. It fixes nothing —
  it only documents. Reachable through the single front door /pandacorp:change,
  which classifies bug vs feature for you. Runs INSIDE the project.
user-invocable: false
---

# /pandacorp:bug

The channel to **report a bug** without stopping the build or setting anything up in Mission Control. You run it in the project folder, tell it the bug in plain language, and the skill leaves it noted in the **unified change queue** `.pandacorp/inbox/changes/` (as `type: bug`). The `/pandacorp:implement` that is running drains it at its next safe point (end of work order) and fixes it with a regression test.

Runs inside the project.
