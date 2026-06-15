---
description: Creates the folder/repo of a Pandacorp project from an idea (mechanical step of the handoff). In the normal flow it is invoked by /pandacorp:spec; use it separately only to create the project without documenting yet.
---

# /pandacorp:scaffold

Creates the project for the idea indicated in `$ARGUMENTS` (card name or slug).

## Steps

1. **Validate**: read the card in `factory/ideas/<idea>.md` (at the factory root). It must exist and be in `status: recommended` (or `documented`). Running this skill IS the owner's selection. If the card is in `discarded` or `in-pipeline`, stop and confirm.
2. **Create the folder** `<slug-in-english>/` as a **sibling of the factory root** (NEVER inside). By default the parent directory of the factory; if `factory/profile.md` defines `ruta_proyectos`, use it. Initialize git with branch `main`.
3. **Copy the Pandacorp overlay** from the plugin's templates:
   ```bash
   cp -r "${CLAUDE_PLUGIN_ROOT}/templates/shared/." "<destination>/"
   ```
   Process the `.tpl` files: replace `{{PROJECT_NAME}}` (slug), `{{IDEA_FILE}}` (card path), `{{FACTORY_PATH}}` (absolute path of the factory root), `{{DATE}}` (today) and rename removing `.tpl`. The overlay already includes `.claude/workflows/pandacorp-build.js` (the build engine that `implement` launches) and `.claude/settings.json`.
4. **Docs structure**: create `docs/` with empty subfolders `frds/`, `design/mockups/`, `adr/`, `work-orders/`, `reviews/`. Copy the idea's card to `docs/idea-origin.md` (a frozen reference copy). The overlay already seeds `docs/status.yaml`, `docs/iteration.md` (iterate in place, DR-032) and `docs/decision-log.md` (decision history — two-layer standard, `documentation.md`).
5. **DON'T install the stack yet** — that is decided by the blueprint in the architecture phase. The project is born with only docs + overlay. (Each stack's guide is in `${CLAUDE_PLUGIN_ROOT}/templates/stack-*/STACK.md` for when the time comes.)
6. **Bidirectional links**:
   - Idea's card: `status: in-pipeline`, `project:` field with the path.
   - `factory/portfolio.md`: add the row (project, path, repo pending, source idea, `product` phase, date).
   - The project's CLAUDE.md already comes with the "Origin — Pandacorp" section (it comes from the template).
7. **GitHub repo** (DR-010: private auto-approved): if `gh` is authenticated, create the private repo and do the initial push; if not, leave it noted as pending in `docs/status.yaml`.
8. **Initial commit** in the project: `chore: scaffold project from pandacorp factory`.
9. Report: created path, what was configured and the next step — open a session in the project and run `/pandacorp:spec`.

## Rules
- Project slug in English, kebab-case.
- Never create the project inside panda-corp.
- If the destination folder already exists, stop and ask — never overwrite.
