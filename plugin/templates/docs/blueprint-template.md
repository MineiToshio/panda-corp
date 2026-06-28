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
>
> **Aim at the altitude, not the code (DR-100).** Specify the minimum that removes ambiguity. **If a
> section reads like code (full function bodies, line-by-line pseudo-implementation), it is
> over-specified** — drop back to the contract/shape and let the implementer write the code. Over-spec
> overloads the build agent's attention (context rot) exactly as under-spec lets it guess. Mark any
> open decision inline with `[NEEDS CLARIFICATION: <question>]` — the readiness gate REDs while one
> survives (it may not reach `status: ACTIVE`).

## Purpose

What this feature implements on top of the platform, in one paragraph.

## Components & Interfaces

The components `CMP-NN-<slug>` and interfaces `IF-NN-<slug>` this feature introduces, each traced
back to a requirement `REQ-NN-MMM`. Names + responsibilities.

## Contracts

The API / Server Action / data contracts specific to this feature, each in a **fixed structure
(DR-100)**: **input** (fields + types + validation) · **success** (output shape + status) · **errors**
(each failure case + how it surfaces) · **invariants / pre-postconditions**. Each backend WO
materializes its own contract at `docs/api/<wo-id>.md` (in its `artifacts`) **before any consumer WO
builds against it** — a standardized, materialized contract is what stops separately-built slices from
drifting on format.

## Dependencies & Risks

Upstream features/modules this depends on; the main technical risks or edge cases.

## Build Plan

> **The build engine READS this — it does not infer dependencies.** This is the DAG of THIS FRD's
> work orders. Write it once, here, at architecture time. Keep work orders **coarse** (one
> view/capability each), so the plan stays small and an agent builds each slice end-to-end.

- **Order & parallelism:** which work order must come first; which depend on earlier slices; which
  can run **in parallel** once a prerequisite is `VERIFIED`.
- **Artifacts per WO — disjoint within a wave (DR-060):** record each work order's `artifacts`
  (the globs of files/dirs it writes, matching its frontmatter). **Wave-parallel WOs MUST have
  non-overlapping `artifacts`** — design the plan so it is verifiably disjoint. The engine enforces
  this from the declared artifacts (it serializes any overlap into a later wave), but the plan should
  be disjoint by design; merge genuinely-coupled siblings into one coarse WO instead. Each backend WO
  owns its API contract at `docs/api/<wo-id>.md` (listed in its artifacts), never a shared file.
- **Integration order:** the sequence that makes the slices plug together cleanly (so an agent never
  builds a consumer before its provider).
- **Cross-FRD dependencies:** work orders here that depend on another FRD's work orders (by id), and
  this FRD's position in the cross-FRD order.
- *(Optional)* a Mermaid dependency diagram + a one-paragraph plain-text summary, so the sequencing
  is readable both ways.
- **Visual spec for UI work orders (DR-054):** for any work order with UI, cite the FRD's `fdd.md` +
  the specific `mocks/` file(s)/screen(s) it must **reproduce** — that mock is the binding visual spec
  the implementer reproduces (layout, structure, components, density), not an approximation.
  "Render an element that uses tokens" is **not** sufficient — the built screen must match the mock.
  List the assets the screens need (fonts/images/sprites/icons) so they get staged (e.g. into
  `public/`) and actually render.

## Work Orders

List this FRD's work orders **in build order** (mark the parallelizable ones). Each row links to a
coarse `wo-NN-MMM-<slug>.md`. This list + each work order's frontmatter `implementation_status` is
what the engine walks.

## Readiness check (DR-100)

Before this blueprint goes `ACTIVE` and the build starts, confirm — this is the cohesion gate the
architect runs and `implement`'s preflight re-checks (a blueprint with holes produces ambiguous work
orders): every `REQ-NN-MMM` maps to a component/interface above; **every `AC-NN-MMM.K` of the FRD is
covered by exactly one work order** (no gaps, no duplicates); the platform data model has no `TBD`;
`dependsOn` across the work orders is **acyclic** and every referenced WO exists; wave-parallel WOs
have **disjoint `artifacts`** by design; the **foundation is complete** (every shared primitive any
mock references is a foundation WO); and **no `[NEEDS CLARIFICATION]` survives** anywhere in this
feature's docs.
