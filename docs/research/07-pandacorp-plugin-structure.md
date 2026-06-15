# Research: pandacorp plugin structure (2026-06)

## Conclusion

**Plugin in `panda-corp/plugin/` + symlink to `~/.claude/skills/pandacorp`** (the "@skills-dir" pattern). A single setup line, it loads automatically in every session and in any folder, edits to the repo take effect instantly (no install/update steps), and the skills are namespaced (`/pandacorp:scaffold`). The local marketplace remains a future evolution if it is ever distributed.

## Key findings

### Ways to install a local plugin (what survives restarts)

| Pattern | Persists? | Verdict |
|---|---|---|
| **Symlink `~/.claude/skills/pandacorp` → `panda-corp/plugin/`** | ✅ auto-loads every session | ⭐ Chosen: zero ceremony, live edits |
| Local marketplace (`claude plugin marketplace add <path>` + install) | ✅ (copies to cache) | For distributing/pinning versions; requires `/plugin update` after each change |
| `claude --plugin-dir <path>` | ❌ session only | For testing only |

### What the plugin can contain
`skills/` (→ `/pandacorp:*`), `agents/`, `hooks/hooks.json`, `.mcp.json`, `bin/`, `scripts/`, `templates/` (convention), `settings.json`. **Hard restriction**: plugin agents cannot define their own `permissionMode`, `hooks` or `mcpServers`.

### Key variable: `${CLAUDE_PLUGIN_ROOT}`
Resolves to the plugin's path and is available in skills, hooks and MCP configs. With the symlink it points to the live repo. It is how the `/pandacorp:scaffold` skill finds its templates:

```bash
cp -r "${CLAUDE_PLUGIN_ROOT}/templates/$STACK/." "$DESTINO/"
# then: process *.tpl replacing {{PROJECT_NAME}} and rename
```

### Plugin hooks: global scope → they need auto-scoping
A user-level plugin's hooks fire **in every project**. Mandatory pattern: the script first checks whether it is in a Pandacorp project and exits with 0 if not:

```bash
cwd=$(cat | jq -r '.cwd')
grep -q "Pandacorp" "$cwd/CLAUDE.md" 2>/dev/null || exit 0
```

### Versioning
During active development: **omit `version` in plugin.json** → each commit is the version (SHA). With the symlink it doesn't even matter: it always runs whatever is in the repo. Explicit semver only when you need to pin stability.

### Recommended layout

```
panda-corp/
├── .claude-plugin/marketplace.json     # optional, future (root repo = marketplace)
└── plugin/                             # plugin root
    ├── .claude-plugin/plugin.json      # {"name": "pandacorp", ...} without version
    ├── skills/{nueva-idea,descubrir,recomendar,spec,plan,disenar,scaffold,implementar,release,nueva-version,actualizar-portfolio}/SKILL.md
    ├── agents/{investigador,product-manager,disenador,arquitecto,implementador,test-writer,revisor,auditor-seguridad}.md
    ├── hooks/hooks.json                # with auto-scoping to Pandacorp projects
    ├── scripts/                        # helpers referenced via ${CLAUDE_PLUGIN_ROOT}
    └── templates/
        ├── stack-a-nextjs/  stack-b-hono/  stack-c-fastapi/  stack-d-scraper/
        └── shared/ (CLAUDE.md.tpl with an "Origen — Pandacorp" section, AGENTS.md.tpl, status.yaml.tpl)
```

### Setup (once)
```bash
ln -s "$(pwd)/plugin" ~/.claude/skills/pandacorp   # run from the factory root
claude plugin list   # should show pandacorp@skills-dir
```

### Real examples studied
- Anthropic's official ones ([anthropics/claude-code/plugins](https://github.com/anthropics/claude-code/tree/main/plugins)): `feature-dev` (7-phase workflow with 3 agents), `code-review` (5 parallel agents from a single command), `security-guidance` (a PreToolUse hook with 9 patterns) — the same layout as the one proposed.
- Community: [wshobson/agents](https://github.com/wshobson/agents) (84 plugins), [closedloop-ai/claude-plugins](https://github.com/closedloop-ai/claude-plugins) (phase-by-phase plan-first SDLC).

Sources: [Plugins](https://code.claude.com/docs/en/plugins) · [Plugins reference](https://code.claude.com/docs/en/plugins-reference) · [Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) · [Hooks](https://code.claude.com/docs/en/hooks)
