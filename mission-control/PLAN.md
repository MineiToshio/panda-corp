# Implementation plan — Pandacorp (local, read-only dashboard)

> Self-contained plan to execute with `/loop`. The dashboard is the Pandacorp factory's first project: a LOCAL tool for the owner to **see** the state of ideas and projects, **read** the documents, and **know which command to run next** — copying it with a button and pasting it into the Claude Code app.
>
> **Guiding principle:** the dashboard NEVER calls Claude. It only reads files from the repo and generates command text to copy. All execution is done by the owner pasting the command into the Claude Code app → uses their Claude Max subscription. The owner is weak at UX → the UI must be minimal and clean.

> **Product documentation (source of truth):** `docs/prd.md` + `docs/frds/` (FRD-01 through FRD-13: reading, board, portfolio, workspace, work orders, Party RPG, configuration, documentation, gamification, achievements hall, build modes, **observability/data-viz**, **visual system and accessibility**) + `docs/achievements.md`. The navigable prototype (`prototype/index.html`) is the approved design. This PLAN is the **build sequence**; for any scope question, the FRDs rule. **UX reinforcements (2026 research, `../docs/proposals/06-improvement-plan-2026.md`):** persistent per-agent color reused across sprites+feed+kanban, failure as a first-class state, `tabular-nums`, rationed accent, few-token OKLCH theme, motion <300ms with `prefers-reduced-motion`, feed follow-tail+pin+cap, Live Pulse, RPG↔timeline toggle, KPIs ≤5 (FRD-12/FRD-13). Pending: formal blueprint (stack/architecture) derived from the FRDs.

## Goal (what "done" means)

A local web app at `http://127.0.0.1:3000` with three panels over real factory data, and `.pandacorp/verify.sh` green. Global acceptance criteria:

- [ ] `bash .pandacorp/verify.sh` passes (biome + tsc --noEmit + vitest run), with no new errors or warnings.
- [ ] **Ideas** panel: kanban of the cards from `factory/ideas/*.md` grouped by `status`; each card shows title, score and type. **The board is read-only: cards are NOT moved by hand** — their column reflects the `status:` that the skills write when they run (new-idea→documented, recommend→recommended, scaffold→in-pipeline, release→shipped). Pandacorp replaces Obsidian as the viewer.
- [ ] **Full-page detail view** (click on a card): header (title, type, score, status), **summary with key points**, **navigator of the project's documents** (idea-origin.md, research, PRD, blueprint…) rendered, and the next-step command with a Copy button.
- [ ] **Discard button** in the detail: Pandacorp's only manual write — rewrites `status: discarded` in the .md (it is a human decision, not a build step). Test that it does not corrupt the YAML or the body.
- [ ] **Portfolio** panel: table of projects read from `factory/portfolio.md` + each project's `.pandacorp/status.yaml` (phase, version, summary, date).
- [ ] **Next step + copy**: each idea and each project shows the suggested command based on its `status`/`phase`, with a "Copy" button and an indication of which folder to open the Claude Code session in.
- [ ] The app makes **no calls to Claude** (no `claude -p`, no Agent SDK, no API key). It only reads/writes local files.
- [ ] It refreshes itself (re-reads the files every few seconds) to reflect changes after running a command.
- [ ] README with how to run it. The app listens ONLY on `127.0.0.1`. No auth, no deploy.

## Stack (golden path A, trimmed)

- Next.js 16 (App Router, Server Components read the filesystem) + TypeScript `strict` + `noUncheckedIndexedAccess`
- Tailwind CSS + minimal custom components (no elaborate design system)
- Biome (lint+format), Vitest (tests)
- Libs: `gray-matter` (idea frontmatter), `yaml` (status.yaml), `react-markdown` (rendering cards)
- No database (the factory repo IS the database), no auth, **no Claude SDK or subprocesses**

## Path configuration (constants in `lib/config.ts`)

```
FACTORY_ROOT = root of the factory repo (the repo that contains mission-control/);
               resolve with `git rev-parse --show-toplevel` or `path.resolve(process.cwd(), "..")`,
               optional override via the env var PANDACORP_FACTORY_ROOT
IDEAS_DIR    = FACTORY_ROOT + "/factory/ideas"      (ignore _idea-template.md)
PORTFOLIO    = FACTORY_ROOT + "/factory/portfolio.md"
PROJECTS     = portfolio rows → each path → .pandacorp/status.yaml
```

## "Next command" logic (in `lib/next-step.ts`, with tests)

Maps status/phase → suggested command + folder to open Claude Code in:

| Stage | Command to copy | Open Claude Code in |
|---|---|---|
| `discovered` | `/pandacorp:spec <slug>` (handoff: creates the project + documents the MVP) | the factory (panda-corp) |
| `documented` | `/pandacorp:design` | the project folder |
| `design` | `/pandacorp:blueprint` (creates blueprint + work orders) | the project folder |
| `architecture` | `/pandacorp:implement` (starts the build, dynamic workflow + Party) | the project folder |
| `building` | `/pandacorp:release` | the project folder |
| `shipped` | `/pandacorp:iterate` (add a feature/change) | the project folder |

Additional stages: `discarded` (human decision from Pandacorp) and, for changes at any time, the **Iterate** button (`/pandacorp:iterate`). `recommend` is an on-demand advice action, not a stage.

The UI shows, next to the command, the folder path (with its own copy button) so the owner knows exactly where to paste it.

## Phases and tasks (the loop advances the first pending one each iteration)

### Phase 0 — Scaffold
- [ ] `pnpm create next-app@latest .` (App Router, TS, Tailwind; ESLint NO — we'll use Biome).
- [ ] Install Biome, Vitest, gray-matter, yaml, react-markdown. tsconfig strict + noUncheckedIndexedAccess; `biome.json`.
- [ ] Create `.pandacorp/verify.sh` (chmod +x):
  ```bash
  #!/bin/bash
  set -e
  pnpm biome check .
  pnpm tsc --noEmit
  pnpm vitest run --reporter=dot
  ```
- [ ] Minimal `CLAUDE.md` that includes the word "Pandacorp" (activates the factory hooks) and describes the project. `git init -b main`, initial commit.

### Phase 1 — Reading layer (tests first)
- [ ] `lib/ideas.ts`: reads and parses the cards (title, status, score, type, slug, body). Test with fixtures.
- [ ] `lib/portfolio.ts`: parses the portfolio table and reads each project's `status.yaml`; tolerates broken paths (flags the project, doesn't break). Test.
- [ ] `lib/next-step.ts`: the table above as a pure function. Test for each case.

### Phase 2 — Ideas panel (read-only board) + full-page detail
- [ ] Kanban by `status` (columns in pipeline order + a `discarded` column at the end, dimmed). Card = title + type chip + score. NO arrows or drag: read-only.
- [ ] Click on a card → **full-page view** (not a drawer): header + summary with key points + document navigator (Summary | idea-origin.md | research | PRD | …) that renders the chosen .md + a "Next step" block (command + folder with Copy button) + a "Discard idea" button + "Back to board".
- [ ] Short legend: what the types mean (monetizable/personal/both) and the score.
- [ ] Empty / loading / error states.
- Note: the reference navigable prototype is in `prototype/index.html`.

### Phase 3 — Portfolio panel
- [ ] Table: project, phase, version, summary, last updated; row flagged if the path doesn't exist.
- [ ] Per row, a "Next step" block (command + folder, with Copy buttons).

### Phase 4 — Copy component + auto-refresh
- [ ] Reusable `CopyButton` component (uses the clipboard API; "Copied!" feedback).
- [ ] Auto-refresh: the page re-reads the data every ~5 s (or a "Refresh" button) to reflect changes after running commands.

### Phase 5 — Polish and close
- [ ] README: requirements, `pnpm dev`, that it listens on 127.0.0.1, and the usage flow (see → copy command → paste into the Claude Code app).
- [ ] Final pass: `.pandacorp/verify.sh` green; start `pnpm dev` and verify the three panels with real data.

### Phase 6 — Party (live agent view, read-only)
> Part of the initial scope (built after phases 0-5, in the same loop run). Visualizes the workflow subagents while they work, without calling Claude.
- [ ] The event emitter ALREADY comes in the factory plugin (`scripts/emit-event.sh`, emitted by the workflow subagents, + the `SubagentStop` hook → `~/.claude/dashboard-events.ndjson`). Pandacorp only CONSUMES that file, it does not create it.
- [ ] `lib/agents.ts`: reads `~/.claude/dashboard-events.ndjson` (events) and `~/.claude/tasks/<team>/` (task state); tolerates the absence of both (the "no active team" case). Test.
- [ ] **Party** panel: list of active agents with their state and current task, feed of messages/events between them, and a simple task-dependency graph. Auto-refresh (tail) every ~2 s.
- [ ] Observation only: it does NOT try to send messages or pause agents (that is done in the terminal). Leave a note in the UI: "to redirect an agent, use the Claude Code app".

### Stretch (only if the above is green)
- [ ] Search/filter ideas by text, type or score.

## Constraints (guardrails for the loop)

1. **The dashboard NEVER calls Claude**: no `claude -p`, Agent SDK, or API key. It only reads/writes local files. All execution is done by the owner pasting commands into the Claude Code app (their Max subscription).
2. **Local only**: listens on `127.0.0.1`. NEVER deploy or expose to the network.
3. **Don't touch factory data** except the `status:` frontmatter of the stretch. Read, not write (except that case).
4. **TDD** in `lib/` (reading and next-step).
5. **Conventional commits** in English; direct push to main is fine (solo operator).
6. **Minimal UI**: three panels, no animations or speculative features. Plain Tailwind.
7. **Finish when** all global acceptance criteria are checked. Don't keep adding features.

## Notes
- If a decision isn't covered here, apply the factory's decision registry (`../panda-corp/factory/decisions/registry.yaml`); if not there either, stop and ask the owner.
- The projects' `status.yaml` may not exist yet (for now there's only the factory + this panel): handle the empty case gracefully.
