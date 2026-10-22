---
name: work-orders
description: Generates or regenerates a Pandacorp project's work orders from the
  FRDs and the blueprint. In the normal flow the work orders are created by
  /pandacorp:architecture together with the blueprint; use this skill separately
  only to regenerate or adjust them.
user-invocable: false
---

# /pandacorp:work-orders

Decomposition into **coarse** work orders. Runs IN the project (requires the FRDs with their per-FRD blueprints and the platform `docs/product/architecture.md`).

Runs inside the project.

## Team

- architect
- implementer
- frontend-dev
- analytics
