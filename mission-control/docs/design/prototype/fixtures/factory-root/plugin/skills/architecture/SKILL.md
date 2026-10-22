---
name: architecture
description: Architecture phase of a Pandacorp project - input-readiness
  preflight, an owner decision round (stack, hosting cost, media store-vs-link,
  ingestion/admin tooling, plus explicit PostHog, Sentry, i18n scope and
  SEO/metadata decisions) with alternatives and a recommendation BEFORE any
  document, then the platform architecture, data model, ADRs, per-FRD blueprints
  and work orders through a cross-FRD plan and three parallel gates, and the
  stack installation. Generates BOTH documents (blueprint and work orders). Use
  inside the project after /pandacorp:design. It is the design → architecture
  step.
---

# /pandacorp:architecture

Architecture phase. Runs IN the project (requires PRD, FRDs and frozen design). Produces **two artifacts**: the
technical blueprint (platform `docs/product/architecture.md` + one `blueprint.md` per FRD) and the work orders ready
to build, plus the installed stack and the owner's Spanish digest. The owner decides every owner-visible technical
choice in ONE round at the start (DR-131); everything else follows the standards.



## Team

- architect
- product-manager
- copywriter
- researcher
- analytics
- devops
- designer
- implementer
- reviewer
