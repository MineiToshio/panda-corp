---
id: LESSON-0093
type: gotcha
domain: infra
tags: [launchd, deploy, worktree, path, port-collision, env]
context: an always-on local deployment served via launchd from an isolated git worktree (the DR-089 pattern) that also needs to reach the main checkout's gitignored live data
trigger: use this when wiring or debugging a launchd-served (or any daemonized, worktree-isolated) local deployment that dies with a toolchain error, collides with the dev server's port, or serves stale/empty owner data
source: "panda-corp — Mission Control always-on deploy incident 2026-07-05 (factory/decision-log.md 2026-06-25/2026-07-05 entries, factory/standards/infra.md DR-089 section); 3 distinct failure modes hit in the same incident chain. Extended 2026-07-07 (FRD-23 build): the same worktree-only-carries-tracked-files axis also bites a project's OWN materialized read-model cache (`.pandacorp/stats*.json`, gitignored) — `PANDACORP_FACTORY_ROOT` fixes the factory-wide facts (point 3 below) but does NOT make the per-project cache exist in the deploy worktree; that part correctly falls back to live/aggregate derivation (DR-078) rather than serving stale/missing data, but it's a reminder to think through how an isolated deploy worktree sees ANY gitignored materialized cache the app reads, not just the factory's own global data. Extended 2026-11-13 (mission-control .pandacorp/run/lessons.md, agent-inferred): a 4th axis — the deploy worktree does not auto-track new commits landed on `main`. After a build lands, the always-on `:1987` deploy (and the content it serves, e.g. the Manual) stays on whatever it was last built from until `.pandacorp/run/deploy-local.sh` is re-run explicitly; nothing about landing on `main` triggers it."
provenance: agent-inferred
created: 2026-07-06
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0090, LESSON-0125]
---

**Situation:** Mission Control's always-on local deployment (a launchd-served, git-worktree-isolated
production build, DR-089) failed in four DISTINCT ways that all trace to the same root class — a
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
4. **Staleness after landing.** The deploy worktree is a SNAPSHOT, not a live mirror of `main` — it does
   not rebuild or restart itself when new commits land. After a build merges to `main`, the always-on
   deploy keeps serving whatever it was last built from (stale app code, a stale Manual, stale content)
   until `.pandacorp/run/deploy-local.sh` is re-run by hand; landing on `main` does not imply the deploy
   saw it.

**Lesson:** these are the same underlying gotcha wearing four costumes — a launchd-daemonized,
worktree-isolated deploy is environmentally naked AND temporally frozen: it inherits neither the
interactive shell's PATH, nor a dedicated port unless one is reserved, nor the main checkout's
gitignored data unless pointed at it, nor new commits unless explicitly redeployed. "It works when I
run it by hand" does not predict "it works under launchd from a worktree," and "it landed on main" does
not predict "the deploy shows it."

**Apply next time:** when standing up (or debugging) any daemonized/isolated-worktree local deployment,
audit all four axes: (1) export an explicit, stable `PATH` covering every toolchain the app needs (in
`serve.sh`); (2) reserve a port distinct from the dev/preview server's; (3) if the app reads any
gitignored/live state, export an explicit root pointing at the main checkout, never assume the worktree
has it; (4) after any build lands on `main`, re-run the project's deploy script explicitly — never
assume the always-on deploy picked it up on its own. A symptom split between "dev works, deploy doesn't"
(axes 1-3) or "main has it, the deploy doesn't show it" (axis 4) is the signature of this whole class.
