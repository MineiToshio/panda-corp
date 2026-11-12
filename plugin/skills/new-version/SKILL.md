---
name: new-version
user-invocable: false
description: Internal planning engine for a formal milestone (v2, v3…) with its own mini-PRD. Reached through /pandacorp:implement when the requested scope requires a new version; never a separate owner command.
---

# /pandacorp:new-version

New iteration of an existing project. Runs IN the project. This is an **internal planning engine**, not an owner command: `/pandacorp:implement` is the single entry for building, resuming, features and bugs. It routes a version-scale request here when a new mini-PRD is needed. `$ARGUMENTS`: what the milestone should achieve.

> **Entry.** A version-scale request (new PRD or several epics) is not silently built as an ordinary run. Define the milestone with the owner present, preserve the requested scope and prepare its explicit plan before returning to `/pandacorp:implement`. The queue is a file format, not a build entry: no automatic drain selects a milestone. If a build is live, defer planning until it releases ownership at a safe point; never rewrite its docs concurrently.

> **Preflight (DR-045) — is this a Pandacorp project?** This skill mutates the project, so first confirm the Pandacorp marker: `.pandacorp/status.yaml` exists. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing project in, `/pandacorp:spec` creates a new one. Then, if `overlay_version` in `.pandacorp/status.yaml` is behind the plugin's `OVERLAY_VERSION`, run `/pandacorp:upgrade` first (silent for compatible bumps, DR-048) — **but if a build is running (`bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-build-liveness.sh" .pandacorp/status.yaml` returns `RUNNING`, including a fresh fenced lease; malformed leases fail closed) do NOT run `/pandacorp:upgrade` mid-build: it must never regenerate the engine/gates under a live build (its own active-build guard also refuses).** For a new request during a live build, record a `status: draft` card and validate it with `node "${CLAUDE_PLUGIN_ROOT}/scripts/pandacorp-build.mjs" card check .pandacorp/inbox/changes/<slug>.md`; do not mutate the running plan. An explicit later `/pandacorp:implement <slug>` selects it. Don't proceed or invent docs over a missing structure.

## Steps

1. **Context**: read `.pandacorp/status.yaml` (a shipped project sits at `phase: release`, DR-085), `docs/product/prd.md` (vision + the living feature-landscape backlog of future versions), accumulated feedback / post-launch results (from `/pandacorp:review-launch`) and the existing FRD modules under `docs/frds/`.
2. **Define the version**: with the `product-manager` agent, turn the goal into concrete scope — which new FRDs, which existing FRDs change, what is left out (DR-012). Record the intended version in the mini-PRD; project state remains CLI-managed. The formal mini-PRD distinguishes this engine from day-to-day `iterate` planning.
3. **Re-enter the pipeline, only what changes** (feature-centric, DR-049 — a new feature is a new `docs/frds/frd-NN-<slug>/` module, nothing else moves):
   - New FRD → new `docs/frds/frd-NN-<slug>/frd.md` module (numbering continues); modified FRD → edit its existing module
   - New screens or visual changes? → mini design phase (mockup of the new stuff in the FRD's `mocks/` + its `fdd.md`, same frozen global design system in `docs/design/`; visual gate only if the visual language changes)
   - Architectural impact? → update the feature's `docs/frds/frd-NN-<slug>/blueprint.md` (and `docs/product/architecture.md` only if it's platform-level) + ADR; if not, skip
   - New work orders → the feature's `docs/frds/frd-NN-<slug>/work-orders/` (per-FRD numbering continues); a change that **extends an existing work order** → **reopen it** (`implementation_status: VERIFIED → PLANNED` in its frontmatter + widen its scope/`Status Note`) so the engine rebuilds only what changed (DR-050)
4. **Implementation**: return the explicit milestone plan to `/pandacorp:implement`, which also runs the security/quality/metrics hardening as its last step (DR-085). Full regression: the tests of previous versions must stay green.
5. **Release**: `/pandacorp:release` — deploy/launch the new version (internal or external, same `deploy_target`).
6. Sync the factory portfolio at close (or run `/pandacorp:sync-portfolio` from panda-corp).

## Rules
- FRD/work-order numbering is never reset — the project's history is continuous.
- Don't touch the frozen contracts (design tokens, public schemas) without an ADR that justifies it.
