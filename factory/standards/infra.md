# Infrastructure and local operation

Conventions for how a project runs in **development** (the factory injects them into every project). Detail of the unattended-build model in [docs/proposals/07-unattended-build.md](../../docs/proposals/07-unattended-build.md).

## Database and services in dev → Docker

- **Dev**: each project brings up its DB and services (Postgres, Redis if applicable) with **Docker Compose**, defined in the repo (`docker-compose.yml`). Reproducible, isolated, and the agent brings it up deterministically. Sole machine requirement: Docker Desktop installed.
- **Staging / production**: NO Docker — managed DB of the golden path (Neon / Supabase). Docker is for local only. (This applies to an **external** deploy — `deploy_target: external`, DR-085. An **internal** release runs the app as-is for the owner, e.g. on `127.0.0.1`, with no external host; see `build-orchestration.md` §5b.)
- Each **worktree** uses its own instance/DB (or a different Compose project name, `docker compose -p <worktree>`) so that the owner's test and the agent's don't step on each other.

## Port convention (several projects / worktrees at once)

So nothing **ever** collides when several projects/worktrees run in parallel, dev ports are **allocated from a central ledger**, never guessed or hashed (a hash of the slug collides by the birthday problem — with a few dozen projects the odds are real; a ledger gives a guarantee, not a probability). The ledger `factory/ports.yaml` (personal, **gitignored** — it tracks YOUR local projects, like the portfolio) is the single source of truth:

- **One block per project, 10 ports wide from base 4000** (project 1 → `4000–4009`, project 2 → `4010–4019`, …). `/pandacorp:scaffold` reserves the next free block (`next_block`), records `slug → base` in the ledger and writes `dev_port_base` into the project's `.pandacorp/status.yaml`. A project **keeps its block forever**, so re-runs always reuse the same ports and a new project always gets a fresh, disjoint block — **zero collisions, by construction**.
- **Offsets within the block** (so the agent's build and the owner's review worktree don't step on each other): `+0` app (agent worktree) · `+1` app (review worktree) · `+2`/`+3` Postgres (agent/review) · `+4`/`+5` Redis (agent/review) · `+6..+9` spare for extra services.
- **Materialized at blueprint** (when the stack and the dev command exist): `/pandacorp:blueprint` writes the app port (`base+0`) into `.claude/launch.json` (so the dev/preview server starts straight from Claude Code) and the app/DB/service ports into the worktree's `.env`. In Docker, map ports via `.env` and use a different Compose project name per worktree.
- Mission Control shows the port ("test at `localhost:XXXX`").

## Worktrees (testing a snapshot without stopping the agent)

- The agent builds in its worktree; the owner tests the **latest green commit** (`last_green_sha`) in another folder:
  `git worktree add ../<project>-review <last_green_sha>`.
- A worktree is born **without** `.env` or `node_modules`. The stack template includes a **`.worktreeinclude`** (`.gitignore` syntax) that copies `.env`/`.env.local` to each new worktree, plus a post-create step that installs deps. With **pnpm** (shared store) the install in a new worktree is almost instant.
- Keep **ONE** review folder and refresh it to the latest green (don't accumulate worktrees). Claude Code's automatic sweep does not delete manually created worktrees.

## State published for Mission Control (`.pandacorp/status.yaml`)

The gate script (not the agent) writes at every green work-order close:
- `last_green_sha`: commit of the last work order closed green.
- `safe_to_test: true/false`: `true` only when `HEAD == last_green_sha` (no uncommitted work).
Plus: `pending_bugs` (the `.pandacorp/inbox/bugs/` tray), `pending_decisions` (.pandacorp/inbox/decisions.md), `rethink_pending` (iterate asked to pause).

## Human gates as hard rules

The constitution's gates (production, spending money, deleting data, external communications, access changes) are applied as **`deny` rules in `.claude/settings.json`** + the `block-dangerous.sh` hook, NOT as limits stated in the conversation (context compaction can lose them). Claude Code's "auto mode" is NOT a security shield — deny rules always win.
