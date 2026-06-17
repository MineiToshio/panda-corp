---
description: Starts and runs the build of a Pandacorp project. Launches a dynamic workflow that builds FEATURE BY FEATURE (FRD), reading state from the work-order frontmatter (implementation_status) and each blueprint's Build Plan, with one review/test gate per FRD. ALWAYS launched together with a live supervisor that watches the build and notifies the owner (phone) on stalls/errors/end. Runs in the background, resumable. Use inside the project after /pandacorp:blueprint.
---

# /pandacorp:implement

**This is the command that starts (and resumes) the build.** It launches a **dynamic workflow** (`pandacorp-build`, a native Claude Code JS script that runs in the background) that builds **FRD by FRD** (DR-050): for each feature it reads its blueprint's **Build Plan** (the work-order DAG) and each work order's frontmatter **`implementation_status`** (the source of truth), builds the `PLANNED`/`IN_PROGRESS` ones, and runs **one review + integration gate per FRD** → `VERIFIED`. It runs IN the project. On start: `.pandacorp/status.yaml → phase: implementation`, `running: true`; when it stops/finishes, `running: false`.

> **Preflight (DR-045) — is this a Pandacorp project?** This skill mutates the project, so first confirm the marker `.pandacorp/status.yaml` exists. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing one in, `/pandacorp:spec` creates a new one. Then, if `overlay_version` is behind the plugin's `OVERLAY_VERSION`, run `/pandacorp:upgrade` first (DR-048) so the project's `.claude/workflows/pandacorp-build.js` and structure are current. Don't proceed over a missing/stale structure.

`$ARGUMENTS` optional: a **mode** (`pro` | `balanced` | `powerful` | `deep`; default `balanced`) and/or `maxFrds` (**opt-in** cap on features per run, for **supervised TEST runs only** — omit it for normal/overnight runs: the build runs to **completion** and stops by health/budget, never by an arbitrary count).

> **Engine = Dynamic Workflows, not Agent Teams** (DR-013). The per-FRD loop lives in the **script's code**, not in messages between peer agents. **Resumable by construction**: state lives in the work-order frontmatter + commits, so a re-launch reads `implementation_status` and **never rebuilds a `VERIFIED` work order** (DR-050) — no re-work.

## Execution modes (consumption/quality control)

Control the **concurrency and models** of the workflow (DR-014), not "team size":
- **pro**: minimum consumption. Up to 2 work orders at a time, economical models. A single full-stack `implementer` (no split). The `reviewer` still gates each FRD.
- **balanced** (default, Max 5x): up to 4 work orders in parallel within a feature; judge (review) on opus, workers on sonnet.
- **powerful** (Max 20x): up to 8 in parallel — finishes sooner.
- **deep**: best model everywhere, split team, extra adversarial review. Slowest/most expensive (it intentionally narrows the wave — opus + split is heavier per slice, so fewer run at once).

**How a run stops (DR-050, owner decision 2026-06-16).** By default the build runs to **completion** — it does NOT stop after N features ("stop after N" protects neither tokens nor progress: one feature can cost 10x another). A run stops only when: (a) **nothing is left** to build, (b) the **budget ceiling** is reached (the real token guardrail — set it via the run's budget directive), (c) **too many features block in a row** (a health breaker: something is systemically wrong), or (d) what remains **needs you** (a human action/decision). `maxFrds` exists ONLY to bound a deliberate, supervised **test** run while the engine is still being proven — never as the overnight guardrail.

## Unattended operation — the build supervisor (run and walk away SAFELY)

The owner runs `implement` and leaves, even overnight. For that to be SAFE — **no silent stalls, no burning the week's tokens** — launching the build is **never** just firing the workflow. It is **two things, always**:

1. **Launch**: `Workflow({ name: "pandacorp-build", args: { mode } })` (add `maxFrds` ONLY for a supervised test run). Give the turn a **budget directive** so the engine's budget circuit breaker has a real ceiling — that, plus the health breakers (too many blocks in a row), is what bounds an overnight run. Each FRD verified is an immutable commit (the safe point is a commit, never an agent state).
2. **Mount the supervisor** (this is the part that was missing and let a build run >1h unwatched):
   - **Live watch (`Monitor`)** — a bash poll (~2 min; **costs no tokens** — only an emitted *event* wakes the agent) over `.pandacorp/status.yaml` (FRD progress), the run's journal mtime + active agents (frozen?), and the agent count (spend proxy). It emits an event on: a FRD verified, **frozen** (no activity ~15 min), a new block, **pace below target**, or run end. Cover the failure signatures, not just success ("silence is not success").
   - **Health heartbeat** (~15 min) — a cheap "still healthy" check so the owner isn't left guessing.
   - **Notifications** — the engine fires a macOS desktop notification (`osascript`) on every alarm; the supervising agent ALSO sends a `PushNotification` to the phone (when Remote Control is on). No third-party push app (owner decision 2026-06-16). The owner is asleep, so reach BOTH the desktop and (if available) the phone.
   - **React to every event, repairing before giving up** — a stall → unstick it; a failing feature → the engine itself runs a **repair pass** (diagnose + fix) before it ever blocks. Only when a fix is genuinely out of reach does the feature go **BLOCKED with a reason** and the build moves on to independent features: `needs-owner` (a human must act — env var, secret, external account, product decision; also logged to `.pandacorp/inbox/decisions.md`), `external` (internet/upstream — retried later), or `error` (unresolved technical fault). The supervisor escalates `needs-owner` to you immediately; for a budget/health stop it **stops the build and notifies** with the detail ("blocked at FRD-X because Y, come decide").
   - **Self-learning of avoidable stalls (DR-047)** — when the supervisor unsticks something, **classify it**: uncontrollable (internet, server 500) → nothing to learn, don't capture; **avoidable** (a recurring pattern, an engine bug, a config) → capture the lesson to `factory/memory/_inbox.md` and, if fixable factory-wide, **fix it on the spot** so it never recurs. Every avoidable stall makes the factory better.
   - **Budget ceiling for the session** — the supervisor tracks cumulative agents/runs (a spend proxy) and **stops + notifies** at the owner's ceiling. It cannot read exact plan usage, so set a conservative ceiling.
- **Auto mode (permissions), not babysitting**: the owner activates Claude Code's *auto mode* (Shift+Tab, or `defaultMode: "auto"` in THEIR `~/.claude/settings.json`). NEVER `--dangerously-skip-permissions`.
- **Test a snapshot without stopping the build**: `git worktree add ../<project>-review <last_green_sha>`; each subagent ideally works in its own worktree (`isolation: 'worktree'`).

## How it runs (per-FRD)

The script: **baseline self-heal** (if `verify.sh` is already red, repair it before planning) → **plan** (read every FRD's frontmatter state + Build Plan; return the non-`VERIFIED` FRDs in cross-FRD order) → for each FRD (to completion, unless budget/health stops the run): build its `PLANNED`/`IN_PROGRESS` work orders in waves per the Build Plan (each: implement → fast self-test on its OWN tests → `IN_REVIEW` + `## Status Note` hand-off) → **FRD gate** (one review + integration test + full `verify.sh` over the whole feature → all `VERIFIED`; or reopen specific WOs to `PLANNED` for the next run; or, after a failed **repair pass**, `BLOCKED` with a reason) → **close-out + notify**. App-agnostic: it depends only on the docs' state and the project's `verify.sh`.

## Per-FRD loop (what each feature goes through)

1. **Build** each work order (coarse — a whole view/capability): set its frontmatter `IN_PROGRESS`, implement with TDD, run its **own** fast self-test (not the whole suite), set `IN_REVIEW`, write its `## Status Note` hand-off (interfaces exposed, integration seams) so the next agent reads that, not all the code.
2. **FRD gate** (`reviewer`, a different model from the generator): review the WHOLE feature with the 3 lenses + write adversarial tests the implementers didn't see (DR-015), exercising the work orders **together** (integration); run the full `verify.sh`. Green → every WO + the FRD frontmatter → `VERIFIED`, commit. A specific WO wrong → set ONLY those back to `PLANNED` (retry next run, no loop). Otherwise the engine runs a **repair pass** (diagnose + fix); only if that fails does the feature go `BLOCKED` with a `blocked_reason` (`needs-owner` | `external` | `error`) + notify, and the build continues with independent features.
3. **Check the inboxes at the safe point** (how the owner talks to a running build): `.pandacorp/inbox/bugs/` (regression test then fix), `rethink_pending: true` (stop cleanly + notify), `.pandacorp/inbox/decisions.md` (apply answered decisions).

## Real-time documentation (Mission Control reads it live)

Keep updated: each work order's frontmatter `implementation_status`; `.pandacorp/status.yaml` (`progress`, `running`, per-status counts, `last_green_sha`, `safe_to_test`); `.pandacorp/comms/progress.md` (append-only log — what was done, decisions, problems; allows resuming with no prior context). If something deviates from plan, document it; don't hide it.

## Decision points (escalation, visible in Mission Control)

When something unplanned appears: **first investigate** (delegate to `researcher`); if you can take the coherent decision yourself, do so and document it. **Only escalate genuinely human decisions** (product scope, irreversible, spending money, or what the registry marks human): note it in `.pandacorp/inbox/decisions.md` as `pending` (what's happening, options, **your recommendation**), notify the owner, and continue with independent FRDs. The owner answers with `/pandacorp:decide`.

## When all are done
Full suite + e2e green, `.pandacorp/status.yaml → phase: release`. Summary to the owner + next step `/pandacorp:release`.

## Rules
- Never advance with red tests. A WO that can't pass: the engine first attempts a **repair**; only if that fails = **freeze-on-red** (don't commit broken, leave HEAD at `last_green_sha`, mark `BLOCKED` + `blocked_reason` in the frontmatter, notify, continue with independent features). The build runs to completion; it stops only by budget/health or when something `needs-owner`.
- **State is the frontmatter** (`implementation_status`), never body prose or git (DR-050). `VERIFIED` is never rebuilt.
- Quota limits: lower the mode (fewer parallel agents / cheaper models). Not a code error.
- If a work order reveals the blueprint/FRD was wrong, document the conflict, fix the source doc (ADR if architectural), then continue.
- **Don't trust the worker's honesty** (constitution §22): the `reviewer` re-verifies everything; the environment is fail-closed. Never relax verification because "the agent said it passed".
