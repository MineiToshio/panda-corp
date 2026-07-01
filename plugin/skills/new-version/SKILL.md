---
user-invocable: false
description: Groups a large batch of changes into a formal milestone (v2, v3…) of a shipped project, with its own mini-PRD. OPTIONAL — for the day-to-day (adding a feature or an adjustment) use /pandacorp:iterate. Use new-version only for redesigns or large packages that justify a new PRD.
---

# /pandacorp:new-version

New iteration of an existing project. Runs IN the project. `$ARGUMENTS`: what the owner wants to achieve with this version (or ask them).

> **Preflight (DR-045) — is this a Pandacorp project?** This skill mutates the project, so first confirm the Pandacorp marker: `.pandacorp/status.yaml` exists. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing project in, `/pandacorp:spec` creates a new one. Then, if `overlay_version` in `.pandacorp/status.yaml` is behind the plugin's `OVERLAY_VERSION`, run `/pandacorp:upgrade` first (silent for compatible bumps, DR-048) so this skill runs against the current structure. Don't proceed or invent docs over a missing structure.

## Steps

1. **Context**: read `.pandacorp/status.yaml` (a shipped project sits at `phase: release`, DR-085), `docs/product/prd.md` (vision + the living feature-landscape backlog of future versions), accumulated feedback / post-launch results (from `/pandacorp:review-launch`) and the existing FRD modules under `docs/frds/`.
2. **Define the version**: with the `product-manager` agent, turn the goal into concrete scope — which new FRDs, which existing FRDs change, what is left out (DR-012). Increment `version:` in `.pandacorp/status.yaml` — this formal-milestone bump (plus the mini-PRD) is what distinguishes `new-version` from day-to-day `/pandacorp:iterate`, which never touches `version:` (there, `release` just derives the semver tag automatically from the conventional commits).
3. **Re-enter the pipeline, only what changes** (feature-centric, DR-049 — a new feature is a new `docs/frds/frd-NN-<slug>/` module, nothing else moves):
   - New FRD → new `docs/frds/frd-NN-<slug>/frd.md` module (numbering continues); modified FRD → edit its existing module
   - New screens or visual changes? → mini design phase (mockup of the new stuff in the FRD's `mocks/` + its `fdd.md`, same frozen global design system in `docs/design/`; visual gate only if the visual language changes)
   - Architectural impact? → update the feature's `docs/frds/frd-NN-<slug>/blueprint.md` (and `docs/product/architecture.md` only if it's platform-level) + ADR; if not, skip
   - New work orders → the feature's `docs/frds/frd-NN-<slug>/work-orders/` (per-FRD numbering continues); a change that **extends an existing work order** → **reopen it** (`implementation_status: VERIFIED → PLANNED` in its frontmatter + widen its scope/`Status Note`) so the engine rebuilds only what changed (DR-050)
4. **Implementation**: same `/pandacorp:implement` loop, which also runs the security/quality/metrics hardening as its last step (DR-085). Full regression: the tests of previous versions must stay green.
5. **Release**: `/pandacorp:release` — deploy/launch the new version (internal or external, same `deploy_target`).
6. Sync the factory portfolio at close (or run `/pandacorp:sync-portfolio` from panda-corp).

## Rules
- FRD/work-order numbering is never reset — the project's history is continuous.
- Don't touch the frozen contracts (design tokens, public schemas) without an ADR that justifies it.
