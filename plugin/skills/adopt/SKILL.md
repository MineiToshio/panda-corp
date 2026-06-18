---
description: Adopts an EXISTING project that was NOT born from the Pandacorp handoff (a brownfield / external project) into the factory. Injects the overlay without clobbering, infers the real phase from the code, reconstructs minimal as-built docs, registers it in the portfolio with a retroactive idea card, and hands off to the normal skills. Runs INSIDE the existing project. The brownfield counterpart of /pandacorp:scaffold.
---

# /pandacorp:adopt

Brings a project built **outside** the factory under Pandacorp management. Run it **inside** the existing project folder. It is the brownfield mirror of `scaffold` (greenfield): instead of creating an empty project, it wraps what already exists, so that from then on the `/pandacorp:*` skills, Mission Control and the write-gate (DR-044) apply to it. Touching an existing project = **human gate**: present the adoption plan and get the owner's OK before writing anything (DR-045, DR-038).

## When to use
The owner has a project they built by hand (or cloned) and wants the factory to manage it. If the folder is ALREADY a Pandacorp project (`.pandacorp/status.yaml` present), stop — it's already adopted. If the folder is empty / has no real code, this isn't an adoption → use `/pandacorp:spec`.

## Steps

1. **Idempotence / sanity check.** If `.pandacorp/status.yaml` exists, say it's already a factory project and stop. Confirm there's a real codebase here.

2. **Read the project to understand it (NO writes yet).** Inspect the repo to learn what it IS and what PHASE it's in:
   - Stack & structure: `package.json` / `pyproject.toml` / etc., framework, entry points, `git log` (history, maturity), `git remote` (does a GitHub repo already exist?).
   - Maturity signals → **inferred phase**: live deploy / CI to prod / a production URL → `operation`; substantial code + tests but no deploy → `implementation`; only boilerplate/scaffolding → `architecture`. State the inference AND its evidence.
   - What the app DOES (features, routes, data model) — the raw material for the as-built docs.

3. **Present the adoption plan + its consequences (HUMAN GATE).** Adoption is a commitment, so spell it out and get an explicit OK before writing (in Spanish): (a) the files to be CREATED vs MERGED (never overwritten) and the retroactive idea card + portfolio row; (b) the inferred phase + evidence; (c) ask the `return_type` (personal / monetary / mixed / opportunity, DR-039); and (d) **what it means going forward** — the project becomes a Pandacorp project, so from now on changes flow through the `/pandacorp:*` skills (write-gate, DR-044), while staying fully workable without the plugin (anyone cloning just the repo follows `AGENTS.md` by hand). DR-038: also push-notify. On "no", stop and change nothing.

4. **Inject the overlay WITHOUT clobbering.** Copy the template overlay (`${CLAUDE_PLUGIN_ROOT}/templates/shared/`) but never overwrite existing files:
   - **New files** (don't exist): copy as-is, process the `.tpl` vars (`{{PROJECT_NAME}}`, `{{FACTORY_PATH}}`, `{{IDEA_FILE}}`, `{{DATE}}`, `{{OVERLAY_VERSION}}` from `${CLAUDE_PLUGIN_ROOT}/templates/OVERLAY_VERSION`), drop the `.tpl` suffix.
   - **`.pandacorp/guide.md`**: always write it (the managed Origin + write-gate + doc-map). It's regenerable — no merge needed.
   - **CLAUDE.md**: if the project HAS one, do NOT replace it — APPEND the import lines (`@AGENTS.md`, `@docs/rules/README.md`, `@.pandacorp/guide.md`) and leave its own content untouched; if it has none, use the thin template. **AGENTS.md**: if absent, add the factory-conventions one (with the `docs/rules/` pointer); if present, merge the write-gate bullet + the `docs/rules/` pointer without disturbing its rules.
   - **.gitignore present**: MERGE the integration-layer ignores (`.pandacorp/comms/`, `.pandacorp/inbox/`, `.pandacorp/run/`), without duplicating.
   - **.claude/settings.json present**: merge the `permissions.deny` entries.
   - Always bring `.claude/workflows/pandacorp-build.js` (the build engine `implement` launches). The marker that makes the factory recognize the project is `.pandacorp/status.yaml` (written in step 5).

5. **Create the structure + state** (feature-centric, DR-049). Create the `docs/` skeleton where missing: `product/`, `design/`, `frds/` (each existing feature → its own `frds/frd-NN-<slug>/` module folder, created in step 6), `adr/`, `reviews/`, and `.pandacorp/{inbox/bugs,run}`. Write `.pandacorp/status.yaml` with the inferred `phase`, the real `version` (from tags / `package.json`, default `v1`), `overlay_version` + `created_with` = the current `OVERLAY_VERSION`, `running: false`, counters at 0, `repo` from `git remote`. Seed `docs/decision-log.md` and `.pandacorp/comms/iteration.md` if absent. **Inject the engineering rules**: from `${CLAUDE_PLUGIN_ROOT}/templates/rules/` copy into `docs/rules/` every file that is `always` or matches the project's inferred stack (step 1), and generate `docs/rules/README.md` (canonical spec in the `scaffold` skill). For a brownfield project these are as-built guardrails going forward; flag — don't auto-fix — existing code that violates them.

6. **Reconstruct minimal AS-BUILT docs** (so downstream skills have an anchor; feature-centric, DR-049). This is reverse-documentation, clearly marked as reconstructed:
   - `product-manager` writes `docs/product/prd.md` describing what the app does TODAY (problem, users, current scope) + a living **feature-landscape** table of the reconstructed FRDs. For each existing feature, create its module folder `docs/frds/frd-NN-<slug>/` with a `frd.md` (REQ-NN-MMM + EARS AC-NN-MMM.K anchored to ACTUAL behavior; FRD names its parent PRD in frontmatter). Header each one: *"As-built — reconstructed by /pandacorp:adopt on {{DATE}}; describes existing behavior, not a forward plan."*
   - `architect` writes the platform `docs/product/architecture.md` capturing the REAL stack/data model/deploy + `docs/adr/adr-000-adopted-stack.md` (as-built). Where a feature has non-trivial implementation worth recording, add a thin `docs/frds/frd-NN-<slug>/blueprint.md` referencing `product/architecture.md`; don't pre-stub empty ones.
   - Keep it minimal and honest: stubs with TODOs are fine where behavior is unclear; do NOT invent product rationale. Don't reconstruct work orders for already-built features (they implement forward work). Flag the gaps for the owner.

7. **Register in the factory (bidirectional links).**
   - Create the retroactive idea card `factory/ideas/<slug>.md`: `status: in-pipeline`, `project:` with the absolute path, `return_type` (from step 3), a note "adopted external project on {{DATE}}". Copy it to `.pandacorp/idea-origin.md`.
   - Add the row to `factory/portfolio.md` (project, path, repo, origin idea = "adopted", inferred phase, date).

8. **Commit** in the project: `chore: adopt into pandacorp factory` (overlay + docs only — do NOT touch the app's source). If `gh` is authenticated and there is no remote, OFFER to create a private repo (DR-010); don't force it.

9. **Report & next step (in Spanish).** Summarize: inferred phase, what was created vs merged, the reconstructed docs and their gaps, and the natural next skill for the phase (`operation` → `/pandacorp:iterate` or `/pandacorp:review-launch`; `implementation` → `/pandacorp:implement` to continue). Remind that from now changes flow through the skills (write-gate, DR-044).

## Rules
- **Never overwrite the project's existing files** — create or merge, never clobber. When in doubt, ask.
- **Don't rewrite existing code to English.** The language rule (DR-009) applies going forward; adopt documents the project, it does not refactor the existing codebase.
- The as-built docs describe **existing** behavior and are always marked as reconstructed — never presented as an authored plan.
- Human gate before writing (step 3); the conversation with the owner is in Spanish, the committed docs in English.
- Don't change the production state or deploy anything — adoption is documentation + wiring, not a release.
