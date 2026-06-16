---
description: Generates or regenerates a Pandacorp project's work orders from the FRDs and the blueprint. In the normal flow the work orders are created by /pandacorp:blueprint together with the blueprint; use this skill separately only to regenerate or adjust them.
---

# /pandacorp:work-orders

Decomposition into work orders. Runs IN the project (requires the FRDs with their per-FRD blueprints and the platform `docs/product/architecture.md`).

## Steps

1. Read all the v1 FRDs (`docs/frds/frd-NN-<slug>/frd.md`), each FRD's `blueprint.md` and the platform `docs/product/architecture.md`. Build the dependency graph (what does the data model need? what does auth need? what is independent?).
2. **Generate per-FRD work orders** at `docs/frds/frd-NN-<slug>/work-orders/wo-NN-MMM-<slug>.md` (`NN` = FRD folder number), each one with:
   - A header restating the **source-of-truth hierarchy** (`FRD > FDD > design-tokens > blueprint > work order`)
   - The `REQ-NN-MMM`/`AC-NN-MMM.K` it implements with the **acceptance criteria copied inline** (the implementer should not have to go look for them) and the `CMP-NN-*`/`IF-NN-*` it builds against
   - **Exactly ONE deploy unit/repo** as its target
   - Exact scope: which files/modules it touches; what it does NOT include
   - `Dependencies` (prior WOs — may reference WOs in **other** FRDs, by `WO-NN-MMM`) and definition of done: tests of the criteria green + typecheck + lint + review approved
   - Status: `pending | in-progress | in-review | done` (checkbox + evidence)
3. **Right size**: each work order completable in one agent session and **testable in isolation** (neither "build the backend" nor "rename a variable"). Practical rule (Spec Kit): if you can't write the work order's acceptance test in one sentence, it's badly cut — split it. The `reviewer` rejects work orders too large to review on their own. Typical: 5-15 work orders for a v1.
4. **Execution order**: per-FRD list in `docs/frds/frd-NN-<slug>/work-orders/README.md` with the intra-feature order and what can be parallelized (no shared files between parallel ones). Cross-feature order is derived from each WO's `Dependencies` — the build walks every FRD's `work-orders/`; there is no global work-orders folder.
5. **Update** `.pandacorp/status.yaml` → `phase: implementation` and commit. Summary to the owner: how many work orders, order, rough estimate. Next step: `/pandacorp:implement`.

## Rules
- The first work order is always the base: data schema + seeds + environment smoke test.
- Each acceptance criterion (`AC-NN-MMM.K`) of each FRD must be covered by exactly one work order (no gaps or duplicates).
