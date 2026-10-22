---
name: adopt
description: Adopts an EXISTING project that was NOT born from the Pandacorp
  handoff (a brownfield / external project) into the factory. Injects the
  overlay without clobbering, infers the real phase from the code, reconstructs
  minimal as-built docs, registers it (a retroactive idea card so it shows on
  Mission Control's board, plus a portfolio row), and hands off to the normal
  skills. Runs INSIDE the existing project. The brownfield counterpart of
  /pandacorp:scaffold.
---

# /pandacorp:adopt

Brings a project built **outside** the factory under Pandacorp management. Run it **inside** the existing project folder. It is the brownfield mirror of `scaffold` (greenfield): instead of creating an empty project, it wraps what already exists, so that from then on the `/pandacorp:*` skills, Mission Control and the write-gate (DR-044) apply to it. Touching an existing project = **human gate**: present the adoption plan and get the owner's OK before writing anything (DR-045, DR-038).



## Team

- architect
- product-manager
- designer
- analytics
