---
description: Generates or regenerates a Pandacorp project's work orders from the FRDs and the blueprint. In the normal flow the work orders are created by /pandacorp:blueprint together with the blueprint; use this skill separately only to regenerate or adjust them.
---

# /pandacorp:work-orders

Decomposition into **coarse** work orders. Runs IN the project (requires the FRDs with their per-FRD blueprints and the platform `docs/product/architecture.md`).

## Steps

1. Read all the v1 FRDs (`docs/frds/frd-NN-<slug>/frd.md`), each FRD's `blueprint.md` (including its **Build Plan**) and the platform `docs/product/architecture.md`.
2. **Generate per-FRD work orders** at `docs/frds/frd-NN-<slug>/work-orders/wo-NN-MMM-<slug>.md`, each following the template `${CLAUDE_PLUGIN_ROOT}/templates/docs/work-order-template.md`:
   - **The frontmatter is the source of truth** (DR-050): `implementation_status: PLANNED` (the build engine reads this to know what to build), `status: ACTIVE`, `parent: FRD-NN`, `source_requirements` with the `REQ-NN-MMM` it delivers.
   - The `REQ-NN-MMM`/`AC-NN-MMM.K` it implements with the **acceptance criteria copied inline** (the implementer should not have to go look for them) and the `CMP-NN-*`/`IF-NN-*` it builds against.
   - In/Out scope, `Dependencies` (prior WOs by `WO-NN-MMM`, intra- or cross-FRD), and a **`## Status Note` (hand-off)** section the implementer fills on close so the next agent reads it instead of re-reading all the code.
3. **Granularity — COARSE, and group generously.** One work order = one cohesive view / page / capability (e.g. "order detail view + payments panel + action menu"), NOT one atomic component. **Prefer fewer, larger work orders — when in doubt, merge.** The build engine reviews and tests **per FRD**, so each WO must carry enough context to build the whole slice end-to-end. Split only if a WO is genuinely too big to review on its own; merge anything smaller than a usable slice. Typical: a handful of coarse work orders per FRD (think PandaTrack: ~one per view), not dozens of tiny ones.
   - **One module per work order — no same-file siblings.** Two work orders that build in the same wave must NOT write the same file/module: parallel implementers would collide (a real failure mode). If two slices need the same file, **merge them into one work order** (preferred) or make one depend on the other so they serialize. A work order's artifacts must be **disjoint** from its wave-siblings'. This alone pushes granularity coarser, the right way.
4. **The build order lives in the blueprint's Build Plan** (written by `/pandacorp:blueprint`: the DAG of deps + parallelism + integration order). Each work order's `Dependencies` must be consistent with that plan; the per-FRD list with what parallelizes lives in `docs/frds/frd-NN-<slug>/work-orders/README.md`. Cross-feature order comes from the `Dependencies` + the blueprints' cross-FRD notes.
5. **Update** `.pandacorp/status.yaml` → `phase: implementation` and commit. Summary to the owner: how many coarse work orders, the build order, rough estimate. Next step: `/pandacorp:implement`.

## Rules
- **State lives in the frontmatter** (`implementation_status`: `PLANNED → IN_PROGRESS → IN_REVIEW → VERIFIED`, + `BLOCKED`), never in body prose or in git (DR-050). The engine builds only `PLANNED`/`IN_PROGRESS` and never rebuilds `VERIFIED`.
- The first work order of the data-owning FRD is the base: data schema + seeds + environment smoke test.
- Each acceptance criterion (`AC-NN-MMM.K`) of each FRD is covered by exactly one work order (no gaps or duplicates).
