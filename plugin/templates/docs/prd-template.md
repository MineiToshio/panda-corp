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

## Demand signal (DR-042)

What `/pandacorp:spec`'s step-0 demand pre-check found BEFORE scaffolding (copied from the idea card's
Evidencia): live paying competitors / pain frequency / who pays (B2B) — with links. The PM cross-checks
the FRD scope against this; a scope that contradicts the recorded signal is flagged, not built.

## Monetization (DR-035 / DR-042)

- **v1 with payments? yes / no** — the explicit owner decision (yes ⇒ Polar/MoR wiring + the Vercel Pro
  warning apply). Never leave it implicit.
- **Unit economics (monetary/mixed only):** price anchor (what live competitors charge), the per-active-user
  variable cost (from the architecture's cost ADR), and the resulting break-even. A "monetizable" idea
  closes with a number here, or says why not yet.

## Launch market & language (DR-041)

The researched decision: which market/country first, which language(s) (single vs multi from the MVP),
and why — owner-approved. No automatic default.

## Target platforms (DR-074)

One line: `desktop | mobile | responsive` — who uses it on what device. Mirrors `target_platforms` in
`.pandacorp/status.yaml` (the responsive gate enforces it downstream).

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

## Activation milestone & kill-signals (DR-043)

What `/pandacorp:review-launch` reads to reach a kill / hold / double-down verdict — without these it has
no anchor:

- **Activation milestone:** the ONE user action that means "value delivered" (e.g. "created their first
  report"), measurable by a named event in `docs/analytics/events.md`.
- **Kill-signals (numeric + windowed):** e.g. "< N activated users after M weeks", "retention < X% at
  week 4", "0 payments after N visits" — each with its threshold and evaluation window. These are the
  pre-agreed criteria so the verdict is read from data, not re-negotiated after launch.
