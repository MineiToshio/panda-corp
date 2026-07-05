# Pandacorp — Claude Code layer

The canonical operating manual for this repo — what the factory is, how it is operated, the planes, the rules, the decision-log discipline — lives in **AGENTS.md** (tool-agnostic, read natively by every other runtime; DR-113):

@AGENTS.md

This file adds ONLY what is specific to running the factory under **Claude Code**.

## Skills & agents under Claude Code

- The skills in `plugin/skills/<slug>/SKILL.md` are exposed as **`/pandacorp:<slug>`** slash commands by the installed plugin (the namespace prefix is automatic — never hardcode it in the directory name or the `name:` frontmatter, which stays the bare slug; the `SKILL.md` body H1 is `# /pandacorp:<slug>`). `user-invocable: false` hides internal engines from the owner's slash menu.
- The named agents in `plugin/agents/*.md` are the canonical definitions (frontmatter `model:`/`tools:` pins are enforced here). The `.codex/agents/*.toml` mirrors are **generated** — never hand-edit them.
- To run an internal engine skill by hand (`user-invocable: false`): the agent invokes it directly, or the owner flips its `user-invocable` flag.
- Recurring jobs run via **`/loop`**: `review-launch` over the portfolio and the `memory` review sweep are designed to run as self-paced `/loop` jobs.
- The build engine (`/pandacorp:implement`) runs on **Dynamic Workflows** (`pandacorp-build.js`) with the live supervisor (`Monitor` + `ScheduleWakeup` + `PushNotification`) — this background/overnight contract is Claude-Code-only; other runtimes run the attended loop (AGENTS.md §Runtime portability, `factory/standards/agent-portability.md` PORT-5).
- Enforcement hooks (`plugin/hooks/hooks.json`): dangerous-command gate (PreToolUse), verify-before-stop + lesson-capture backstop (Stop), telemetry (SubagentStop).

## Plugin maintenance

The plugin is installed from this repo's local marketplace (`claude plugin install pandacorp@panda-corp`, user scope). **After editing anything in `plugin/`**:

1. **Bump the version** in `plugin/.claude-plugin/plugin.json` per semver (DR-034): PATCH = fix/adjustment/doc that doesn't change skill/agent behavior; MINOR = new compatible capability (new skill or agent, new option); MAJOR = breaking change (renaming/removing a skill, incompatible flow change). **Keep `plugin/.codex-plugin/plugin.json` at the SAME version** (the Codex manifest, DR-113).
2. If `plugin/agents/*.md` changed: **regenerate the Codex mirrors** — `node plugin/scripts/generate-codex-agents.mjs`.
3. Note the reason in `plugin/docs/decision-log.md`; commit.
4. `claude plugin update pandacorp@panda-corp` (changes apply on session restart). Validate with `claude plugin validate plugin/`.

Mission Control **warns about drift** (FRD-15): uncommitted changes in `plugin/`, or an installed SHA (`~/.claude/plugins/installed_plugins.json`) behind the plugin's latest commit, show a banner with the update command.

## Claude-Code-specific surfaces

- `~/.claude/dashboard-events.ndjson` — the event stream Mission Control's live telemetry reads (engine + hooks append to it).
- `.claude/settings.json` / `.claude/hooks/` (repo root) — session hooks (decision-log reminder) and permissions for factory sessions; `.claude/launch.json` — Preview dev-server configs.
- Worktree isolation (DR-096) uses the `EnterWorktree`/`ExitWorktree` tools. **Landing differs by repo:** product projects land via their own `.pandacorp/merge-queue.sh`; the factory repo has NO merge queue — factory worktree branches merge directly back to `main` (solo operator, constitution §11). Factory-only prose edits (standards, docs, skill text) are exempt from the isolation nudge (BL-0033).
