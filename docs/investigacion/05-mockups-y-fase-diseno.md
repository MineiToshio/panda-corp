# Investigación: Herramientas de mockups para la fase de diseño (2026-06)

## Conclusión

**Combinación recomendada: mockups HTML autocontenidos generados por Claude Code (pipeline automatizable) + Claude Design (opcional, para exploración visual manual), sobre un sistema de diseño shadcn/ui + tokens como guardrail.**

## Hallazgos clave

### Claude Design (Anthropic Labs, abril 2026)
- Herramienta de diseño visual en claude.ai: prompts → prototipos HTML/CSS/JS interactivos. Incluida con Pro/Max sin costo extra (cuota separada del chat y de Claude Code).
- Tiene **handoff directo a Claude Code**: exporta bundle con `design.html`, screenshots, `design-notes.md` y spec de componentes con design tokens.
- **Limitación clave: no tiene API ni MCP** — es solo navegador, no se puede automatizar desde el pipeline. Investigación preview, consume mucha cuota.
- Rol en la fábrica: herramienta manual opcional cuando Sergio quiera explorar visualmente; el bundle exportado entra al pipeline como artefacto.
- [Anuncio](https://www.anthropic.com/news/claude-design-anthropic-labs) · [Mecánica del handoff](https://claudefa.st/blog/guide/mechanics/claude-design-handoff)

### Mockups HTML generados por Claude Code (el camino automatizable)
Patrón comunitario consolidado:
1. `DESIGN.md` + `design-tokens.json` como contrato del proyecto (tokens de color/tipografía/espaciado, inventario de componentes, prohibiciones).
2. El agente genera **3 direcciones de diseño en paralelo** como `.html` autocontenidos y navegables (CSS/JS inline, responsive).
3. Playwright saca screenshots por viewport (375px/1280px) y axe-core corre chequeo de accesibilidad → `a11y-report.md`.
4. **Gate humano**: Sergio abre los 3 HTML en el navegador y elige (o pide iterar). Una palabra de respuesta.
5. Se congela el contrato: `design-tokens.json` final + `decisiones-de-diseno.md`. La implementación solo puede usar tokens, nunca valores hardcodeados.

### Guardrails de diseño (compensan la debilidad UX/UI)
- **shadcn/ui CLI v4 + shadcn/skills** (marzo 2026): skill oficial para agentes que reduce alucinaciones; **Presets** empaquetan tema completo en un string (`npx shadcn init --preset CODE`).
- **tweakcn**: editor visual de temas shadcn → exporta variables Tailwind + JSON versionable = nuestro `design-tokens.json`. [tweakcn](https://tweakcn.com/)
- **Agente revisor de diseño**: Playwright MCP (render + screenshots multi-viewport) + `@axe-core/playwright` (WCAG 2.2) como gate automático ANTES de que Sergio mire.

### Herramientas externas evaluadas
| Herramienta | ¿API? | Veredicto |
|---|---|---|
| v0 Platform API (Vercel) | Sí (REST, beta, ~$1-4/generación) | Opcional futuro: componentes complejos (tablas, charts) |
| Magic Patterns | Sí (REST) | Alternativa a v0, URL hosteada para revisar |
| Lovable / Bolt.new | No | Descartar: interactivos, modelo de créditos |
| Figma Make + MCP | MCP de lectura | Solo si existieran diseños Figma previos — no es el caso |

## Artefactos estándar de la fase de diseño

```
docs/diseno/
├── mockups/direction-{1,2,3}.html      # navegables, autocontenidos
├── mockups/screenshots/*.png           # por viewport
├── mockups/a11y-report.md              # axe-core
├── design-tokens.json                  # fuente única (tweakcn/extraído)
└── decisiones-de-diseno.md             # dirección elegida y racional
DESIGN.md                               # sistema de diseño del proyecto
```

Fuentes adicionales: [Workflow design-to-code](https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/guide/workflows/design-to-code.md) · [Convención DESIGN.md](https://dudarik.com/en/blog/claude-code-ai-design-mcp/) · [shadcn 2026](https://medium.com/@nakranirakesh/shadcn-ui-march-2026-update-cli-v4-ai-agent-skills-and-design-system-presets-d30cf200b0e9) · [axe + Claude Code](https://claudecodeguides.com/claude-code-axe-accessibility-testing-guide/)
