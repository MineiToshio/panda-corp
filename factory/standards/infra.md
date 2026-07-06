# Infrastructure and local operation

> Domain: Operation · Severity: **MUST** (Docker dev, port ledger, human-gate deny rules, tested restore) / **SHOULD** (worktree hygiene) · Enforcement: checklist + human gate (deny rules in `.claude/settings.json`) + skill automation (scaffold/architecture write the ledger). Playbook-style standard.

Conventions for how a project runs in **development** (the factory injects them into every project). Detail of the unattended-build model in [docs/proposals/07-unattended-build.md](../../docs/proposals/07-unattended-build.md).

## Database and services in dev → Docker

- **Dev**: each project brings up its DB and services (Postgres, Redis if applicable) with **Docker Compose**, defined in the repo (`docker-compose.yml`). Reproducible, isolated, and the agent brings it up deterministically. Sole machine requirement: Docker Desktop installed.
- **Staging / production**: NO Docker — managed DB of the golden path (Neon — Supabase was evaluated and rejected, see `external-services.md`). Docker is for local only. (This applies to an **external** deploy — `deploy_target: external`, DR-085. An **internal** release runs the app as-is for the owner, e.g. on `127.0.0.1`, with no external host; see `build-orchestration.md` §5b.)
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

**pandacorp-vault — the out-of-project state root.** The factory's **personal, machine-local state that must not live inside the `panda-corp/` repo** (which was previously scattered as `~/.pandacorp-personal.git`, `~/.pandacorp-backups`) is consolidated into **`/Users/Shared/Proyectos/pandacorp-vault/`** — a sibling of `panda-corp/` inside `Proyectos/` (a `README.md` at its root describes it). It holds `personal.git/` (the **overlay** bare repo — see below) and `backups/` (the daily state backups; `backup-pandacorp-state.sh` auto-detects this vault as a sibling of the repo and writes there, falling back to `~/.pandacorp-backups`). **Why *inside* `Proyectos/` when deployments/worktrees stay out:** the rule that keeps things out of `Proyectos/` exists to stop tooling from mistaking a **runnable server** (a deployment) for a source checkout — it applies to things that *run*, not to *static* state. The vault runs nothing, so it sits next to the code for discoverability (the owner browsing `Proyectos/` sees `pandacorp-vault` beside `panda-corp` and relates them). **What does NOT go in the vault: secrets/keys** (the SOPS **age key**) — those stay in **`~/.config/pandacorp/`** (the user's private home, per XDG and the tools' default), because `/Users/Shared/` is a **multi-user-readable** location on macOS — wrong for a private key. **The overlay (`personal.git`)** is a bare repo whose *work-tree* is `panda-corp/`: it versions ONLY the gitignored personal files (`factory/profile.md`, `portfolio.md`, `ports.yaml`, `gamification-ledger.json`, `memory/_inbox.md`, `ideas/*.md`) that the main repo ignores — each file has exactly one physical copy and one tracking repo (disjoint sets → no duplication, no second source of truth). It needs a **private remote** to survive machine loss (the vault is local); the backups likewise need an **offsite** copy for disaster recovery.

## Local deployments (always-on internal release) — DR-089

A project's **local deployment** (the built, served snapshot of an `internal` tool — `deploy_target: internal` / `return_type: personal`, e.g. Mission Control on `127.0.0.1`) lives under **ONE canonical root, outside the source-projects area**:

- **Location:** `/Users/Shared/local-deployments/<project>/` — a sibling of `Proyectos/`, at the `Shared` level. Each deployment is a subfolder **named exactly after the project/repo** — **never** a `-live`/`-deploy` suffix, **never** co-located inside `Proyectos/` next to source checkouts (mixing a deployment with source projects makes it look like a separate project and confuses tooling — e.g. a visual gate with `reuseExistingServer` can reuse the stale snapshot server).
- **It is a production build**, not dev: `next build` + `next start` (fast, stable), kept in an **isolated git worktree** so its `.next`/`node_modules` never collide with the dev checkout's builds/tests/`verify.sh`. Live gitignored factory data is read from the main checkout via `PANDACORP_FACTORY_ROOT`.
- **Always-on** via launchd (KeepAlive) on the project's **dedicated deploy port = `base+9`** (the last port of the block in `factory/ports.yaml`). It is **NOT** `base+0`: `+0` is the dev/preview app port, so serving the always-on deploy there collides with the dev server (the drift that lost Mission Control's deploy). Reserving the top of each block keeps the served snapshot on its own door forever. A project may override its deploy port explicitly in `ports.yaml` (Mission Control does — see below).
- **launchd PATH gotcha.** A launchd user-agent starts with a bare `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin`) — it has **neither** Homebrew's `pnpm` **nor** fnm's node (whose per-shell multishell path is ephemeral). `serve.sh` MUST export a real `PATH` up front (`/opt/homebrew/bin` + fnm's stable `~/.local/share/fnm/aliases/default/bin`) or the service dies on loop with `exit 127` "pnpm: not found".
- **Redeploy** = sync the worktree to the green `HEAD` + rebuild + restart the service (don't edit the deployment in place). The dev checkout in `Proyectos/<project>` is where work happens; the deployment in `local-deployments/<project>` is the stable running copy — they are **never the same folder**.
- **The machinery (`.pandacorp/run/serve.sh` + `deploy-local.sh`) is gitignored, regenerable runtime — but there is no backup.** It was lost once (the whole `.pandacorp/run/` got swept — the BL-0035 protected-path class), which is what took the deploy down. Reconstruct it from this reference, never delete the dir.
- Reference implementation (Mission Control): `mission-control/.pandacorp/run/serve.sh` (launchd entry) + `deploy-local.sh` (sync+build+restart), service `com.pandacorp.mission-control`, served at `127.0.0.1:1987` from `/Users/Shared/local-deployments/panda-corp` — **1987 is an explicit owner override** (the factory's flagship project's special port), recorded in `factory/ports.yaml`, not the `base+9` (4009) the rule would otherwise assign.

## State published for Mission Control (`.pandacorp/status.yaml`)

The gate script (not the agent) writes at every green work-order close:
- `last_green_sha`: commit of the last work order closed green.
- `safe_to_test: true/false`: `true` only when `HEAD == last_green_sha` (no uncommitted work).
Plus: `pending_changes` (the unified change queue `.pandacorp/inbox/changes/`, DR-069), `pending_decisions` (.pandacorp/inbox/decisions.md), `rethink_pending` (iterate asked to pause).

## Human gates as hard rules

The constitution's gates (production, spending money, deleting data, external communications, access changes) are applied as **`deny` rules in `.claude/settings.json`** + the `block-dangerous.sh` hook, NOT as limits stated in the conversation (context compaction can lose them). Claude Code's "auto mode" is NOT a security shield — deny rules always win.

## Backup & restore (launched products)

What must be true for a **released** product (`phase: release`):

- **DB**: Neon's PITR/branching is the baseline recovery mechanism; add a scheduled `pg_dump` stored outside Neon so a terminal decommission — or Neon itself failing — still leaves a portable copy. **Schedule + retention**: nightly for products with real user data, weekly for low-write internal tools; keep 7 dailies + 4 weeklies (~a month back).
- **R2 / asset buckets**: versioned, or the contents demonstrably re-derivable from source data.
- **Secrets**: the age-key backup is already covered in `external-services.md`.
- **Restore is TESTED** — an untested backup is a hope, not a backup. Cadence: **once before an external release, and again after any major schema change** (restore the latest dump into a scratch Neon branch and run the smoke suite against it).

## How it is verified
- **Human gates**: deny rules in `.claude/settings.json` + `block-dangerous.sh` hook (hard, deterministic).
- **Port ledger**: written by `scaffold`/`architecture` automation (never guessed); collisions are prevented by construction.
- **Docker dev, worktree hygiene, local-deployment layout**: review-only (conventions applied by the skills; `reviewer` on deviation).
- **Backup/restore**: release checklist — restore must be TESTED once before an external release (manual, named step).
- **Incident response**: runbook below (manual).

## Incident response (launched products)

When Sentry or an uptime check fires:

1. **Classify severity** — each class gets its response:
   - **down** (product unusable): act immediately — rollback now, diagnose after; push the owner NOW.
   - **degraded** (a flow broken, rest works): rollback or fix the same day; push the owner.
   - **cosmetic**: file it via `/pandacorp:change` in the project's queue; no interruption, no rollback.
2. **First move = rollback** to the last green deploy (the deploy platform's previous build) — restore service first, diagnose after. Fix-forward only when there is nothing green to roll back to.
3. **Notify the owner** (push) for anything user-facing (down/degraded): what broke, what was done, current state.
4. **Close the loop**: postmortem → a durable lesson in `factory/memory/` (DR-047) + the fix filed via `/pandacorp:change` in the project's queue.
