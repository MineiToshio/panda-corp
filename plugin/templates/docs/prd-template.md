---
id: PRD                   # or prd-NN-<phase> for multi-PRD products
type: prd
slug: descriptive-slug
title: Replace with the product title
status: DRAFT             # DRAFT | ACTIVE | BLOCKED | SUPERSEDED  (PRD carries only `status`, no implementation_status)
last_updated: YYYY-MM-DD
---

# PRD — Replace with the product title

> The PRD is the thin product layer. It tracks **what** and **why**, not execution state — so it
> carries `status` (document lifecycle) but **not** `implementation_status` (that lives on FRDs,
> blueprints and work orders).

## Vision

One screen / one paragraph: what this product is and the change it makes for its user.

## Feature landscape

A living index of the FRDs (one row per feature module under `docs/frds/frd-NN-<slug>/`). Add a row
when a feature is created. This is the map; the FRDs are the territory.

## Problem & users

The pain being solved and who has it.

## Value hypothesis

The bet: if we ship this, this outcome happens (monetary / opportunity / personal, per `return_type`).

## Assumptions & open decisions

The record of the clarification gate (DR-095). **Assumptions** = each inference made instead of asking,
as `[ASSUMPTION: … — source]` (card / research / profile / standard) so a wrong default is visible.
**Open decisions** = anything still awaiting the owner. Keep it short — this is the audit trail of what
was decided vs assumed, not a discussion log.

## Scope v1 (the MINIMUM)

> v1 is the **smallest** set of features that delivers the value hypothesis — **not** every feature.
> Everything else is Backlog. A bloated v1 is the #1 cause of slow, expensive builds.

List the v1 feature set (a short list of FRDs). Be ruthless.

## Backlog

Explicitly deferred features/changes for later versions (via `/pandacorp:iterate` or
`/pandacorp:new-version`).

## Success metrics

The few signals that tell us the value hypothesis held (tied to the event plan).
