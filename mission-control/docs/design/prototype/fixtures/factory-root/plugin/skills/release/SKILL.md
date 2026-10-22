---
name: release
description: Performs and executes the release of a Pandacorp project —
  deploys/launches it (internal OR external), with the deploy strategy, the
  pre-release checklist, the launch plan and the human gate for an external
  production deploy. Sets phase release + the idea to launched. The
  security/quality/metrics hardening (audit) is NOT here anymore — it is the
  last step of construction (/pandacorp:implement). Use inside the project once
  construction is complete (phase release).
---

# /pandacorp:release

**Release = the product is LAUNCHED / live** — internal or external (DR-085). It is no longer "audit + deploy" (the hardening moved to construction; see the callout below). This skill performs the **deploy/launch** (internal or external) + the launch plan, sets `phase: release` and the idea's card → `status: shipped`. From here the product is iterated by filing changes through the single front door (`/pandacorp:change`) and its real results are read (`/pandacorp:review-launch`). Runs IN the project.



## Team

- architect
- copywriter
- devops
