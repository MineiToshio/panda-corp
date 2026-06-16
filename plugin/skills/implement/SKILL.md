---
description: Starts and runs the build of a Pandacorp project with a dynamic workflow that orchestrates the factory's subagents (backend-dev, frontend-dev, test-writer, reviewer) with TDD and review. The workflow runs in the background, walks through all the work orders until done and is resumable; it is followed live from Mission Control. Use inside the project after /pandacorp:blueprint. It is the architecture → building step.
---

# /pandacorp:implement

**This is the command that starts (and resumes) the build.** It launches a **dynamic workflow** (a native Claude Code JS script that runs in the background) that orchestrates the factory's subagents, distributes the work orders and advances until done; you follow it live in Mission Control and in `/workflows`. It runs IN the project. On start, it sets `.pandacorp/status.yaml → phase: implementation`, `running: true` (the board shows the idea under "building", derived from the project phase — the card status stays `in-pipeline`); when it stops/finishes, `running: false`.

> **Preflight (DR-045) — is this a Pandacorp project?** This skill mutates the project, so first confirm the Pandacorp marker: `.pandacorp/status.yaml` exists. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing project in, `/pandacorp:spec` creates a new one. Then, if `overlay_version` in `.pandacorp/status.yaml` is behind the plugin's `OVERLAY_VERSION`, run `/pandacorp:upgrade` first (silent for compatible bumps, DR-048) so this skill runs against the current structure. Don't proceed or invent docs over a missing structure.

`$ARGUMENTS` optional: a **mode** (`pro` | `powerful` | `deep`) and/or specific work orders. Without arguments: balanced mode, builds from the first pending work order.

> **Engine = Dynamic Workflows, not Agent Teams** (DR-013). The work-order loop lives in the **script's code** (`pipeline()` / `while`), not in messages between peer agents. That makes it **resumable from the ground up** (the state lives in the script's variables + the project's files + commits), **deterministic** (dependencies and parallelism explicit in the code) and cheap to isolate (each subagent can run in its own git worktree). Agent Teams is left only for one-off adversarial review, never as the backbone.

## Execution modes (consumption/quality control)

The modes control the **concurrency and the models of the workflow** (how many `agent()` run in parallel and with which model at each stage), not the "team size":

- **pro** (`/pandacorp:implement pro`): for the Pro plan / minimum consumption. A single worker at a time (concurrency 1), economical models (sonnet/haiku). The slowest but the cheapest. **By default a single `implementer` agent (full-stack) instead of a split team**: without parallelism, splitting into backend-dev/frontend-dev adds no speed and adds coordination overhead (handoffs, publishing the contract). The `reviewer` still reviews at close. Only split if the project has a very marked back/front separation.
- **balanced** (default): designed for Max 5x. Up to 3 `agent()` in parallel; judgment (review/architecture) on opus, the workers on sonnet/haiku.
- **powerful** (`/pandacorp:implement powerful`): for Max 20x. More concurrency (up to 5) → advances faster. Use it when you want to finish sooner and your plan allows it.
- **deep** (`/pandacorp:implement deep`): maximum quality. The best model (opus) at all stages, extra adversarial review (the 3 lenses as concurrent subagents) and stricter verification. Slower and more expensive — for a project you have special affection for or when something isn't going well.

## Resumable (don't start from scratch)

Resuming is native: the workflow's state lives in the code and in the project's files.
- **Re-launch `/pandacorp:implement`**: it re-reads `docs/work-orders/` and `.pandacorp/status.yaml` and continues from the first pending one.
- Or **resume the run with `resumeFromRunId`**: the work orders already closed return their cached result and only the new stuff runs.

Each work order is committed when it closes → progress is not lost. (The old caveat that "Agent Teams has no resume" no longer applies.)

## Unattended operation (run and walk away) — see `docs/proposals/07-unattended-build.md`

The goal: the owner runs `implement` and leaves for hours, **without babysitting**, and can **test what was built when they come back** without guessing whether it's "testable". The workflow runs in the background and stops on its own when the queue empties — that's already "run and walk away", native. The principle: **the safe point is not an agent state, it is a git commit** — each work order closed green is an immutable snapshot.

- **Auto mode (permissions), not babysitting**: the owner activates Claude Code's *auto mode* (Shift+Tab → "Auto mode", or `defaultMode: "auto"` in THEIR `~/.claude/settings.json` — the repo cannot grant it on its own). With that the subagents stop asking "do I continue?" and only stop on unrecoverable red or a human gate. **Auto mode (permissions) ≠ build mode (concurrency/models).** NEVER `--dangerously-skip-permissions`.
- **Freeze-on-red (natural exit from the pipeline)**: a stage that doesn't pass the gate **throws** → that work order falls to `null` and the `pipeline()` **continues with the independent work orders**, without halting the batch over one broken front. For the broken WO: do NOT commit the broken state, leave `HEAD` at the last green (`last_green_sha`), mark it `BLOCKED` in `.pandacorp/status.yaml` and **emit a notification to the owner** (Notification / PushNotification hook).
- **Circuit breakers** (mandatory so as not to burn money unattended): cap on iterations, no-progress detection (same error / empty diff / same test failing N times) and a budget cap per run (the workflow's `budget`). They go in the loop condition of the script. The native auto-mode backstop (pause after classifier blocks) does NOT replace this.
- **`/loop` vs `/goal` — which and when** (they are not alternatives to `implement`; they are the *cadence engine* that `implement` invokes depending on the case):
  - **Normal build**: neither of the two. The workflow IS the loop; it runs until the queue empties and stops on its own.
  - **Continuous / unattended factory**: wrap `implement` in **`/loop`** *self-paced* to re-launch the workflow every so often, collect the inboxes (`.pandacorp/inbox/bugs/`, `.pandacorp/inbox/decisions.md`) and keep going. NOT at a fixed cron interval (scheduled tasks expire and introduce delays).
  - **`/goal`**: an edge tool — for a supervisory session that must not stop until a concrete condition. Rare with workflows, because the workflow already brings its own end condition.
- **Test a snapshot WITHOUT stopping the build (git worktrees)**: the owner tests the last green in ANOTHER folder — `git worktree add ../<project>-review <last_green_sha>` — while the workflow continues. Keep ONE single review folder and refresh it to the last green. Mission Control gives them the ready command. Each subagent ideally works in its own isolated worktree (`isolation: 'worktree'`).
- **DB in dev with Docker** (`factory/standards/infra.md`): each project and each worktree spins up its DB in Docker, with its own port, so the owner's test and the agent's don't step on each other.

## How it runs (workflow shape)

The skill authorizes **launching a dynamic workflow** with the Workflow tool. Its shape:

- **State in files**: it reads `docs/work-orders/` (queue + dependencies) and `.pandacorp/status.yaml`; it writes progress right there (Mission Control reads it live).
- **`pipeline(workOrders, build, review, verify)`** — each work order walks through the 3 stages with no barrier between items (a WO can be in *review* while another is in *build*). Concurrency and models per mode (DR-014); each `agent()` can run in its worktree (`isolation: 'worktree'`).
- A stage that fails **throws** → freeze-on-red for free (that WO is skipped, the independent ones continue).
- Each subagent **emits its event** to Party (`emit-event.sh`) and **writes the critical context to files**, not only returns it.

This shape already comes **scripted as a saved workflow** in each project: `.claude/workflows/pandacorp-build.js` (brought by the scaffold). `implement` launches it with the Workflow tool:

```
Workflow({ name: "pandacorp-build", args: { mode } })   // mode: pro | balanced | powerful | deep
```

The script reads the queue, builds the **waves by dependencies** (parallel within the wave, barrier between waves; in `pro`, one at a time), spawns the stack subagents via `agentType` (DR-013), runs the gate and commits each WO when green. It is **app-agnostic**: it only depends on the work-order queue and the project's `verify.sh` — nothing of the product is hardcoded. For trivial projects (a single module) it uses a single `implementer`, without a pipeline.

## Composition and models

- **Composition by stack** (DR-013): web (A) → `backend-dev` + `frontend-dev` + `test-writer`, with the `reviewer` at close. API/scraper (B/C/D) → `backend-dev` + `test-writer` (no frontend). **No fixed researcher**: the workers call the `researcher` on demand; the background research was already done in spec and blueprint.
- **Concurrency and models** (DR-014, design for Max 5x): up to 3 simultaneous `agent()`; judgment on opus, workers on sonnet/haiku. If the owner builds the factory itself, they can raise concurrency (Max 20x).

## Per-work-order loop (each pipeline item)

1. **Select** the next work order per `docs/work-orders/README.md` (respect dependencies) and mark it `in-progress`.
2. **build — distribute with dependencies** (orchestrated in the script, not by peer messages):
   - `backend-dev`: implements data/logic/API with TDD; publishes the contract in `docs/api.md`.
   - `frontend-dev`: starts its stage when the contract is ready; implements UI with design tokens and **consumes the `copywriter`'s strings** from the i18n resources (`docs/design/voice-and-tone.md` + keys) — zero hardcoded text or improvised "Error 500".
   - `test-writer`: writes/runs acceptance tests (RED before implementing; e2e of the flows at close).
   - **Telemetry**: when a work order touches a flow of the event plan (`docs/analytics/events.md`), it is instrumented right there (the `analytics` defined what/where; no PII, DR-025). It is not left for later.
   - Each agent writes the critical context to files (the files are the shared source of truth between stages).
3. **review** (`reviewer` agent, a different model from the generator): it verifies evidence itself (runs tests/lint/typecheck) and **writes adversarial tests the implementer didn't see** (DR-015), anchored in EARS and in bugs from `.pandacorp/comms/progress.md`. It reviews with its 3 lenses. In **deep mode**, the 3 lenses (correctness / security / quality) run as **concurrent subagents** (they finish in the time of the slowest, not the sum) and **mutation testing** is required at FRD milestones (DR-016). REJECTED → it goes back to the responsible agent with the findings (max. 2 cycles; on the third, escalate to the owner).
4. **verify — close (safe point)**: ONLY if `.pandacorp/verify.sh` passes, commit/merge the work order; work order → `done` with evidence; the gate script writes in `.pandacorp/status.yaml` the `last_green_sha` (commit) and `safe_to_test: true`. **Never commit mid work order.**
5. **Check the inboxes** (at this safe point, never mid-work — this is how the owner talks to you without stopping the build):
   - `.pandacorp/inbox/bugs/` → new bugs: first a **regression test** that reproduces it, then the fix; prioritize the `critical` ones.
   - `.pandacorp/status.yaml` `rethink_pending: true` → `iterate` asked to pause for a major change: **stop cleanly here** and notify the owner.
   - `.pandacorp/inbox/decisions.md` → pending ones the owner already answered with `/decide`: apply them and unblock that front.
6. **FRD milestone**: when completing a FRD's work orders, run that FRD's e2e suite and **kill the test dev servers with `TaskStop`** (avoids zombie processes). Repeat until work orders are exhausted.

> **Mission Control** shows this workflow live in the **Party** tab: the events are emitted by the subagents (`emit-event.sh`) and the factory's `SubagentStop` hook to `~/.claude/dashboard-events.ndjson`. It requires no action from the agent. Meanwhile, `/workflows` gives the native live view.

## Real-time documentation (key for resuming and for Mission Control)

While building, ALWAYS keep updated (Mission Control reads it live):
- **`docs/work-orders/`**: status of each work order (`todo` → `progress` → `review` → `done`) with evidence at close. It is Mission Control's read-only view.
- **`.pandacorp/status.yaml`**: `progress:` (one line of what is being done right now), `running`, work orders done/total.
- **`.pandacorp/comms/progress.md`**: append-only log (what was done, decisions taken, problems). Allows resuming with no prior context.
- **Deviations**: if something does NOT work as planned, document it in the work order and in `.pandacorp/comms/progress.md` ("this needs improvement / we changed X because Y"). Don't hide it.

## Decision points (escalation to the owner, visible in Mission Control)

When something appears that wasn't resolved: **first investigate** (delegate to the `researcher`) and, if with that you can take the coherent decision yourself, do so and document it in `.pandacorp/comms/progress.md`. **Only escalate to the owner the genuinely human decisions**: product scope, something irreversible, spending money, or what the decision registry marks as human. In that case do NOT guess: note it in `.pandacorp/inbox/decisions.md` as `pending` (what's happening, options researched, **your recommendation**) and, if it blocks that front, continue with other work orders. Mission Control highlights these entries (a chip with the number of pending ones per project). The owner answers with **`/pandacorp:decide`**, which records their answer in `.pandacorp/inbox/decisions.md` and unblocks the front.

## When all are done

- Full suite + e2e green, `.pandacorp/status.yaml` → `phase: release`.
- Summary to the owner: what was built, evidence, and the next step `/pandacorp:release`.

## Rules
- Never advance with red tests. Identical errors repeated 3 times = **freeze-on-red** (don't commit the broken state, leave HEAD at `last_green_sha`, mark the WO `BLOCKED`, notify the owner, continue with independent WOs — the `pipeline()` does it on its own when a stage throws).
- Quota limits: if rate limits are hit, lower the workflow's concurrency (fewer `agent()` in parallel) and/or lower the workers' models. It is not a code error.
- If a work order reveals that the blueprint/FRD was wrong, document the conflict, adjust the source document (ADR if it's architectural) and only then continue.
- For trivial projects or those without a clear separation (a single module), it's fine to use a single `implementer` agent instead of the full pipeline.
- **Long-running background processes**: dev servers, watchers and builds are run as background tasks so as not to block. Claude Code's checkpoints are a session safety net, but do NOT replace the per-work-order commit nor do they track changes made by Bash — commit each work order when you close it.
- **Don't trust the worker's honesty** (constitution §22): the propensity to "cheat" depends on the model; that's why the `reviewer` re-verifies everything and the environment is fail-closed. Never relax verification because "the agent said it passed".
