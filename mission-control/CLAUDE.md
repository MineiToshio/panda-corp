# Mission Control

A **Pandacorp** factory project. The whole lifecycle is managed with the `/pandacorp:*` skills.

Conventions (durable, tool-agnostic): @AGENTS.md
Pandacorp project guide (origin · how changes are made · documentation map): @.pandacorp/guide.md

<!-- ──────────────────────────────────────────────────────────────────
     Your own project notes go below this line.
     Pandacorp manages the two imports above and the `.pandacorp/` folder;
     `/pandacorp:upgrade` never edits below this line.
     ────────────────────────────────────────────────────────────────── -->

## Mission Control specifics — it lives INSIDE the factory repo

Unlike a normal Pandacorp project (a sibling folder with its own repo), Mission Control is the factory's own dashboard and lives **inside** the factory repo at `panda-corp/mission-control/`. That changes a few things the build must respect:

- **No own git repo.** It shares the factory's `.git`. Never run `git init` here. Build commits land in the factory repo with the `mission-control` scope, e.g. `feat(mission-control): …`.
- **Factory data is one level up.** `lib/config.ts` resolves the factory root as `process.cwd()/..` (override with the `PANDACORP_FACTORY_ROOT` env var). It reads `factory/ideas/`, `factory/portfolio.md` and each project's `.pandacorp/status.yaml`.
- **Internal tool, not a product** (`return_type`: personal). The economic arc does NOT apply: no demand-gate, unit-economics, landing, GTM or market telemetry. `/pandacorp:release` here just means running it locally on `127.0.0.1` — no deploy, no production gate.
- **Read-only over the factory.** The app only reads files and never calls Claude; the single allowed write is a card's `status:` on discard (FRD-02).
- **Events.** The Party panel reads `~/.claude/dashboard-events.ndjson`; until the emitter is namespaced by project, treat events without a `project` field as legacy/global.
