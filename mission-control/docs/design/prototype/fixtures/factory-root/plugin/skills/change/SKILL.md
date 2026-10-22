---
name: change
description: The SINGLE front door to ask a Pandacorp project for ANY change — a
  new feature, an adjustment, or a bug. You describe it in plain language; the
  skill classifies it (feature/change vs bug vs milestone-scale) and gives it a
  class of service (urgent vs normal), then files it in the project's change
  queue (.pandacorp/inbox/changes/). It also derives the change's rigor level
  with a deterministic script; by default it stops at capture (`--queue`
  behaviour). On explicit `--now`, it goes on to IMPLEMENT and close a
  micro/normal change in the same turn, via a delegated subagent in its own
  worktree, the level's verify.sh gate, an independent reviewer, and a batch
  close-out — refusing itself (falling back to capture-only) whenever the change
  is critical, touches the floor, or a build is running. Runs INSIDE the
  project.
---

# /pandacorp:change

**The one command for "I want something changed or fixed."** You don't have to remember whether it's a feature or a bug — describe it, and `change` classifies it, gives it an **urgency class**, and drops it in the **change queue** `.pandacorp/inbox/changes/`. A running build **drains the queue at its next safe point**; if no build is running, `/pandacorp:implement` empties it when you run it. By default, that's where it stops: capture. For a small or medium change with no build running, you can also ask it to skip the wait and implement + close it in the same turn (**`--now`**, `## Fast path` below) — opt-in until the `## Dry run` canary has run green with D2 fixed (`references/now-mode.md`).

Runs inside the project.

## Team

- implementer
- frontend-dev
- backend-dev
- reviewer
