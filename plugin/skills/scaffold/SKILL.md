---
name: scaffold
user-invocable: false
description: Creates the folder/repo of a Pandacorp project from an idea (mechanical step of the handoff). In the normal flow it is invoked by /pandacorp:spec; use it separately only to create the project without documenting yet.
---

# /pandacorp:scaffold

Creates the project for the idea indicated in `$ARGUMENTS` (card name or slug).

> **Contract note:** this is the **canonical project-birth recipe**. `spec` Step 0.2 MUST execute all of Steps 2–8 below, never a subset — a partial scaffold (e.g. skipping 4b's rules injection or 4c's port reservation) is a defect, not a valid shortcut.

## Steps

1. **Validate**: read the card in `factory/ideas/<idea>.md` (at the factory root). It must exist and be in `status: recommended` (or `discovered`). Running this skill IS the owner's selection. If the card is in `discarded` or `in-pipeline`, stop and confirm.
2. **Create the folder** `<slug-in-english>/` as a **sibling of the factory root** (NEVER inside). By default the parent directory of the factory; if `factory/profile.md` defines `projects_path`, use it. Initialize git with branch `main`.
3. **Copy the Pandacorp overlay** from the plugin's templates:
   ```bash
   cp -r "${CLAUDE_PLUGIN_ROOT}/templates/shared/." "<destination>/"
   ```
   - **Process the `.tpl` files**: replace `{{PROJECT_NAME}}` (slug), `{{IDEA_FILE}}` (card path), `{{FACTORY_PATH}}` (absolute path of the factory root), `{{DATE}}` (today), `{{OVERLAY_VERSION}}` (read from `${CLAUDE_PLUGIN_ROOT}/templates/OVERLAY_VERSION`), `{{CREATED_VIA}}` = `scaffold` (immutable provenance — DR-077 amendment/BL-0009: this greenfield birth is what later lets `doc-lint.sh` apply its fail-closed subset once the doc spine is complete) and rename removing `.tpl`.
   - The overlay already includes `.claude/engines/pandacorp-build.js` (the build engine that `implement` launches — kept in `.claude/engines/`, NOT `.claude/workflows/`, so it stays out of the owner's `/` menu), `.claude/settings.json`, and the `.pandacorp/` integration layer (`guide.md`, `status.yaml`, `README.md`, `comms/`).
   - This also seeds the **root `README.md`** (from `README.md.tpl`, project name only, carrying a `PANDACORP-README-PLACEHOLDER` marker — DR-112/DOC-3): it's a real placeholder, not a stub to forget — `spec` populates "what it does" once the PRD exists, `architecture` fills "getting started" once the stack is installed, and `doc-lint.sh` flags it if the marker survives past that point.
   - `CLAUDE.md` is thin: it imports `@AGENTS.md` and `@.pandacorp/guide.md`.
4. **Project structure**: create the feature-centric `docs/` skeleton (DR-049, `structure.md`) — the contract folders `product/`, `design/`, `frds/`, `adr/`, `analytics/`, and `docs/decision-log.md` — plus `.pandacorp/inbox/changes/` (the unified change queue, DR-069) and `.pandacorp/run/` (the gitignored owner↔skills + runtime layer). **Progressive disclosure: create folders on demand, never pre-stub** — do NOT create empty FRD module folders (`frds/frd-NN-<slug>/`); `spec` adds them as features are documented. Copy the idea's card to `.pandacorp/idea-origin.md` (a frozen reference copy). The overlay already seeds `.pandacorp/{status.yaml,guide.md,README.md}`, `.pandacorp/comms/iteration.md` (iterate in place, DR-032) and `docs/decision-log.md` (decision history — two-layer standard, `documentation.md`).
4b. **Inject the always-on engineering rules.** Copy every file in `${CLAUDE_PLUGIN_ROOT}/templates/rules/` whose frontmatter `applies_when:` is `always` into the project's **`docs/rules/`**, then generate `docs/rules/README.md` (see *Generating `docs/rules/README.md`* below). The **tech-gated** rule files (React/Next/Tailwind/Prisma/next-intl/PostHog/Sentry/web-*) are NOT copied here — `/pandacorp:architecture` adds the ones that match the approved stack. `CLAUDE.md` already imports `@docs/rules/README.md` and `AGENTS.md` points there, so the rules are loaded by any agent from birth.

4c. **Reserve the dev-port block (so parallel projects never collide).** Read the factory ledger `factory/ports.yaml` (create it if missing, seeded `base: 4000`, `block_width: 10`, `next_block: 4000`, empty `assignments:`). Take `next_block` as this project's base, append `<slug>: <base>` under `assignments:`, advance `next_block` by `block_width`, and write `dev_port_base: <base>` into the project's `.pandacorp/status.yaml`. The ledger is the **single source of truth** and is **gitignored** (personal) — a project keeps its block forever (re-runs reuse it; a new project always gets a fresh, disjoint block). Do NOT write `.claude/launch.json`/`.env` here — they are materialized by `/pandacorp:architecture` once the stack and dev command exist. Port convention: `factory/standards/infra.md` (DR-022).

5. **DON'T install the stack yet** — that is decided by the blueprint in the architecture phase. The project is born with only docs + overlay + the always-on rules. (Each stack's guide is in `${CLAUDE_PLUGIN_ROOT}/templates/stack-*/STACK.md` for when the time comes.)
6. **Bidirectional links**:
   - Idea's card: `status: in-pipeline`, `project:` field with the path.
   - `factory/portfolio.md`: add the row (project, path, repo pending, source idea, `product` phase, date).
   - The project's `CLAUDE.md` imports `.pandacorp/guide.md` (which carries the "Origin — Pandacorp" section) — both come from the template.
7. **GitHub repo** (DR-010: private auto-approved): if `gh` is authenticated, create the private repo and do the initial push; if not, leave it noted as pending in `.pandacorp/status.yaml`.
8. **Initial commit** in the project: `chore: scaffold project from pandacorp factory`.
9. Report: created path, what was configured and the next step — open a session in the project and run `/pandacorp:spec`.

## Generating `docs/rules/README.md` (canonical — also used by `architecture`, `upgrade`, `adopt`)

After copying rule files into `docs/rules/`, (re)generate `docs/rules/README.md` so it is the loadable index of exactly the files present. It must:
1. Open with a one-line directive: **"Engineering rules for this project — read and follow every file listed here before writing or changing code."**
2. **Import each copied rule file** with a Markdown-link import on its own line so Claude Code loads them recursively, e.g. `@code-conventions.md`, `@react.md`, … (one per file actually present — never list a file that wasn't copied).
3. Add a short table: file · what it covers · why it's here (`always` or the stack technology that pulled it in).
4. Note: "Managed by Pandacorp — regenerated by `/pandacorp:upgrade`; add project-specific rules as new files here and they'll be picked up."

Copy rule files **verbatim** (frontmatter included) — never re-condense them. A file ships **iff** its `applies_when` (or `also_applies_when`) is `always` or matches a technology the project actually uses (read the stack from `docs/product/architecture.md`; at scaffold time only `always` applies since the stack isn't chosen yet).

## Rules
- Project slug in English, kebab-case.
- Never create the project inside panda-corp.
- If the destination folder already exists, stop and ask — never overwrite.
