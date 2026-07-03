# Mission Control

A single-screen, read-only dashboard for operating the **Pandacorp** factory — the state of every idea and project, their documentation, the next command to run, and a live "Party" view of the agents building — wrapped in an honest gamification layer.

## What it does

Mission Control turns running the Pandacorp factory from the terminal into a single command center. It shows, at a glance, what needs the owner's attention, what changed since their last visit, and the next `/pandacorp:*` command to run — plus a live RPG-style view of agents building a project, a documentation browser (the "Manual"), and honest progress (XP, levels, achievements tied to real work, never to opening the app).

It is **read-only**: it never calls Claude and never executes commands — the owner runs the suggested command themselves in Claude Code. The only writes are a small, bounded, human-triggered set (discard/restore an idea card's status, toggle its favorite flag). It's an internal tool for a single, Spanish-speaking operator — there is no auth, no multi-user support, and no deploy: it runs on `127.0.0.1`.

See the full product spec in [`docs/product/prd.md`](docs/product/prd.md).

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 (`@theme`, OKLCH tokens) |
| Lint/format | Biome |
| Tests | Vitest + Testing Library (unit/component), Playwright (e2e: smoke, visual, responsive, shell) |
| Data | None — reads the factory's filesystem directly (idea cards, `portfolio.md`, each project's `.pandacorp/status.yaml`) via `gray-matter` + `yaml`. No database. |

Full rationale and discarded alternatives: [`docs/adr/ADR-0001-stack.md`](docs/adr/ADR-0001-stack.md). Complete architecture: [`docs/product/architecture.md`](docs/product/architecture.md).

## Getting started

Prerequisites: Node ≥20.9, `pnpm`. Mission Control lives **inside** the Pandacorp factory repo (`panda-corp/mission-control/`) and reads the factory root one level up — no separate factory checkout needed if you're already in `panda-corp/`.

```bash
# install
pnpm install

# configure (optional — defaults work when run from mission-control/)
cp .env.example .env.local   # only needed to point at a different factory root or events file

# run
pnpm dev                     # served at http://127.0.0.1:3000

# test
pnpm test                    # unit/component (Vitest)
pnpm test:smoke               # e2e smoke (Playwright)
pnpm verify                   # the full gate: lint + typecheck + tests + e2e
```

There is **no deploy**: `/pandacorp:release` for this project just means running it locally (`return_type: personal`, `deploy_target: internal`) — see [`docs/product/architecture.md`](docs/product/architecture.md) §10.

## Project structure

Product docs and the decision history live in [`docs/`](docs/product/prd.md); engineering rules any agent must follow before touching code live in [`docs/rules/`](docs/rules/README.md). Structure conventions: `factory/standards/structure.md` (in the parent factory repo).

## Status & docs

- Product spec: [`docs/product/prd.md`](docs/product/prd.md)
- Architecture: [`docs/product/architecture.md`](docs/product/architecture.md)
- Decision history: [`docs/decision-log.md`](docs/decision-log.md)
- This is a **Pandacorp** factory project — see [`.pandacorp/guide.md`](.pandacorp/guide.md) for how it's built and iterated.
