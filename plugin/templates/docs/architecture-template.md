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

## Owner decisions

The decisions the owner took in the architecture decision round (DR-131), one line each with its ADR:
`D1 · <decision> → <answer> (ADR-NNNN, decided by the owner YYYY-MM-DD | default)`. Nothing below may
contradict them; changing one is a new owner decision.

## Golden path & stack

The chosen stack with **pinned versions** (language/runtime, framework, package manager, DB/ORM,
test framework, lint/format). One line on *why* this path (link the deciding ADR in `docs/adr/`).

### Pinned versions

The resolver table (`skills/architecture/scripts/resolve-versions.mjs`: stable only, SEC-4 cooldown,
peer/family majors aligned) with the resolution date: package · exact version · published · exact
`pnpm add --save-exact` command · which WO installs it (or "scaffold"). Work orders cite this table.

## Data model

Describe the persistence layer, canonical schema/model source paths and isolated-data-layer boundary.
Publish the complete logical projection at **`docs/product/data-model.json`** following the injected
`docs/rules/logical-data-model.md` (DATA-7): entities/attributes/types, keys/composite groups,
explicit mappings and both endpoint cardinalities. This artifact powers Mission Control's existing
**Modelo de datos** section, shared by board and portfolio. Link it rather than maintaining another
diagram by hand. A stateless/no-database project publishes explicit `persistence: none` with empty
arrays; never omit the fact or invent entities. Name the project-local exporter/validation command
when available, otherwise require source-grounded update + independent review. Every logical schema
change refreshes the artifact in the same change/commit, including fixes and post-launch edits.

## Service boundaries / module map

How the system splits into deploy units / modules and how they talk. *(Single-app MVP: one line.)*

## Cross-cutting concerns

Auth & authorization, error handling, i18n, logging/observability, config & feature flags — the
decisions that apply across features. Each one a line; deep dives go to an ADR. *Mark N/A what
doesn't apply.*

## Media & third-party content

Every image/file/video the product shows or exports that it does not author itself. Per source:
where it comes from (official site, partner, community, user upload); **store vs hotlink vs
same-origin proxy** (and the host allowlist + CSP `img-src` it implies); the rights stance (licensed,
own content, or an accepted risk with its mitigation: credit, link, honour takedowns); the fallback
when it is missing or broken; and link-rot handling (who re-checks URLs, how often). Link the
decision-round ADR. *No third-party media: say so in one line.*

## Operations & admin tooling

Who creates and curates the product's data after launch, and through what: an admin/operator web UI,
owner-run agent skills over an ops CLI, seed files, or nothing in v1. Name the write path (which
module/command is the single writer), its authorization, and what is deliberately NOT exposed on the
web. Link the decision-round ADR. *A product with no curated data: say so in one line.*

## External services & secrets

Selected third-party services and limits/costs, private account/resource references (no personal IDs),
and secret management (`factory/standards/external-services.md`). Publish the value-free variable contract:
name · purpose · origin · environment · exact destination (web/worker/migration/local/CI) · consumer
path or owning WO · installed/planned · required now · secret-store reference · status. `.env.example`
mirrors the approved names and ends with LOCAL-ONLY tooling. Do not invent future secrets. Even without
external services, include any required local app secrets; otherwise state N/A.

After decisions/contract are final, fill obtainable values privately per architecture
`references/environment-delivery.md`: exactly three root dotenv files — tracked placeholder guide
`.env.example`, protected development `.env.local` and production handoff `.env.production`. Group by
service within destination blocks (web/renderer/operator as selected), using aliases and explicit
runtime exports where names/privileges differ. Local-only entries are last in guide/dev, absent from
production. Document mappings/commands and synthetic proof of framework precedence/target isolation;
missing bindings stay pending. Never upload the complete bundle or add per-destination dotenv files.
For migration credentials, document local execution from the owner's Mac separately from the DB target:
development in `.env.local`, production in `.env.production`; guide/dev entries go below the final
local/operator-only separator, while production gets a labelled operator block. Comments name the
migration CLI that reads the connection and say it is never uploaded to Vercel/Modal runtime. Do not
invent a migration variable without a concrete consumer or run migrations during preparation. The private report at
`.pandacorp/comms/entrega-entornos.md` records status/evidence without values. Link it by path only.
Prepared production inputs are not a production deployment or verified production readiness.

## Deploy & environments

Environments, CI/CD shape, hosting target, rollback. *(Local/internal tool: say so and stop.)*

### Test database (DR-140, INFRA-9/10)

If the project has a database: native Homebrew `postgresql@NN` on `127.0.0.1:<base+2>` (review `<base+3>`), data dir, database names (`<slug>_template`, per-run `<slug>_test_*`), the variable the tests read (`TEST_DATABASE_URL`), and the commands (`pnpm db:test:up`, `pnpm db:test:down`, `pnpm db:test:check-clean`). State the zero-residue mechanism (drop at teardown, rollback, stale sweep, post-run check in `verify.sh`). Never Docker, never Neon for tests; app development uses the Neon dev branch.

## Non-functional constraints

Performance / scale / cost / privacy targets that bind every feature. Keep to what actually binds.
