---
id: BP-NN                 # per-FRD blueprint (NN = owning FRD number)
type: blueprint
slug: descriptive-slug
title: Replace with the feature title
status: DRAFT             # DRAFT | ACTIVE | BLOCKED | SUPERSEDED
parent: FRD-NN
implementation_status: PLANNED   # rolls up from this FRD's work orders (worst non-VERIFIED state)
last_updated: YYYY-MM-DD
---

# Blueprint — FRD-NN Replace with the feature title

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **per-feature** blueprint: how THIS feature is built on top of the platform. For the
> platform itself (stack, data model, deploy, cross-cutting), reference `docs/product/architecture.md`
> — do **not** restate it here.

## Purpose

What this feature implements on top of the platform, in one paragraph.

## Components & Interfaces

The components `CMP-NN-<slug>` and interfaces `IF-NN-<slug>` this feature introduces, each traced
back to a requirement `REQ-NN-MMM`. Names + responsibilities.

## Contracts

The API / Server Action / data contracts specific to this feature (inputs, outputs, shapes).

## Dependencies & Risks

Upstream features/modules this depends on; the main technical risks or edge cases.

## Build Plan

> **The build engine READS this — it does not infer dependencies.** This is the DAG of THIS FRD's
> work orders. Write it once, here, at architecture time. Keep work orders **coarse** (one
> view/capability each), so the plan stays small and an agent builds each slice end-to-end.

- **Order & parallelism:** which work order must come first; which depend on earlier slices; which
  can run **in parallel** once a prerequisite is `VERIFIED`.
- **Integration order:** the sequence that makes the slices plug together cleanly (so an agent never
  builds a consumer before its provider).
- **Cross-FRD dependencies:** work orders here that depend on another FRD's work orders (by id), and
  this FRD's position in the cross-FRD order.
- *(Optional)* a Mermaid dependency diagram + a one-paragraph plain-text summary, so the sequencing
  is readable both ways.

## Work Orders

List this FRD's work orders **in build order** (mark the parallelizable ones). Each row links to a
coarse `wo-NN-MMM-<slug>.md`. This list + each work order's frontmatter `implementation_status` is
what the engine walks.
