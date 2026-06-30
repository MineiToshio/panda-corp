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
- **Materialized at blueprint** (when the stack and the dev command exist): `/pandacorp:architecture` writes the app port (`base+0`) into `.claude/launch.json` (so the dev/preview server starts straight from Claude Code) and the app/DB/service ports into the worktree's `.env`. In Docker, map ports via `.env` and use a different Compose project name per worktree.
- Mission Control shows the port ("test at `localhost:XXXX`").

## Worktrees (testing a snapshot without stopping the agent)

- The agent builds in its worktree; the owner tests the **latest green commit** (`last_green_sha`) in a dedicated **review worktree** — which lives under the canonical review-worktrees root (DR-090, see below), **not** as a sibling inside `Proyectos/`:
  `git worktree add /Users/Shared/review-worktrees/<project> <last_green_sha>`.
- A worktree is born **without** `.env` or `node_modules`. The stack template includes a **`.worktreeinclude`** (`.gitignore` syntax) that copies `.env`/`.env.local` to each new worktree, plus a post-create step that installs deps. With **pnpm** (shared store) the install in a new worktree is almost instant.
- Keep **ONE** review folder and refresh it to the latest green (don't accumulate worktrees). Claude Code's automatic sweep does not delete manually created worktrees.

**Review-worktree root (DR-090).** Manually-created **review/test worktrees** (the "test a green build without stopping the agent" copies) live under **ONE canonical root, outside the source-projects area**: `/Users/Shared/review-worktrees/<project>/` — a sibling of `Proyectos/`, at the `Shared` level, the folder named exactly after the project (no `-review` suffix — the root already says it's for reviews). This mirrors the local-deployments root (DR-089): `Proyectos/` holds only source checkouts; derived worktrees live in their own roots (`local-deployments/` for the always-on prod deploy, `review-worktrees/` for ephemeral green-snapshot testing). They are **not** placed inside `.claude/` (tool-internal — risks the worktree being swept). Mission Control's snapshot panel (FRD-14) emits the `git worktree add /Users/Shared/review-worktrees/<project> <sha>` command for the owner to copy.

## Local deployments (always-on internal release) — DR-089

A project's **local deployment** (the built, served snapshot of an `internal` tool — `deploy_target: internal` / `return_type: personal`, e.g. Mission Control on `127.0.0.1`) lives under **ONE canonical root, outside the source-projects area**:

- **Location:** `/Users/Shared/local-deployments/<project>/` — a sibling of `Proyectos/`, at the `Shared` level. Each deployment is a subfolder **named exactly after the project/repo** — **never** a `-live`/`-deploy` suffix, **never** co-located inside `Proyectos/` next to source checkouts (mixing a deployment with source projects makes it look like a separate project and confuses tooling — e.g. a visual gate with `reuseExistingServer` can reuse the stale snapshot server).
- **It is a production build**, not dev: `next build` + `next start` (fast, stable), kept in an **isolated git worktree** so its `.next`/`node_modules` never collide with the dev checkout's builds/tests/`verify.sh`. Live gitignored factory data is read from the main checkout via `PANDACORP_FACTORY_ROOT`.
- **Always-on** via launchd (KeepAlive) on the project's reserved port (the same `factory/ports.yaml` allocation).
- **Redeploy** = sync the worktree to the green `HEAD` + rebuild + restart the service (don't edit the deployment in place). The dev checkout in `Proyectos/<project>` is where work happens; the deployment in `local-deployments/<project>` is the stable running copy — they are **never the same folder**.
- Reference implementation (Mission Control): `mission-control/.pandacorp/run/serve.sh` (launchd entry) + `deploy-local.sh` (sync+build+restart), service `com.pandacorp.mission-control`, served at `127.0.0.1:1987` from `/Users/Shared/local-deployments/panda-corp`.

## State published for Mission Control (`.pandacorp/status.yaml`)

The gate script (not the agent) writes at every green work-order close:
- `last_green_sha`: commit of the last work order closed green.
- `safe_to_test: true/false`: `true` only when `HEAD == last_green_sha` (no uncommitted work).
Plus: `pending_bugs` (the `.pandacorp/inbox/bugs/` tray), `pending_decisions` (.pandacorp/inbox/decisions.md), `rethink_pending` (iterate asked to pause).

## Human gates as hard rules

The constitution's gates (production, spending money, deleting data, external communications, access changes) are applied as **`deny` rules in `.claude/settings.json`** + the `block-dangerous.sh` hook, NOT as limits stated in the conversation (context compaction can lose them). Claude Code's "auto mode" is NOT a security shield — deny rules always win.
