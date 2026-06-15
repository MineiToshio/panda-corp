# AGENTS.md — {{PROJECT_NAME}}

Standards for any AI agent working on this project. It is the source of truth for conventions, aligned with the Pandacorp factory standards. (Claude Code also reads `CLAUDE.md`, which points here.)

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

**Documentation (two layers)**: every relevant change updates its **canonical doc** —behavior → the corresponding FRD (`docs/frds/`); technical → `docs/blueprint.md` + an ADR; design → `DESIGN.md`/tokens; scope → `docs/prd.md`— **and** adds an entry to `docs/decision-log.md` (date, what, why, link to the doc). The canonical doc is the current truth; the decision log is the history. A behavior change is not done without its updated FRD and its log entry. Standard: the factory's `documentation.md`.

## This project's stack
Defined in `docs/blueprint.md` (chosen and approved in the architecture phase). See concrete versions and services there.

## Detail
The factory's full standards: conventions, structure, patterns, quality and recommended stack. If something isn't here, follow the spirit of these principles and, if it's a recurring decision, consult the factory's decision registry.
