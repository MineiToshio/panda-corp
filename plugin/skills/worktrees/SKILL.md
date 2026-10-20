---
name: worktrees
description: Cleans up a repository's git worktrees and leftover branches — the parallel sessions (claude/*, codex/*), review folders, temp checkouts and build-engine lanes/gates that pile up over weeks. It removes on its own ONLY what is provably safe (already merged into the default branch, no uncommitted changes, idle, not in use), never touches a locked/deployed worktree, a live build's lanes and gates, or the checkout the session stands in, and walks the owner through everything else one item at a time in plain Spanish (what it contains, where it came from, how old, commits ahead, uncommitted files) with a recommendation to integrate or discard. Use it inside a Pandacorp project folder or in the factory whenever the owner says "limpia los worktrees", "depura las ramas", "tengo muchos worktrees", "qué ramas quedan sin mergear", "ordena el repo", or Mission Control's Inicio says a project needs `/pandacorp:worktrees`.
---

# /pandacorp:worktrees

Depurates the git worktrees and un-merged branches of the repository you are standing in (a product project or the factory itself). After months away, a raw `git worktree list` is unreadable; this skill turns it into three piles: **removed** (it was safe), **kept** (it must never be touched), and **your call** (each one explained, with a recommendation). Runs in the project folder or the factory; one repository per run.

The judgment of what is safe is NOT yours to make by eye: a script decides it deterministically, and you only present its verdicts, ask, and act on the owner's answers. That split is the whole safety model — a confident-looking guess is exactly how a stranded branch with a week of work gets deleted.

**The engine:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-sweep.mjs" <scan|clean|discard> --repo <dir> --self <dir>` (JSON on stdout; exit 0 ok · 2 bad input · 3 refused). Its semantics match Mission Control's pending reader (`mission-control/src/lib/pendingMerge/pendingMerge.ts`): default branch = `origin/HEAD` without `origin/`, else `main`; pending = a surviving worktree or a branch not merged into it; stale after `PANDACORP_STALE_HOURS` (default 3) since the last activity.

## Steps

1. **Inventory (read-only).** From the repository (any checkout of it):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-sweep.mjs" scan --repo . --self "$PWD"
   ```
   `--self` is the checkout this session stands in — always pass it, so the script protects it. Every item comes back as `safe`, `ask` or `protected`, with: `branch`/`path`, `origin` (claude, codex, build-lane, build-gate, review, temp, deployment, manual), `subject` (last commit), `ageHours`/`idleHours`, `ahead` (commits not in the default branch), `uncommitted`, `ownerState` (gitignored owner files inside it), `patchEquivalent`, `mergeClean`, and for `ask` a `suggestion` (`integrate | discard | keep | review` + why). `projects[]` says whether a build is live. If the JSON reports `refused`, stop and tell the owner why.

2. **Remove the safe set without asking** — the owner's standing agreement is that merged + clean + idle goes automatically. The exception is the owner's own words in this request: if they said not to touch anything (else) without asking, or only to report, their instruction wins — list the safe items by name in one question ("ya están en main y limpios, ¿los borro?") and run `clean` only after they say yes.
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-sweep.mjs" clean --repo . --self "$PWD"
   ```
   It re-scans first (never trusts step 1's snapshot), then runs only `git worktree remove <path>` (no `--force`), `git branch -d <branch>` (no `-D`) and `git worktree prune`. A removal git refuses lands in `failed` and is reported, never retried with force.

3. **Present the `ask` items to the owner — in Spanish, one block per item, plain words.** For each: what it contains (the last commit subject; for uncommitted work, how many files), where it came from (`origin` translated: "sesión de Claude", "sesión de Codex", "lane del motor de build", "carpeta de revisión", "checkout temporal"…), how old it is (in days when > 48 h), commits ahead, uncommitted files, owner-state files if any (list them — they are gitignored and have no git history), and your recommendation with its reason (table below). Then ask with `AskUserQuestion` (≤ 4 items per call, several calls if needed; options *Integrar / Descartar / Dejar*, the recommended one first and marked "(Recomendado)"). Group trivially identical items (e.g. 5 review folders with the same kind of leftovers) only if every one is still named in the question — the owner confirms **each item by name**, never "everything".

   | suggestion.why | Say it as | Default recommendation |
   |---|---|---|
   | `unmerged-commits` | tiene N commits que no están en main y se integran sin conflictos | Integrar |
   | `content-already-in-default` | sus cambios ya están en main (rebase/cherry-pick) aunque la rama no lo sepa | Descartar |
   | `conflicts-with-default` | tiene trabajo sin integrar que choca con main | Revisar: integrar a mano o descartar |
   | `old-unmerged` | trabajo sin integrar de hace más de 30 días | Revisar (probablemente abandonado) |
   | `uncommitted-work` | tiene N cambios sin commitear | Revisar: commitear y luego integrar, o descartar |
   | `owner-state` | guarda ficheros tuyos fuera de git (`.pandacorp/inbox`…) | Revisar: mover esos ficheros antes |
   | `nested-worktree` | contiene otro worktree dentro | Dejar hasta resolver el de dentro |
   | `build-engine-chain` | trabajo de una lane del build sin aterrizar | Dejar: el próximo `/pandacorp:implement` lo aterriza o lo re-despacha |
   | `recent-activity` | se usó hace menos de `staleHours` h (puede haber una sesión trabajando) | Dejar |
   | `merged-but-not-clean` | ya está en main, pero tiene cambios encima | Revisar |

4. **Act on each answer — only on that item, only after its answer.**
   - **Integrar** —
     - *Product project with `.pandacorp/merge-queue.sh`* (`mergeQueue: true`): if the item is a clean worktree on a branch, run `cd <worktree> && bash .pandacorp/merge-queue.sh` (0 merged · 10 rebase conflict · 11 red gate · 12 main busy · 20 precondition — a non-zero exit is handed back to the owner in Spanish, never forced). For a branch with no worktree, first `git worktree add .claude/worktrees/integrate-<slug> <branch>` and `bash .pandacorp/worktree-bootstrap.sh` inside it, then the merge queue from there.
     - *Factory (no merge queue — its branches merge directly to main, CLAUDE.md)*: the main checkout must be clean (`git -C <main> status --porcelain` empty, else hand back "main está ocupado"); then `git -C <main> merge --no-edit <branch>`; on conflict `git -C <main> merge --abort` and hand back. Do not push.
     - A **detached** worktree with commits gets a branch first (`git branch rescue/<slug> <head>`). A worktree with **uncommitted** changes is integrated only if the owner, in the same answer, says to commit them (show the file list first); otherwise leave it.
     - Afterwards remove the now-merged item with `clean --also <path-or-branch>` (`--also` lifts only the recent-activity hold for the item the owner named).
   - **Descartar** —
     ```bash
     node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-sweep.mjs" discard --repo . --self "$PWD" --target <branch-or-path> --confirmed
     ```
     It refuses a protected item, archives the tip — plus a snapshot of uncommitted, untracked and gitignored owner-state files — under `refs/pandacorp-archive/<date>/…`, and only then removes it. Tell the owner the archive ref and the `restore` command it returns, so the discard can be undone. This is the only path that removes un-merged work; never run `git branch -D` / `git worktree remove --force` yourself.
   - **Dejar** — nothing.

5. **Close with a short Spanish summary**, three lines plus details: **Eliminados** (count + names, from `clean`/`discard`), **Mantenidos** (the `protected` ones with their reason, and the ones the owner chose to keep), **Esperando confirmación** (any item still unanswered). If a build is live (`projects[].live`), say so: its lanes and gate worktrees were left alone and the skill can be re-run when it ends. Re-run `scan` at the end so the counts are real, not remembered.

## What is never touched (`protected`)

| reason | Meaning |
|---|---|
| `locked` | a locked worktree, e.g. the deployed snapshot in `/Users/Shared/local-deployments/` (DR-089) |
| `deployment` | any worktree under `local-deployments/`, locked or not |
| `self` | the checkout this session stands in (deleting it dangles the session's cwd) |
| `in-use` | some running process has its cwd inside it (another session, a dev server) |
| `live-build` | a build-engine worktree (`.pandacorp/run/**`) or `lane/*` branch of a project whose build is live or resumable — the same liveness rule `/pandacorp:implement` uses (`check-build-liveness.sh`) plus any atomic lease, stale ones included |

Never edit or delete anything under a `.pandacorp/` directory or `factory/{ideas,memory,profile.md,portfolio.md}` by hand while doing this (PROTECTED STATE PATHS, AGENTS.md): the script already refuses to auto-remove a worktree holding such files and snapshots them on a confirmed discard.

## Other runtimes

The script is runtime-neutral. Without `AskUserQuestion`, ask in chat with the same per-item options. Without `${CLAUDE_PLUGIN_ROOT}`, the engine is at `plugin/scripts/worktree-sweep.mjs` in the factory.
