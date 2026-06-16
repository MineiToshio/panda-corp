# {{PROJECT_NAME}}

A **Pandacorp** factory project. The whole lifecycle is managed with the `/pandacorp:*` skills.

## Origin — Pandacorp

- Factory: `{{FACTORY_PATH}}` (know-how, idea base, portfolio)
- Original idea card: `{{IDEA_FILE}}` (frozen copy in `docs/idea-origin.md`)
- Standards and process: they come from the **pandacorp plugin** — do NOT look for them in the factory
- ALL of this product's documentation lives HERE in `docs/` — never in the factory
- Project status: `docs/status.yaml` (the factory reads it for its portfolio; keep it current)

## How changes are made — work through the skills

Changes to this project go through the `/pandacorp:*` skills, not ad-hoc free-chat edits. A skill keeps the process honest: two-layer documentation (canonical doc + `docs/decision-log.md`), `docs/status.yaml`, FRDs/work-orders, TDD and review. A free-chat edit skips all of that and the docs/state drift out of sync.

**Pragmatic frontier — what needs a skill and what doesn't:**

| Do directly (no skill) | Go through a skill |
|---|---|
| Read, explain, debug, answer questions | Change app **behavior** (a feature, a fix that alters what the app does) |
| Micro non-product edits: a typo in a comment, local config, a throwaway experiment | Touch a **canonical doc**: PRD, FRD, blueprint, ADR, `DESIGN.md`/tokens |
| | Change **state**: `docs/status.yaml`, work-orders |

**The agent routes automatically.** When the owner asks for a change, classify it and **invoke the right skill, telling them which one** — do not ask permission to enter the skill:

| What the owner asks | Skill |
|---|---|
| "add this feature" / "change this behavior" | `/pandacorp:iterate` |
| "I found this bug while testing" | `/pandacorp:bug` |
| "I decide X" (on a pending point) | `/pandacorp:decide` |
| big package / redesign | `/pandacorp:new-version` |

Auto-invoking covers **entering** the skill only. The skill's internal human-gates stay intact: deploying to production, spending money, deleting data or external communications still stop and ask for the owner's OK.

**Working without the plugin (forks & clones).** The `/pandacorp:*` skills and hooks live in the owner's Claude install (the pandacorp plugin), NOT in this repo. If you cloned or forked only this project and don't have the plugin, the skills simply aren't there — and that's fine: **this repo is fully workable on its own.** Follow `AGENTS.md` by hand — TDD, and when you change behavior update the matching FRD in `docs/frds/` and add an entry to `docs/decision-log.md`. The skills are the *assisted* path, never a lock on contributing.

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
2. Conventional Commits with scope, in English. Direct commits/push to `main` are fine (solo operator; the quality gate is the `implement` reviewer + `.pandacorp/verify.sh`). Never force-push; use a throwaway branch only for big/risky changes.
3. TDD: acceptance-criteria tests BEFORE implementing. Nothing is declared done with red tests — `.pandacorp/verify.sh` must pass.
4. UI only with design tokens from `docs/design/design-tokens.json` — zero hardcoded values. `data-testid` on interactive elements.
5. Forbidden: `any`, `@ts-ignore`, secrets in code, homegrown auth, dependencies that violate the factory's DR-001.
6. Decisions not covered by the documents: consult the factory registry (`factory/decisions/registry.yaml`); if it's not there, escalate to the owner.
7. Document everything (two layers): every relevant change updates its **canonical doc** (behavior → the FRD; technical → blueprint + ADR; design → DESIGN/tokens; scope → PRD) **and** adds an entry to `docs/decision-log.md` with the why, linking the doc. See `AGENTS.md`.

## Current phase

See `docs/status.yaml`. Pipeline: product → design → architecture → build → release → operation.
