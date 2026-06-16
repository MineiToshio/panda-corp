---
description: Adopts an EXISTING project that was NOT born from the Pandacorp handoff (a brownfield / external project) into the factory. Injects the overlay without clobbering, infers the real phase from the code, reconstructs minimal as-built docs, registers it in the portfolio with a retroactive idea card, and hands off to the normal skills. Runs INSIDE the existing project. The brownfield counterpart of /pandacorp:scaffold.
---

# /pandacorp:adopt

Brings a project built **outside** the factory under Pandacorp management. Run it **inside** the existing project folder. It is the brownfield mirror of `scaffold` (greenfield): instead of creating an empty project, it wraps what already exists, so that from then on the `/pandacorp:*` skills, Mission Control and the write-gate (DR-044) apply to it. Touching an existing project = **human gate**: present the adoption plan and get the owner's OK before writing anything (DR-045, DR-038).

## When to use
The owner has a project they built by hand (or cloned) and wants the factory to manage it. If the folder is ALREADY a Pandacorp project (`docs/status.yaml` + `Origin — Pandacorp` in `CLAUDE.md`), stop — it's already adopted. If the folder is empty / has no real code, this isn't an adoption → use `/pandacorp:spec`.

## Steps

1. **Idempotence / sanity check.** If `docs/status.yaml` exists AND `CLAUDE.md` contains `Origin — Pandacorp`, say it's already a factory project and stop. Confirm there's a real codebase here.

2. **Read the project to understand it (NO writes yet).** Inspect the repo to learn what it IS and what PHASE it's in:
   - Stack & structure: `package.json` / `pyproject.toml` / etc., framework, entry points, `git log` (history, maturity), `git remote` (does a GitHub repo already exist?).
   - Maturity signals → **inferred phase**: live deploy / CI to prod / a production URL → `operation`; substantial code + tests but no deploy → `implementation`; only boilerplate/scaffolding → `architecture`. State the inference AND its evidence.
   - What the app DOES (features, routes, data model) — the raw material for the as-built docs.

3. **Present the adoption plan + its consequences (HUMAN GATE).** Adoption is a commitment, so spell it out and get an explicit OK before writing (in Spanish): (a) the files to be CREATED vs MERGED (never overwritten) and the retroactive idea card + portfolio row; (b) the inferred phase + evidence; (c) ask the `return_type` (personal / monetary / mixed / opportunity, DR-039); and (d) **what it means going forward** — the project becomes a Pandacorp project, so from now on changes flow through the `/pandacorp:*` skills (write-gate, DR-044), while staying fully workable without the plugin (anyone cloning just the repo follows `AGENTS.md` by hand). DR-038: also push-notify. On "no", stop and change nothing.

4. **Inject the overlay WITHOUT clobbering.** Copy the template overlay (`${CLAUDE_PLUGIN_ROOT}/templates/shared/`) but never overwrite existing files:
   - **New files** (don't exist): copy as-is, process the `.tpl` vars (`{{PROJECT_NAME}}`, `{{FACTORY_PATH}}`, `{{IDEA_FILE}}`, `{{DATE}}`), drop the `.tpl` suffix.
   - **CLAUDE.md / AGENTS.md already present**: do NOT replace them — APPEND the `Origin — Pandacorp` section, the "How changes are made" write-gate section and a pointer to `AGENTS.md`, preserving the project's own content.
   - **.gitignore present**: MERGE the Spanish-comms-layer ignores (`docs/summary.md`, `docs/decisions.md`, `docs/iteration.md`, `docs/progress.md`, `docs/activity.md`), without duplicating.
   - **.claude/settings.json present**: merge the `permissions.deny` entries.
   - Always bring `.claude/workflows/pandacorp-build.js` (the build engine `implement` launches). The marker that makes the factory recognize the project is `docs/status.yaml` (step 5) + the appended `Origin — Pandacorp`.

5. **Create the docs skeleton + state.** Create `docs/` with `frds/`, `design/`, `adr/`, `work-orders/`, `reviews/` where missing. Write `docs/status.yaml` with the inferred `phase`, the real `version` (from tags / `package.json`, default `v1`), `running: false`, counters at 0, `repo` from `git remote`. Seed `docs/decision-log.md` and `docs/iteration.md` if absent.

6. **Reconstruct minimal AS-BUILT docs** (so downstream skills have an anchor). This is reverse-documentation, clearly marked as reconstructed:
   - `product-manager` writes `docs/prd.md` describing what the app does TODAY (problem, users, current scope) + `docs/frds/frd-NN-*.md` for the existing features, with EARS criteria anchored to ACTUAL behavior. Header each one: *"As-built — reconstructed by /pandacorp:adopt on {{DATE}}; describes existing behavior, not a forward plan."*
   - `architect` writes `docs/blueprint.md` capturing the REAL stack/architecture + `docs/adr/adr-000-adopted-stack.md` (as-built).
   - Keep it minimal and honest: stubs with TODOs are fine where behavior is unclear; do NOT invent product rationale. Flag the gaps for the owner.

7. **Register in the factory (bidirectional links).**
   - Create the retroactive idea card `factory/ideas/<slug>.md`: `status: in-pipeline`, `project:` with the absolute path, `return_type` (from step 3), a note "adopted external project on {{DATE}}". Copy it to `docs/idea-origin.md`.
   - Add the row to `factory/portfolio.md` (project, path, repo, origin idea = "adopted", inferred phase, date).

8. **Commit** in the project: `chore: adopt into pandacorp factory` (overlay + docs only — do NOT touch the app's source). If `gh` is authenticated and there is no remote, OFFER to create a private repo (DR-010); don't force it.

9. **Report & next step (in Spanish).** Summarize: inferred phase, what was created vs merged, the reconstructed docs and their gaps, and the natural next skill for the phase (`operation` → `/pandacorp:iterate` or `/pandacorp:review-launch`; `implementation` → `/pandacorp:implement` to continue). Remind that from now changes flow through the skills (write-gate, DR-044).

## Rules
- **Never overwrite the project's existing files** — create or merge, never clobber. When in doubt, ask.
- **Don't rewrite existing code to English.** The language rule (DR-009) applies going forward; adopt documents the project, it does not refactor the existing codebase.
- The as-built docs describe **existing** behavior and are always marked as reconstructed — never presented as an authored plan.
- Human gate before writing (step 3); the conversation with the owner is in Spanish, the committed docs in English.
- Don't change the production state or deploy anything — adoption is documentation + wiring, not a release.
