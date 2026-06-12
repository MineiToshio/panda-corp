# Investigación: Estructura del plugin pandacorp (2026-06)

## Conclusión

**Plugin en `panda-corp/plugin/` + symlink a `~/.claude/skills/pandacorp`** (patrón "@skills-dir"). Una sola línea de setup, se carga automáticamente en toda sesión y en cualquier carpeta, las ediciones al repo son efectivas al instante (sin pasos de install/update), y los skills quedan namespaced (`/pandacorp:scaffold`). El marketplace local queda como evolución futura si algún día se distribuye.

## Hallazgos clave

### Formas de instalar un plugin local (qué sobrevive reinicios)

| Patrón | ¿Persiste? | Veredicto |
|---|---|---|
| **Symlink `~/.claude/skills/pandacorp` → `panda-corp/plugin/`** | ✅ auto-carga cada sesión | ⭐ Elegido: cero ceremonia, ediciones en vivo |
| Marketplace local (`claude plugin marketplace add <ruta>` + install) | ✅ (copia a caché) | Para distribuir/pinear versiones; requiere `/plugin update` tras cada cambio |
| `claude --plugin-dir <ruta>` | ❌ solo la sesión | Solo para pruebas |

### Qué puede contener el plugin
`skills/` (→ `/pandacorp:*`), `agents/`, `hooks/hooks.json`, `.mcp.json`, `bin/`, `scripts/`, `templates/` (convención), `settings.json`. **Restricción dura**: los agentes de plugin no pueden definir `permissionMode`, `hooks` ni `mcpServers` propios.

### Variable clave: `${CLAUDE_PLUGIN_ROOT}`
Resuelve a la ruta del plugin y está disponible en skills, hooks y configs MCP. Con el symlink apunta al repo vivo. Es como el skill `/pandacorp:scaffold` encuentra sus plantillas:

```bash
cp -r "${CLAUDE_PLUGIN_ROOT}/templates/$STACK/." "$DESTINO/"
# luego: procesar *.tpl reemplazando {{PROJECT_NAME}} y renombrar
```

### Hooks de plugin: alcance global → necesitan auto-scoping
Los hooks de un plugin a nivel usuario disparan **en todos los proyectos**. Patrón obligatorio: el script verifica primero si está en un proyecto Pandacorp y sale con 0 si no:

```bash
cwd=$(cat | jq -r '.cwd')
grep -q "Pandacorp" "$cwd/CLAUDE.md" 2>/dev/null || exit 0
```

### Versionado
Durante desarrollo activo: **omitir `version` en plugin.json** → cada commit es la versión (SHA). Con symlink ni siquiera importa: siempre corre lo que está en el repo. Semver explícito solo cuando haga falta pinear estabilidad.

### Layout recomendado

```
panda-corp/
├── .claude-plugin/marketplace.json     # opcional, futuro (repo raíz = marketplace)
└── plugin/                             # raíz del plugin
    ├── .claude-plugin/plugin.json      # {"name": "pandacorp", ...} sin version
    ├── skills/{nueva-idea,descubrir,recomendar,spec,plan,disenar,scaffold,implementar,release,nueva-version,actualizar-portfolio}/SKILL.md
    ├── agents/{investigador,product-manager,disenador,arquitecto,implementador,test-writer,revisor,auditor-seguridad}.md
    ├── hooks/hooks.json                # con auto-scoping a proyectos Pandacorp
    ├── scripts/                        # helpers referenciados vía ${CLAUDE_PLUGIN_ROOT}
    └── templates/
        ├── stack-a-nextjs/  stack-b-hono/  stack-c-fastapi/  stack-d-scraper/
        └── shared/ (CLAUDE.md.tpl con sección "Origen — Pandacorp", AGENTS.md.tpl, estado.yaml.tpl)
```

### Setup (una vez)
```bash
ln -s /Users/Shared/Proyectos/panda-corp/plugin ~/.claude/skills/pandacorp
claude plugin list   # debe mostrar pandacorp@skills-dir
```

### Ejemplos reales estudiados
- Oficiales de Anthropic ([anthropics/claude-code/plugins](https://github.com/anthropics/claude-code/tree/main/plugins)): `feature-dev` (workflow de 7 fases con 3 agentes), `code-review` (5 agentes paralelos desde un comando), `security-guidance` (hook PreToolUse con 9 patrones) — mismo layout que el propuesto.
- Comunidad: [wshobson/agents](https://github.com/wshobson/agents) (84 plugins), [closedloop-ai/claude-plugins](https://github.com/closedloop-ai/claude-plugins) (SDLC plan-first por fases).

Fuentes: [Plugins](https://code.claude.com/docs/en/plugins) · [Plugins reference](https://code.claude.com/docs/en/plugins-reference) · [Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) · [Hooks](https://code.claude.com/docs/en/hooks)
