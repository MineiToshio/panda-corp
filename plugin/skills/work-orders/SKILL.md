---
description: Generates or regenerates a Pandacorp project's work orders from the FRDs and the blueprint. In the normal flow the work orders are created by /pandacorp:blueprint together with the blueprint; use this skill separately only to regenerate or adjust them.
---

# /pandacorp:work-orders

Decomposition into work orders. Runs IN the project (requires FRDs and blueprint).

## Steps

1. Read all the v1 FRDs and the blueprint. Build the dependency graph (what does the data model need? what does auth need? what is independent?).
2. **Generate** `docs/work-orders/wo-NN-<name>.md`, each one with:
   - FRD(s) it implements and acceptance criteria copied in (the implementer should not have to go look for them)
   - Exact scope: which files/modules it touches; what it does NOT include
   - Dependencies (prior wos) and definition of done: tests of the criteria green + typecheck + lint + review approved
   - Status: `pending | in-progress | in-review | done` (checkbox + evidence)
3. **Right size**: each work order completable in one agent session and **testable in isolation** (neither "build the backend" nor "rename a variable"). Practical rule (Spec Kit): if you can't write the work order's acceptance test in one sentence, it's badly cut — split it. The `reviewer` rejects work orders too large to review on their own. Typical: 5-15 work orders for a v1.
4. **Execution order**: master list in `docs/work-orders/README.md` with the order and what can be parallelized (no shared files between parallel ones).
5. **Update** `.pandacorp/status.yaml` → `phase: implementation` and commit. Summary to the owner: how many work orders, order, rough estimate. Next step: `/pandacorp:implement`.

## Rules
- The first work order is always the base: data schema + seeds + environment smoke test.
- Each acceptance criterion of each FRD must be covered by exactly one work order (no gaps or duplicates).
