---
name: review-launch
description: Closes the post-launch loop of a Pandacorp project — reads the real
  product metrics (the PostHog event plan) against the PRD's value hypothesis
  and kill-signals, and gives the owner a kill / hold / double-down verdict.
  Runs IN a launched project (phase release), on demand, in an attended session
  as a /loop job, or swept portfolio-wide by its durable form — the weekly
  scheduled routine `pandacorp-review-launch` at plugin/docs/routines.md §2 (a
  /loop job is session-scoped and expires after 7 days; it is not the recurring
  mechanism). It does NOT kill anything on its own — killing/archiving is the
  owner's decision.
---

# /pandacorp:review-launch

The back half of the economic arc (DR-043), the **post-launch iteration loop UNDER the release phase** (DR-085) — not a separate phase. The factory can ship and instrument (telemetry is added in construction now); this skill makes it **learn** whether what it shipped actually works, and decide where to put effort next. Runs IN the project; precondition `phase: release` in `.pandacorp/status.yaml` (the project is launched — internal or external — with telemetry already verified during construction). **Reaching `release` is what triggers review-launch eligibility** (there is no `operation` phase to wait for anymore).

Runs inside the project.

## Team

- analytics
