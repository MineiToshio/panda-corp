# Unattended build + testing stable snapshots (without babysitting)

> Generated 2026-06-14 from a verified web research effort (30/32 findings survive).
> It resolves the tension: running `/pandacorp:implement` for hours without being on top of it + being able to review/test
> the progress when you come back, without guessing whether the state is "testable".

## The principle that resolves it

**The safe point is not an agent state: it is a git commit.** Instead of *pausing the agent to inspect*, you treat **every work order closed green as an immutable snapshot**. Invariant (Fowler, *Release-Ready Mainline*): "the head of mainline can always be put directly into production". The agent never leaves work half-done at the stable point: either the WO closes green and commits, or it stays dirty in ITS folder without touching the commit you test. Since the git history is shared, that green commit is visible instantly from another folder **without stopping, without pushing, without asking**. "Running unattended" and "testing a stable snapshot" stop competing: they are the same *commit-when-green* discipline seen from two directories.

## The pattern, step by step

### a) Run unattended — "small batches + freeze-on-red"
The agent advances WO after WO as long as the gate is green and **only stops when a gate goes red and it can't auto-fix it in N attempts** (or a human gate from the constitution). Autonomy ≠ "never ask"; it's "ask only on an unrecoverable red".
1. **Remove the "shall I continue?"** → **auto mode** (Shift+Tab → "Auto mode", or `defaultMode: "auto"` in `~/.claude/settings.json`). A classifier reviews each action before executing it and only blocks what escalates beyond what was asked / targets unknown infra / comes from hostile content. Requires Claude Code v2.1.83+ and Opus 4.6+. **The repo cannot grant it to itself** (ignored since v2.1.142) — aligned with the human gates. Do NOT use `--dangerously-skip-permissions`. [anthropic.com/engineering/claude-code-auto-mode]
2. **Long processes without blocking** → `run_in_background: true` in Bash (dev server / e2e watch) + the **Monitor** tool to tail logs/CI without pausing the conversation. [code.claude.com/docs/en/tools-reference]
3. **A goal-oriented driver**, not an interval-oriented one: the **workflow IS the loop** ("build until the queue is empty and every FRD has green e2e", and it stops on its own). `/loop` *self-paced* only if you also want to run it continuously/unattended; `/goal` as an edge tool. Never at a fixed cron interval.
4. **Mandatory circuit breakers** (without these, an unattended run burns money): an iteration cap, no-progress detection (same error / empty diff / same test failing N times), a budget cap. The auto mode backstop (pause after 3 blocks in a row) **does not replace** this: it counts blocks by the safety classifier, not red tests or dollars.

### b) Mark/publish each stable milestone
- **The WO close gate runs LITERALLY the same `verify.sh` as CI** (not a "fast" version that could diverge; otherwise the "green" badge lies). The `Stop` hook already runs `.pandacorp/verify.sh`; what's missing is for GitHub Actions to invoke that same script.
- **Each close commit writes to `docs/status.yaml`**: `last_green_sha` and `safe_to_test: true/false`. `safe_to_test=true` ONLY when `HEAD == the last WO closed green` (not if there's uncommitted work). **The gate script writes it, not the agent.**

### c) The human tests a snapshot WITHOUT touching the agent — git worktrees
The agent stays in its folder/branch; you check out the last green in ANOTHER folder:
```bash
git worktree add ../<proyecto>-review <last_green_sha>
cd ../<proyecto>-review && <golden-path dev command>   # on another port
# when done:
git worktree remove ../<proyecto>-review
```
The review worktree shares the history but has its own working dir and branch: it stays **immune** while the agent commits, it only sees closed commits, **never** the dirty mid-WO state. Worktrees created by hand are not deleted by Claude Code's sweep (they survive for hours) and let you **close the laptop without killing the run**. Gotchas to solve in the template:
- **Config/deps are not inherited**: a worktree is a fresh checkout without `.env`/`node_modules`. Use `.worktreeinclude` (`.gitignore` syntax) to copy `.env` + a post-create step that installs deps.
- **Port/DB collision**: a port per worktree via `.env`. Watch out for shortcuts like `UNSAFE_AUTH_BYPASS` (don't ship to release).
- **You bring up the review dev server, not the agent**: the agent's background shells are killed ~5s after the final result and are not restored on `--resume` (and they leave zombies if `TaskStop` is not called).

### d) What Mission Control shows (two things conflated today)
- **`main = testable` badge**: green ONLY with `safe_to_test: true`. Shows a short `last_green_sha` + "FRD-3 closed, e2e green" + the `git worktree add …` command to copy. = "last testable point".
- **"building now" indicator**: the WO in progress, the active agent, and an age counter: if `last_green_sha` is far behind HEAD → alert (the testable snapshot is getting old).
- **"Test stable snapshot" button**: sets up the worktree on `last_green_sha`.

## What to change in Pandacorp (concrete)
- **`plugin/skills/implement/SKILL.md`**: document startup in auto mode; make explicit commit-only-at-the-edge-of-a-green-WO; add worktree provisioning (.env + deps); turn "3 errors = stop" into **freeze-on-red** (don't commit what's broken, leave HEAD at `last_green_sha`, mark the WO `BLOCKED`, **PushNotification to the owner**, continue with independent WOs); `TaskStop` of dev servers when closing each FRD.
- **`/loop` — YES and NO:** the **workflow IS the loop** (it runs until the queue is empty and stops on its own); `/loop` *self-paced* only to keep it running continuously/unattended. NOT at a fixed interval (scheduled tasks expire after 7 days, are session-scoped, don't catch up, and introduce delays of 1min–1h). For continuous work: the self-paced workflow + Monitor.
- **git:** trunk-based — each WO commits/merges **when the WO closes**, not when the project closes (forbid hours-long `feature/proyecto-completo`). Optional semver tag per FRD milestone. For features that span several WOs: **feature toggles in source-control (YAML, not DB)** with an expiration date, so each intermediate WO leaves `main` deployable.
- **Mission Control:** the 3 elements of (d), reading `last_green_sha`/`safe_to_test` from `status.yaml`.
- **hooks:** `Notification` (idle) + a rich notification when closing an FRD ("FRD-3 green, SHA abc testable").

## Alternatives
| Option | Verdict |
|---|---|
| **A. Pause with a timeout that auto-continues** (the agent stops at each milestone, waits X min, continues if you don't respond) | **No.** It sits idle burning time/tokens, ties you to your clock, and the "stable point" is still a session state that doesn't survive an outage. |
| **B. Never pause + test the snapshot via worktree** (freeze-on-red, commit-when-green, you test `last_green_sha` whenever you want) | **Recommended.** It advances at maximum speed; the stable point is an immutable commit that survives outages and closing the laptop; you test async without touching the agent. |
| **C. Auto-revert of the broken WO** (revert the offending WO and continue, instead of freezing the batch) | A valid variant of B for **independent** WOs. By default prefer freeze + notify. |

## Caveats
- **Auto mode is not a security shield** (~17% false negatives). The human gates (prod, money, deleting data, external comms) must be **hard `deny` rules in `.claude/settings.json`**, not conversational limits (context compaction can lose them). Deny rules always win.
- **"Green in CI" ≠ "runs end-to-end on your machine"** if migrations/services/env are not in the gate. The review worktree needs its `.env`, deps, and sometimes migrations.
- **Native checkpoints do NOT work as a snapshot**: they only track Write/Edit, ignore what Bash does (including git), and are session-scoped. The real snapshot is git.
- **Billing**: since 2026-06-15, `claude -p` / Agent SDK on subscription plans consumes a credit separate from the interactive limit (relevant for long loops).
- Some figures cited in sources are one author's heuristics, not laws — don't codify them as hard rules.

## Main sources
martinfowler.com/articles/branching-patterns · trunkbaseddevelopment.com · dora.dev/capabilities/trunk-based-development · martinfowler.com/articles/feature-toggles · anthropic.com/engineering/claude-code-auto-mode · code.claude.com/docs/en/{permission-modes,worktrees,tools-reference,hooks-guide,headless,scheduled-tasks,agent-sdk/file-checkpointing} · git-scm.com/docs/git-worktree · github.com/anthropics/claude-code/issues/16198
