---
id: FRD-NN
type: frd
slug: descriptive-slug
title: Replace with the feature title
status: DRAFT             # DRAFT | ACTIVE | BLOCKED | SUPERSEDED
parent: PRD               # the product/PRD this feature belongs to
implementation_status: PLANNED   # PLANNED | IN_PROGRESS | IN_REVIEW | VERIFIED | BLOCKED (rolls up from work orders)
source_requirements: []
last_updated: YYYY-MM-DD
---

# FRD-NN Replace with the feature title

> A feature is a **self-contained module** (DR-049): this `frd.md` (the user contract), an optional
> `fdd.md` + `mocks/` (UI design), a `blueprint.md` (technical design + Build Plan) and `work-orders/`.
> The `implementation_status` here rolls up from this feature's work orders; the build engine uses it
> to skip features that are fully `VERIFIED`.

## Overview & domain goal

What this feature is, the user/business outcome it must achieve, and how it contributes to the PRD.

## User stories

Representative user intentions (why the feature matters), user-centered.

## Requirements & acceptance criteria

Each functional requirement gets a stable id `REQ-NN-MMM` and **EARS acceptance criteria**
`AC-NN-MMM.K` (`WHEN <trigger> THE SYSTEM SHALL <response>`), written so each is independently
testable. These IDs are the traceability spine down to components and work orders.

## Business rules

Domain rules, invariants and policy decisions that constrain behavior.

## Out of scope

Nearby capabilities intentionally excluded from this feature.

## Confirmed vs open questions

- **Confirmed:** decisions settled — not open for redesign.
- **Open questions:** unresolved dependencies/decisions still needing the owner.

## Linked blueprint & work orders

Point to this feature's `blueprint.md` (which holds the **Build Plan**) and its `work-orders/`.
