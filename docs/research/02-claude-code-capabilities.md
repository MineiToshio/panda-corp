# Research: Claude Code capabilities for building the factory (2025-2026)

> Reference report. Generated 2026-06-12. Official docs: [code.claude.com/docs](https://code.claude.com/docs/llms.txt)

## Map of mechanisms → role in the factory

| Mechanism | Configuration | Role in the factory |
|---|---|---|
| **Subagents** | `.claude/agents/*.md` | Specialized workers (coder, reviewer, auditor) with their own model, tools and permissions |
| **Skills / slash commands** | `.claude/skills/<n>/SKILL.md` | Reusable pipeline processes (/nueva-idea, /investigar, /spec) |
| **CLAUDE.md + rules** | `./CLAUDE.md`, `.claude/rules/` | Factory rules; ancestor-directory CLAUDE.md files govern their children |
| **Hooks** | `settings.json → hooks` | Deterministic quality gates (lint, tests, blocking dangerous actions) |
| **Headless / Agent SDK** | `claude -p`, Python/TS SDK | Programmatic pipelines, CI/CD |
| **Worktrees** | `claude --worktree`, `isolation: worktree` | Parallel development without conflicts |
| **Agent Teams** (experimental) | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | One-off adversarial review (multi-agent debate, competing lenses) — **not the build engine** |
| **Dynamic Workflows** | `Workflow` tool / JS script that orchestrates subagents in the background (resumable) | **Engine of `/pandacorp:implement`**: work-order pipeline (loop in the script code, state in variables + files + commits, deterministic) |
| **Routines (cloud)** | `/schedule`, GitHub/API triggers | Persistent cron: nightly grooming, PR review, post-deploy verification |
| **MCP** | `.mcp.json` | GitHub, Notion, web search, databases |
| **Plugins** | `.claude-plugin/plugin.json` | Package the factory's agents+skills+hooks and install them in any project |
| **Permissions + Sandbox** | `settings.json → permissions/sandbox` | Safe autonomy; deny-list and OS-level isolation |
| **Dynamic workflows** | `ultracode:`, `.claude/workflows/` | Fan-out of 16-1000 agents for massive tasks (audits, migrations) |

## Key details

### Subagents
Relevant frontmatter: `model` (sonnet/opus/haiku/inherit), `tools` (allowlist), `disallowedTools`, `isolation: worktree`, `memory: project`, `effort`, their own `hooks`, their own `mcpServers`. Built-in subagents: `Explore` (read-only search), `Plan`, `general-purpose`.

### CLAUDE.md hierarchy
Claude walks up the directory tree loading every CLAUDE.md it finds. **Implication**: if projects are subfolders of the factory, they inherit its rules automatically. If they are sibling folders, the know-how must be injected via a plugin (installed at the user level) or copied during the scaffold. Rules with `paths:` are loaded only when matching files are touched. Imports with `@file.md` (up to 4 hops).

### Hooks (the only reliable gate)
- `PreToolUse` — the only one that blocks before executing (exit 2 = block). For: forbidding `rm -rf`, `git push --force`, direct push to main.
- `Stop` — blocks Claude from "finishing" if the tests don't pass or the checklist isn't met.
- `PostToolUse` — auto-format after editing.
- `TaskCompleted` (teams) — verify the definition-of-done before marking tasks. **Note:** it is an Agent Teams hook and **does NOT fire in dynamic workflows**; in the factory model, verification goes through the `Stop`/`verify.sh` gate and the reviewer, not through this hook.
- Types: `command`, `http`, `mcp_tool`, `prompt`, `agent`.

### Headless / pipelines
```bash
claude -p "task" --output-format json --json-schema '...' --allowedTools "Read,Edit"
claude -p "next stage" --resume "$SESSION_ID"   # chain stages
claude --bare -p "..."                          # deterministic CI without hooks/skills
```
Note: as of 2026-06-15, `claude -p` and the SDK on subscription plans consume a separate Agent SDK credit pool, at API prices.

### Routines (cloud-scheduled agents)
Triggers: cron (min. 1 hour), GitHub events (PR opened, release), POST to API. They run even when the machine is off. Managed at [claude.ai/code/routines](https://claude.ai/code/routines).

### Permissions and sandbox
Modes: `default`, `acceptEdits`, `plan`, `dontAsk`, `bypassPermissions` (only in containers). `allow/deny` rules with syntax `Bash(git push --force *)`, `Read(**/.env)`, `mcp__github__delete_*`. The sandbox (Seatbelt/bubblewrap) limits filesystem and network at the OS level — complementary to permissions. Pattern for full autonomy: Docker container + sandbox + `bypassPermissions`.

### Plugins
Structure: `.claude-plugin/plugin.json` + `skills/` + `agents/` + `hooks/hooks.json` + `.mcp.json`. The `name` becomes a namespace (`/pandacorp:spec`). A private marketplace can be hosted in a GitHub repo. **It is the ideal mechanism for distributing the factory's know-how to separate projects.**

### Cross-model consistency (model-agnostic)
1. Subagent prompts with an explicit "done" checklist (don't rely on the model to infer it).
2. Stop hooks as a deterministic gate (don't rely on it remembering to run tests).
3. CLAUDE.md with project facts, not instructions tuned to one model.
4. `effort: high` for architect/reviewer, `low` for mechanical tasks.
5. Structured outputs with `--json-schema` validated before acting.

## Recommended factory repo structure (per the official docs)

```
factory-repo/
├── CLAUDE.md                  # factory rules
├── .claude/
│   ├── rules/                 # security, testing, git-workflow
│   ├── agents/                # coordinator, spec-writer, researcher, coder, reviewer…
│   ├── skills/                # /nueva-idea, /investigar, /spec, /scaffold, /release
│   ├── workflows/             # massive audits
│   └── hooks/                 # block-dangerous.sh, verify-before-stop.sh
├── .mcp.json                  # GitHub, web search, Notion
└── settings.json              # permissions, hooks, default mode
```

Sources: [Subagents](https://code.claude.com/docs/en/sub-agents) · [Skills](https://code.claude.com/docs/en/skills) · [Memory](https://code.claude.com/docs/en/memory) · [Hooks](https://code.claude.com/docs/en/hooks) · [Headless](https://code.claude.com/docs/en/headless) · [Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) · [Worktrees](https://code.claude.com/docs/en/worktrees) · [Agent Teams](https://code.claude.com/docs/en/agent-teams) · [Routines](https://code.claude.com/docs/en/routines) · [MCP](https://code.claude.com/docs/en/mcp) · [Plugins](https://code.claude.com/docs/en/plugins) · [Permissions](https://code.claude.com/docs/en/permissions) · [Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing) · [Workflows](https://code.claude.com/docs/en/workflows)
