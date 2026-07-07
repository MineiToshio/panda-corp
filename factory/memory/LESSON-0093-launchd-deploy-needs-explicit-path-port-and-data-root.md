---
id: LESSON-0093
type: gotcha
domain: infra
tags: [launchd, deploy, worktree, path, port-collision, env]
context: an always-on local deployment served via launchd from an isolated git worktree (the DR-089 pattern) that also needs to reach the main checkout's gitignored live data
trigger: use this when wiring or debugging a launchd-served (or any daemonized, worktree-isolated) local deployment that dies with a toolchain error, collides with the dev server's port, or serves stale/empty owner data
source: "panda-corp — Mission Control always-on deploy incident 2026-07-05 (factory/decision-log.md 2026-06-25/2026-07-05 entries, factory/standards/infra.md DR-089 section); 3 distinct failure modes hit in the same incident chain. Extended 2026-07-07 (FRD-23 build): the same worktree-only-carries-tracked-files axis also bites a project's OWN materialized read-model cache (`.pandacorp/stats*.json`, gitignored) — `PANDACORP_FACTORY_ROOT` fixes the factory-wide facts (point 3 below) but does NOT make the per-project cache exist in the deploy worktree; that part correctly falls back to live/aggregate derivation (DR-078) rather than serving stale/missing data, but it's a reminder to think through how an isolated deploy worktree sees ANY gitignored materialized cache the app reads, not just the factory's own global data."
provenance: agent-inferred
created: 2026-07-06
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0090]
---

**Situation:** Mission Control's always-on local deployment (a launchd-served, git-worktree-isolated
production build, DR-089) failed in three DISTINCT ways that all trace to the same root class — a
launchd/worktree-isolated process does not inherit the interactive shell's environment or the main
checkout's context, so anything implicit must be wired explicitly:

1. **Toolchain PATH.** A launchd user-agent starts with a bare `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin`)
   — no Homebrew (`pnpm`), no fnm node (whose per-shell multishell path is ephemeral). The service died
   on every restart with `exit 127` "pnpm: not found" until `serve.sh` exported a real `PATH`
   (`/opt/homebrew/bin` + fnm's **stable** `~/.local/share/fnm/aliases/default/bin` — never the
   ephemeral multishell path).
2. **Port collision.** The deploy was originally served on `base+0` — the SAME port as the dev/preview
   server — so a stale/orphan dev `next start` silently answered in the deploy's place (no bind error,
   just the wrong process on the door). Fixed by reserving a dedicated port (`base+9`, the top of the
   project's port block) for the always-on deploy, distinct from `+0` (dev).
3. **Live-data root.** The deployment runs from an isolated git **worktree**, which carries only
   TRACKED files — the owner's gitignored state (`factory/profile.md`, `ideas/*.md`, `portfolio.md`)
   does not exist there. An app that reads that state at runtime (Mission Control is a live dashboard
   over the factory filesystem) must be pointed at the MAIN checkout explicitly (`PANDACORP_FACTORY_ROOT`,
   derived via `dirname "$(git -C "$DEPLOY_DIR" rev-parse --git-common-dir)"`), or it reads an empty
   `factory/` and trips the onboarding gate ("no profile") even though the dev server (which runs from
   the main checkout) shows the data fine — that asymmetry is the tell.

**Lesson:** these are the same underlying gotcha wearing three costumes — a launchd-daemonized,
worktree-isolated deploy is environmentally naked: it inherits neither the interactive shell's PATH, nor
a dedicated port unless one is reserved, nor the main checkout's gitignored data unless pointed at it.
"It works when I run it by hand" does not predict "it works under launchd from a worktree."

**Apply next time:** when standing up (or debugging) any daemonized/isolated-worktree local deployment,
audit all three axes up front in `serve.sh`: (1) export an explicit, stable `PATH` covering every
toolchain the app needs; (2) reserve a port distinct from the dev/preview server's; (3) if the app reads
any gitignored/live state, export an explicit root pointing at the main checkout, never assume the
worktree has it. A symptom split between "dev works, deploy doesn't" is the signature of this whole class.
