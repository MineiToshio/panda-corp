# Propuesta A — Fábrica nativa Claude Code con plugin distribuible ⭐ Recomendada

## Idea central

Pandacorp se construye **enteramente con los mecanismos nativos de Claude Code**: el pipeline son skills, los roles son subagentes, los safeguards son hooks y permisos, y el know-how se empaqueta como un **plugin** (`pandacorp-factory`) que se instala a nivel de usuario y queda disponible en cualquier repo de proyecto, aunque viva en una carpeta separada.

No se escribe ningún orquestador propio: se configura, no se programa.

## Arquitectura

```
panda-corp/  (la fábrica)
├── CLAUDE.md                          # constitución: misión, proceso, estándares
├── .claude-plugin/plugin.json        # empaqueta todo como plugin "pandacorp"
├── agents/
│   ├── coordinador.md  investigador.md  product-manager.md  arquitecto.md
│   ├── implementador.md  test-writer.md  revisor.md  auditor-seguridad.md
│   └── documentador.md
├── skills/
│   ├── nueva-idea/SKILL.md           # /pandacorp:nueva-idea
│   ├── investigar/SKILL.md           # /pandacorp:investigar
│   ├── spec/SKILL.md                 # /pandacorp:spec  (PRD + EARS)
│   ├── plan/SKILL.md                 # /pandacorp:plan  (stack + ADRs + tareas)
│   ├── scaffold/SKILL.md             # /pandacorp:scaffold (crea repo de proyecto)
│   ├── implementar/SKILL.md          # /pandacorp:implementar (loop TDD)
│   ├── revisar/SKILL.md              # /pandacorp:revisar (panel multi-lente)
│   └── release/SKILL.md              # /pandacorp:release (gate H2)
├── hooks/hooks.json                  # bloqueos + verify-before-stop
├── fabrica/
│   ├── constitucion.md  decisiones/registro.yaml
│   ├── plantillas/ (stack-a/ stack-b/ stack-c/ stack-d/ AGENTS.md.tpl CLAUDE.md.tpl)
│   └── portfolio.md
└── docs/ (investigacion/ propuestas/ adr/)
```

**Flujo de trabajo del operador (tú):**

1. En `panda-corp/`: `/pandacorp:nueva-idea "tracker de Funkos de One Piece"` → ficha + investigación + scoring → te muestra el Go/No-Go (gate H1, respondes una vez).
2. `/pandacorp:scaffold funko-tracker` → crea `../funko-tracker/` desde la plantilla del stack elegido, con su CLAUDE.md, AGENTS.md, specs y plan copiados, repo git inicializado, CI configurado.
3. En `funko-tracker/`: `/pandacorp:implementar` → el coordinador descompone el plan en tareas, delega a implementador/test-writer en worktrees paralelos, el revisor audita cada PR, los hooks impiden terminar sin verde.
4. **Routines** programadas: revisión nocturna de progreso, grooming del backlog, verificación de specs vs código, monitoreo del portfolio.

## Cómo viaja el know-how a proyectos separados

- El plugin instalado a nivel usuario (`~/.claude`) hace que agentes, skills y hooks de la fábrica estén disponibles en cualquier carpeta — esto resuelve "no quiero los proyectos dentro de panda-corp" sin perder la herencia de reglas.
- `/scaffold` además copia al proyecto un CLAUDE.md y AGENTS.md generados desde plantillas (estándares del stack, patrones prohibidos, checklist de done), de modo que el proyecto funciona incluso sin el plugin (p. ej., en CI o en la nube).
- Las actualizaciones de estándares se hacen una vez en la fábrica; los proyectos las reciben al actualizar el plugin (versionado semántico del plugin).

## Autonomía y safeguards

- Sesiones interactivas: modo `acceptEdits` + deny-list + sandbox.
- Sesiones largas autónomas: worktrees aislados + hooks `Stop` que exigen tests/lint verdes + tareas acotadas (5-6 por agente).
- Gates humanos solo H1 (go/no-go) y H2 (producción/dinero/externo) — implementados como skills que se detienen y preguntan, más branch protection en GitHub como respaldo duro.

## Ventajas

- **Mínimo esfuerzo de construcción** (días, no semanas): es configuración sobre infraestructura ya probada por Anthropic.
- Resistente a cambios de modelo: checklists explícitos + hooks deterministas (los mecanismos siguen funcionando con cualquier modelo que corra Claude Code).
- Todo es markdown versionado: auditable, editable, sin código de orquestación que mantener.
- Escalable gradualmente: los **workflows dinámicos** (script JS que orquesta subagentes en background) son el **motor de construcción** de `/pandacorp:implement` —el loop de work orders, reanudable y determinista— y además sirven para auditorías y migraciones masivas; Agent Teams queda solo para revisión adversarial puntual cuando haga falta.

## Desventajas / riesgos

- Atado al ecosistema Claude Code (mitigación: los artefactos —specs, planes, AGENTS.md— son markdown portable que cualquier agente puede consumir).
- La autonomía "mientras duermes" depende de routines cloud (mín. 1 h de intervalo) o de dejar sesiones locales corriendo.
- El motor de construcción es Dynamic Workflows (nativo, reanudable). Agent Teams aún es experimental; usarlo solo para revisión adversarial puntual, nunca como columna vertebral.

## Esfuerzo estimado de arranque

| Fase | Trabajo | Tiempo aprox. |
|---|---|---|
| 1 | CLAUDE.md + constitución + registro de decisiones | 1 sesión |
| 2 | 9 agentes + 8 skills del pipeline | 2-3 sesiones |
| 3 | Hooks + permisos + plantillas de los 4 stacks | 2 sesiones |
| 4 | Piloto con el caso Funko tracker, ajustes | 1-2 semanas calendario |
