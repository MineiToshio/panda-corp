---
description: Groups a large batch of changes into a formal milestone (v2, v3…) of a shipped project, with its own mini-PRD. OPTIONAL — for the day-to-day (adding a feature or an adjustment) use /pandacorp:iterate. Use new-version only for redesigns or large packages that justify a new PRD.
---

# /pandacorp:new-version

New iteration of an existing project. Runs IN the project. `$ARGUMENTS`: what the owner wants to achieve with this version (or ask them).

> **Preflight (DR-045) — is this a Pandacorp project?** This skill mutates the project, so first confirm the Pandacorp marker: `docs/status.yaml` exists **and** `CLAUDE.md` contains `Origin — Pandacorp`. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing project in, `/pandacorp:spec` creates a new one. Don't proceed or invent docs over a missing structure.

## Steps

1. **Context**: read `docs/status.yaml`, `docs/prd.md` (backlog of future versions), accumulated feedback/operation and the existing FRDs.
2. **Define the version**: with the `product-manager` agent, turn the goal into concrete scope — which new FRDs, which existing FRDs change, what is left out (DR-012). Increment `version:` in `docs/status.yaml`.
3. **Re-enter the pipeline, only what changes**:
   - New/modified FRDs → `docs/frds/` (numbering continues)
   - New screens or visual changes? → mini design phase (mockup of the new stuff, same frozen tokens; visual gate only if the visual language changes)
   - Architectural impact? → update blueprint + ADR; if not, skip
   - New work orders → `docs/work-orders/` (numbering continues)
4. **Implementation**: same `/pandacorp:implement` loop. Full regression: the tests of previous versions must stay green.
5. **Release**: `/pandacorp:release` (same gates).
6. Sync the factory portfolio at close (or run `/pandacorp:sync-portfolio` from panda-corp).

## Rules
- FRD/work-order numbering is never reset — the project's history is continuous.
- Don't touch the frozen contracts (design tokens, public schemas) without an ADR that justifies it.
