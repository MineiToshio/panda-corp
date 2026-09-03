# Pandacorp — Claude Code layer

The canonical operating manual for this repo — what the factory is, how it is operated, the planes, the rules, the decision-log discipline — lives in **AGENTS.md** (tool-agnostic, read natively by every other runtime; DR-113):

@AGENTS.md

This file adds ONLY what is specific to running the factory under **Claude Code**.

## Skills & agents under Claude Code

- The skills in `plugin/skills/<slug>/SKILL.md` are exposed as **`/pandacorp:<slug>`** slash commands by the installed plugin (the namespace prefix is automatic — never hardcode it in the directory name or the `name:` frontmatter, which stays the bare slug; the `SKILL.md` body H1 is `# /pandacorp:<slug>`). `user-invocable: false` hides internal engines from the owner's slash menu.
- The named agents in `plugin/agents/*.md` are the canonical definitions (frontmatter `model:`/`tools:` pins are enforced here). The `.codex/agents/*.toml` mirrors are **generated** — never hand-edit them.
- To run an internal engine skill by hand (`user-invocable: false`): the agent invokes it directly, or the owner flips its `user-invocable` flag.
- Recurring jobs' durable mechanism is the machine-local **Desktop scheduled tasks** (canonical definitions at `plugin/docs/routines.md`): `pandacorp-review-launch` (weekly, portfolio-wide) and `pandacorp-memory-review` (daily, the self-learning sweep). **`/loop`** stays available for an attended, single-session run of either — but a `/loop` job is session-scoped and expires 7 days after creation, so it is not the recurring mechanism.
- The build engine (`/pandacorp:implement`) runs on **Dynamic Workflows** (`pandacorp-build.js`) with the live supervisor (`Monitor` + `ScheduleWakeup` + `PushNotification`) — this background/overnight contract is Claude-Code-only. **What every other runtime may do with build state is stated in exactly one place — AGENTS.md §Runtime portability, bullet "Build safety (`implement`)", detailed in `factory/standards/agent-portability.md` PORT-5. Read it there; this file deliberately does not restate it (BL-0094).** Whatever that boundary says, no other runtime may imitate or take over this live executor.
- Enforcement hooks (`plugin/hooks/hooks.json`): dangerous-command gate (PreToolUse), verify-before-stop + lesson-capture backstop (Stop), telemetry (SubagentStop), lesson-capture backstop again on `PreCompact` (BL-0104 — a session that compacts mid-conversation no longer skips the DR-047 rule-8 re-scan), pending-work soft warning on worktree removal (WorktreeRemove).

## Plugin maintenance

The plugin is installed from this repo's local marketplace (`claude plugin install pandacorp@panda-corp`, user scope). **After editing anything in `plugin/`**:

1. **Bump the version** in `plugin/runtime/plugin-metadata.json` (the SOURCE — both manifests are generated projections, DR-113) per semver (DR-034): PATCH = fix/adjustment/doc that doesn't change skill/agent behavior; MINOR = new compatible capability (new skill or agent, new option); MAJOR = breaking change (renaming/removing a skill, incompatible flow change). Then **regenerate the manifests** — `node plugin/scripts/generate-plugin-manifests.mjs` — which keeps `plugin/.claude-plugin/plugin.json` and `plugin/.codex-plugin/plugin.json` at the same version; never hand-edit those two (the derived-drift Stop gate REDs on it).
2. If `plugin/agents/*.md` changed: **regenerate the Codex mirrors** — `node plugin/scripts/generate-codex-agents.mjs`.
3. Note the reason in `plugin/docs/decision-log.md`; commit.
4. `claude plugin update pandacorp@panda-corp` (changes apply on session restart). Validate with `claude plugin validate plugin/`.

Mission Control **warns about drift** (FRD-15): uncommitted changes in `plugin/`, or an installed SHA (`~/.claude/plugins/installed_plugins.json`) behind the plugin's latest commit, show a banner with the update command.

## Claude-Code-specific surfaces

- `~/.claude/dashboard-events.ndjson` — the event stream Mission Control's live telemetry reads (engine + hooks append to it).
- `.claude/settings.json` / `.claude/hooks/` (repo root) — session hooks (decision-log reminder) and permissions for factory sessions; `.claude/launch.json` — Preview dev-server configs.
- Worktree isolation (DR-096) uses the `EnterWorktree`/`ExitWorktree` tools. **Landing differs by repo:** product projects land via their own `.pandacorp/merge-queue.sh`; the factory repo has NO merge queue — factory worktree branches merge directly back to `main` (solo operator, constitution §11). Factory-only prose edits (standards, docs, skill text) are exempt from the isolation nudge (BL-0033).
