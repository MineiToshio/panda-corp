# Investigación: Capacidades de Claude Code para construir la fábrica (2025-2026)

> Informe de referencia. Generado 2026-06-12. Docs oficiales: [code.claude.com/docs](https://code.claude.com/docs/llms.txt)

## Mapa de mecanismos → rol en la fábrica

| Mecanismo | Configuración | Rol en la fábrica |
|---|---|---|
| **Subagentes** | `.claude/agents/*.md` | Trabajadores especializados (coder, reviewer, auditor) con modelo, herramientas y permisos propios |
| **Skills / slash commands** | `.claude/skills/<n>/SKILL.md` | Procesos reutilizables del pipeline (/nueva-idea, /investigar, /spec) |
| **CLAUDE.md + rules** | `./CLAUDE.md`, `.claude/rules/` | Reglas de la fábrica; los CLAUDE.md de directorios ancestros gobiernan los hijos |
| **Hooks** | `settings.json → hooks` | Gates de calidad deterministas (lint, tests, bloqueo de acciones peligrosas) |
| **Headless / Agent SDK** | `claude -p`, SDK Python/TS | Pipelines programáticos, CI/CD |
| **Worktrees** | `claude --worktree`, `isolation: worktree` | Desarrollo paralelo sin conflictos |
| **Agent Teams** (experimental) | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | Debate multi-agente, revisión con lentes competitivas |
| **Routines (cloud)** | `/schedule`, triggers GitHub/API | Cron persistente: grooming nocturno, revisión de PRs, verificación post-deploy |
| **MCP** | `.mcp.json` | GitHub, Notion, búsqueda web, bases de datos |
| **Plugins** | `.claude-plugin/plugin.json` | Empaquetar agentes+skills+hooks de la fábrica e instalarlos en cualquier proyecto |
| **Permissions + Sandbox** | `settings.json → permissions/sandbox` | Autonomía segura; deny-list y aislamiento a nivel de SO |
| **Workflows dinámicos** | `ultracode:`, `.claude/workflows/` | Fan-out de 16-1000 agentes para tareas masivas (auditorías, migraciones) |

## Detalles clave

### Subagentes
Frontmatter relevante: `model` (sonnet/opus/haiku/inherit), `tools` (allowlist), `disallowedTools`, `isolation: worktree`, `memory: project`, `effort`, `hooks` propios, `mcpServers` propios. Los subagentes integrados: `Explore` (búsqueda read-only), `Plan`, `general-purpose`.

### Jerarquía CLAUDE.md
Claude sube por el árbol de directorios cargando cada CLAUDE.md que encuentra. **Implicación**: si los proyectos son subcarpetas de la fábrica, heredan sus reglas automáticamente. Si son carpetas hermanas, el know-how debe inyectarse vía plugin (instalado a nivel usuario) o copiarse en el scaffold. Las rules con `paths:` se cargan solo al tocar archivos coincidentes. Imports con `@archivo.md` (hasta 4 saltos).

### Hooks (el único gate fiable)
- `PreToolUse` — único que bloquea antes de ejecutar (exit 2 = bloquear). Para: prohibir `rm -rf`, `git push --force`, push directo a main.
- `Stop` — bloquea que Claude "termine" si los tests no pasan o el checklist no se cumple.
- `PostToolUse` — autoformatear tras editar.
- `TaskCompleted` (teams) — verificar definition-of-done antes de marcar tareas.
- Tipos: `command`, `http`, `mcp_tool`, `prompt`, `agent`.

### Headless / pipelines
```bash
claude -p "tarea" --output-format json --json-schema '...' --allowedTools "Read,Edit"
claude -p "siguiente etapa" --resume "$SESSION_ID"   # encadenar etapas
claude --bare -p "..."                                # CI determinista sin hooks/skills
```
Nota: desde 2026-06-15, `claude -p` y el SDK en planes de suscripción consumen un pool de créditos Agent SDK separado, a precios de API.

### Routines (agentes programados en la nube)
Triggers: cron (mín. 1 hora), eventos de GitHub (PR abierto, release), POST a API. Corren aunque la máquina esté apagada. Gestión en [claude.ai/code/routines](https://claude.ai/code/routines).

### Permisos y sandbox
Modos: `default`, `acceptEdits`, `plan`, `dontAsk`, `bypassPermissions` (solo en contenedores). Reglas `allow/deny` con sintaxis `Bash(git push --force *)`, `Read(**/.env)`, `mcp__github__delete_*`. El sandbox (Seatbelt/bubblewrap) limita filesystem y red a nivel SO — complementario a permisos. Patrón para autonomía total: contenedor Docker + sandbox + `bypassPermissions`.

### Plugins
Estructura: `.claude-plugin/plugin.json` + `skills/` + `agents/` + `hooks/hooks.json` + `.mcp.json`. El `name` se vuelve namespace (`/pandacorp:spec`). Se puede hostear un marketplace privado en un repo GitHub. **Es el mecanismo ideal para distribuir el know-how de la fábrica a proyectos separados.**

### Consistencia entre modelos (model-agnostic)
1. Prompts de subagente con checklist explícito de "done" (no confiar en que el modelo lo infiera).
2. Stop hooks como gate determinista (no confiar en que recuerde correr tests).
3. CLAUDE.md con hechos del proyecto, no instrucciones afinadas a un modelo.
4. `effort: high` para arquitecto/revisor, `low` para tareas mecánicas.
5. Salidas estructuradas con `--json-schema` validadas antes de actuar.

## Estructura de repo de fábrica recomendada (por la doc oficial)

```
factory-repo/
├── CLAUDE.md                  # reglas de la fábrica
├── .claude/
│   ├── rules/                 # seguridad, testing, git-workflow
│   ├── agents/                # coordinator, spec-writer, researcher, coder, reviewer…
│   ├── skills/                # /nueva-idea, /investigar, /spec, /scaffold, /release
│   ├── workflows/             # auditorías masivas
│   └── hooks/                 # block-dangerous.sh, verify-before-stop.sh
├── .mcp.json                  # GitHub, búsqueda web, Notion
└── settings.json              # permisos, hooks, modo por defecto
```

Fuentes: [Subagentes](https://code.claude.com/docs/en/sub-agents) · [Skills](https://code.claude.com/docs/en/skills) · [Memoria](https://code.claude.com/docs/en/memory) · [Hooks](https://code.claude.com/docs/en/hooks) · [Headless](https://code.claude.com/docs/en/headless) · [Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) · [Worktrees](https://code.claude.com/docs/en/worktrees) · [Agent Teams](https://code.claude.com/docs/en/agent-teams) · [Routines](https://code.claude.com/docs/en/routines) · [MCP](https://code.claude.com/docs/en/mcp) · [Plugins](https://code.claude.com/docs/en/plugins) · [Permisos](https://code.claude.com/docs/en/permissions) · [Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing) · [Workflows](https://code.claude.com/docs/en/workflows)
