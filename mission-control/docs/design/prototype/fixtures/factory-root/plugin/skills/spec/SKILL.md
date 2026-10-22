---
name: spec
description: Pandacorp's handoff + product phase. Creates an idea's project
  (folder/repo) and generates research + PRD + FRDs for the MVP. Runs FROM the
  factory with the idea's name. It is the discovery → documented step.
---

# /pandacorp:spec

Takes the idea indicated in `$ARGUMENTS`, **creates its project** (handoff) and documents the MVP. Runs FROM the factory (panda-corp) because the project folder doesn't exist yet — that's why it takes the idea's name. `$ARGUMENTS` may also carry a **clarification mode** flag — `--ask` (always ask before generating), `--auto` (infer all, ask only the key gaps), `--infer` (never ask, state assumptions). Default by origin: a `new-idea` (`origin: owner`) → `ask`; a `discover` idea (`origin: discovery`) → `auto` (see Step 4, DR-095).



## Team

- architect
- researcher
- product-manager
