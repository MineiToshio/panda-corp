# AGENTS.md — {{PROJECT_NAME}}

Standards for any AI agent working on this project. It is the source of truth for conventions, aligned with the Pandacorp factory standards. (Claude Code reads `CLAUDE.md`, which imports this file.)

## Priority order
User request → this AGENTS.md → the project documents in `docs/` → language defaults.

## Durable conventions (mandatory)

**Language** — git-tracked status decides the language: committed → English (code: variables, functions, types, comments, commits; and product/technical docs); gitignored → Spanish (the owner-facing communication layer + personal data). User-facing content via i18n, Spanish by default (never hardcoded). **The interaction with the owner is always in Spanish** — everything the agent says in chat and inside any skill (questions, explanations, progress, recommendations) is in Spanish, regardless of the artifact's language.

**Typing**: strict always (TS `strict` / `mypy --strict`). `any` and `@ts-ignore` forbidden. Prefer `unknown`.

**Structure**: isolated data layer (all DB access in `queries/` or an equivalent layer, never from components). Feature-first code (`_components/`, `_actions/`, `_schemas/`). Reuse before creating (check `components/core` → `modules` → local). Colocated tests; e2e in `e2e/`.

**Patterns** (web stack): Server Components by default, `"use client"` only when needed; Server Actions first; optimistic UI (update and revert on failure); semantic HTML + a11y (axe-core); light/dark theme with semantic variables; styles only with design tokens (`docs/design/design-tokens.json`), never hardcoded colors.

**Constants**: no magic strings/numbers; centralize in `lib/constants.ts`. Validate inputs at the boundaries with Zod (or equivalent).

**Commits**: Conventional Commits with scope, in English. Direct push to `main` is fine (solo operator; quality gate = the `implement` reviewer + `.pandacorp/verify.sh`). Never force-push; use a throwaway branch only for big/risky changes.

**Quality — before calling something done** (verified by `.pandacorp/verify.sh`): green tests + type-check + lint/format with no errors. TDD per work order (RED → GREEN → refactor). E2E only on critical flows with `data-testid`.

**Documentation (two layers, feature-centric)**: docs are grouped by feature — one self-contained module per feature at `docs/frds/frd-NN-<slug>/` (`frd.md`, optional `fdd.md`+`mocks/`, `blueprint.md`, `work-orders/`) under a thin product layer (`docs/product/prd.md`, `docs/product/architecture.md`, `docs/product/research.md`). Two architecture layers: platform (`docs/product/architecture.md`, one per project) vs feature (`frd-NN-<slug>/blueprint.md`, per-FRD). Traceability IDs: `REQ-NN-MMM` → `AC-NN-MMM.K` → `CMP-NN-<slug>`/`IF-NN-<slug>` → `WO-NN-MMM`; source-of-truth hierarchy `FRD > FDD > design-tokens > blueprint > work order`. Every relevant change updates its **canonical doc** —behavior → the feature's `docs/frds/frd-NN-<slug>/frd.md`; feature implementation → that feature's `blueprint.md`, platform-wide → `docs/product/architecture.md` + an ADR; design → `DESIGN.md`/tokens; scope → `docs/product/prd.md`— **and** adds an entry to `docs/decision-log.md` (date, what, why, link to the doc). The canonical doc is the current truth; the decision log is the history. A behavior change is not done without its updated FRD and its log entry. Standard: the factory's `documentation.md`.

**Changes through skills (write-gate)**: WITH the pandacorp plugin, changes that touch app behavior, a canonical doc (PRD/FRD/blueprint/ADR/DESIGN) or state (`.pandacorp/status.yaml`, work-orders) flow through the `/pandacorp:*` skills — the *assisted* path that keeps the two layers, status, work-orders, TDD and review honest. Exempt (do directly): reading/debugging and micro non-product edits (a typo, local config, a throwaway experiment). When the owner asks for a change, classify it and auto-invoke the right skill, announcing it (behavior → `iterate`; bug found testing → `bug`; a decision → `decide`; big package → `new-version`); auto-invoking enters the skill only — its internal human-gates (production, money, delete, external comms) still ask. WITHOUT the plugin (a fork/clone of just this repo) the skills aren't available — apply the same discipline by hand: when you change behavior, update the matching FRD + `docs/decision-log.md`. Detail in `.pandacorp/guide.md`.

## This project's stack
Defined in `docs/product/architecture.md` (the platform architecture, chosen and approved in the architecture phase). See concrete versions and services there; per-feature implementation design lives in each `docs/frds/frd-NN-<slug>/blueprint.md`.

## Detail
The factory's full standards: conventions, structure, patterns, quality and recommended stack. If something isn't here, follow the spirit of these principles and, if it's a recurring decision, consult the factory's decision registry.
