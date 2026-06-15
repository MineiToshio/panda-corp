# {{PROJECT_NAME}}

A **Pandacorp** factory project. The whole lifecycle is managed with the `/pandacorp:*` skills.

## Origin — Pandacorp

- Factory: `{{FACTORY_PATH}}` (know-how, idea base, portfolio)
- Original idea card: `{{IDEA_FILE}}` (frozen copy in `docs/idea-origin.md`)
- Standards and process: they come from the **pandacorp plugin** — do NOT look for them in the factory
- ALL of this product's documentation lives HERE in `docs/` — never in the factory
- Project status: `docs/status.yaml` (the factory reads it for its portfolio; keep it current)

## Documentation map

| What | Where |
|---|---|
| Product research | `docs/product-research.md` |
| PRD | `docs/prd.md` |
| FRDs (features + EARS criteria) | `docs/frds/` |
| Design (references, tokens, mockups, decisions) | `docs/design/` + `DESIGN.md` |
| Technical blueprint | `docs/blueprint.md` |
| ADRs | `docs/adr/` |
| Work orders | `docs/work-orders/` |
| Reviews and audits | `docs/reviews/` |
| **Decision log** (decisions + why, history) | `docs/decision-log.md` |
| **Owner-facing narrative** (Spanish, gitignored) | `docs/summary.md`, `docs/decisions.md`, `docs/iteration.md` |

## Project rules

> **Code standards: see `AGENTS.md`** (the factory's durable conventions). The concrete stack is in `docs/blueprint.md`.

1. Language — **git-tracked status decides the language** (committed = English / gitignored = Spanish). Committed → English: code, commits, file/folder names, and product/technical docs (PRD, FRD, blueprint, ADR, README, tests, `docs/decision-log.md`). Gitignored → Spanish: the Pandacorp communication layer (`docs/summary.md`, `docs/decisions.md`, `docs/iteration.md`, `docs/progress.md`) and personal data. User-facing UI copy: i18n, Spanish by default. `docs/status.yaml` is committed (machine state in English); its readable Spanish narrative lives in `docs/summary.md`. **The interaction with the owner is always in Spanish** — everything the agent says in chat and inside any skill (questions, explanations, progress, recommendations) is in Spanish, regardless of the artifact's language.
2. Conventional Commits with scope, on feature branches. Never push directly to main, never force-push.
3. TDD: acceptance-criteria tests BEFORE implementing. Nothing is declared done with red tests — `.pandacorp/verify.sh` must pass.
4. UI only with design tokens from `docs/design/design-tokens.json` — zero hardcoded values. `data-testid` on interactive elements.
5. Forbidden: `any`, `@ts-ignore`, secrets in code, homegrown auth, dependencies that violate the factory's DR-001.
6. Decisions not covered by the documents: consult the factory registry (`factory/decisions/registry.yaml`); if it's not there, escalate to the owner.
7. Document everything (two layers): every relevant change updates its **canonical doc** (behavior → the FRD; technical → blueprint + ADR; design → DESIGN/tokens; scope → PRD) **and** adds an entry to `docs/decision-log.md` with the why, linking the doc. See `AGENTS.md`.

## Current phase

See `docs/status.yaml`. Pipeline: product → design → architecture → build → release → operation.
