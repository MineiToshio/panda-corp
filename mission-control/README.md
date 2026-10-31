# Mission Control

The Órbita command center for the **Pandacorp** factory: ideas, projects, proposals, documentation and achievements, with persistent navigation and a live project build view.

## What it does

Mission Control turns running the Pandacorp factory from the terminal into a single command center. It shows, at a glance, what needs the owner's attention, what changed since their last visit, and the next `/pandacorp:*` command to run — plus La Fragua for live project construction, a documentation browser, and honest progress (XP, levels, achievements tied to real work, never to opening the app).

It is **read-only**: it never calls Claude and never executes commands — the owner runs the suggested command themselves in Claude Code. The only writes are a small, bounded, human-triggered set (discard/restore an idea card's status, toggle its favorite flag). It's an internal tool for a single, Spanish-speaking operator — there is no auth, no multi-user support, and no deploy: it runs on `127.0.0.1`.

See the full product spec in [`docs/product/prd.md`](docs/product/prd.md).

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 (`@theme`, Órbita design tokens) |
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

# register stable navigation identities (preview, then apply; from mission-control/)
bash ../plugin/scripts/navigation-identities.sh --dry-run
bash ../plugin/scripts/navigation-identities.sh --apply

# run
pnpm dev                     # served at http://127.0.0.1:3000

# isolated, deterministic prototype data
pnpm dev:oracle --port 3999

# static checks
pnpm exec knip
pnpm exec tsc --noEmit
pnpm exec biome check .
pnpm lint:cycles

# test
pnpm test                    # unit/component (Vitest)
pnpm test:smoke               # e2e smoke (Playwright)
pnpm verify                   # the full gate: lint + typecheck + tests + e2e
```

Environment overrides are documented individually in [`.env.example`](.env.example):
`PANDACORP_FACTORY_ROOT`, `PANDACORP_EVENTS_FILE`, `PANDACORP_CODEX_EVENTS_FILE`,
`PANDACORP_ACCOUNTS_FILE`, `PANDACORP_CODEX_PLUGIN_ROOT`, `MC_CLOCK` and `MC_GIT_FIXTURE`.
Set them before starting the server; configuration paths are resolved at import time.

For an isolated prototype factory, run `pnpm dev:oracle --port <free-port>`.
It uses fixture home, events, accounts and git answers with a frozen clock, disables Next telemetry,
and refuses to start without fixtures. Generate missing fixtures explicitly with
`node docs/design/prototype/scripts/make-fixtures.mjs`. A supplied `MC_CLOCK` overrides the default
`2026-10-21T00:20:00.000Z`; do not set oracle overrides in production.

There is **no deploy**: `/pandacorp:release` for this project just means running it locally (`return_type: personal`, `deploy_target: internal`) — see [`docs/product/architecture.md`](docs/product/architecture.md) §10.

## Project structure

Product docs and the decision history live in [`docs/`](docs/product/prd.md); engineering rules any agent must follow before touching code live in [`docs/rules/`](docs/rules/README.md). Structure conventions: `factory/standards/structure.md` (in the parent factory repo).

## Status & docs

- Product spec: [`docs/product/prd.md`](docs/product/prd.md)
- Architecture: [`docs/product/architecture.md`](docs/product/architecture.md)
- Decision history: [`docs/decision-log.md`](docs/decision-log.md)
- This is a **Pandacorp** factory project — see [`.pandacorp/guide.md`](.pandacorp/guide.md) for how it's built and iterated.

## Persistent links

All main views and meaningful nested selections have copyable URLs that restore on reload and browser history navigation. Existing query links remain compatible. Resource slugs are registered once in the owner-private factory identity catalog and survive display-name changes; lifecycle skills register future resources without a dashboard rebuild. See [FRD-25](docs/frds/frd-25-persistent-navigation/frd.md) and `factory/standards/navigation-identities.md` for alias/backup/reconciliation rules. Navigation never executes a build command.
