---
id: ARCH                  # the platform architecture (one per project)
type: architecture
slug: descriptive-slug
title: Replace with the product title
status: DRAFT             # DRAFT | ACTIVE | BLOCKED | SUPERSEDED
last_updated: YYYY-MM-DD
---

# Architecture — Replace with the product title

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **platform** layer (stable, ONE per project): stack, data model, deploy and
> cross-cutting concerns. How a *single feature* is built lives in that feature's
> `docs/frds/frd-NN-<slug>/blueprint.md` — do **not** describe per-feature design here.

## Golden path & stack

The chosen stack with **pinned versions** (language/runtime, framework, package manager, DB/ORM,
test framework, lint/format). One line on *why* this path (link the deciding ADR in `docs/adr/`).

## Data model

The core entities and their relationships (a small diagram or list). The persistence layer and the
isolated-data-layer boundary (where DB access lives). *Omit for a stateless project.*

## Service boundaries / module map

How the system splits into deploy units / modules and how they talk. *(Single-app MVP: one line.)*

## Cross-cutting concerns

Auth & authorization, error handling, i18n, logging/observability, config & feature flags — the
decisions that apply across features. Each one a line; deep dives go to an ADR. *Mark N/A what
doesn't apply.*

## External services & secrets

Third-party services, accounts and APIs (limits/costs), and how secrets are managed
(`factory/standards/external-services.md`). *Omit if none.*

## Deploy & environments

Environments, CI/CD shape, hosting target, rollback. *(Local/internal tool: say so and stop.)*

## Non-functional constraints

Performance / scale / cost / privacy targets that bind every feature. Keep to what actually binds.
