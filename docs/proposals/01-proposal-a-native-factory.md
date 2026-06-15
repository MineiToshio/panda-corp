# Proposal A — Native Claude Code factory with a distributable plugin ⭐ Recommended

## Core idea

Pandacorp is built **entirely with Claude Code's native mechanisms**: the pipeline is skills, the roles are subagents, the safeguards are hooks and permissions, and the know-how is packaged as a **plugin** (`pandacorp-factory`) that installs at the user level and stays available in any project repo, even if it lives in a separate folder.

No custom orchestrator is written: you configure, you don't program.

## Architecture

```
panda-corp/  (the factory)
├── CLAUDE.md                          # constitution: mission, process, standards
├── .claude-plugin/plugin.json        # packages everything as the "pandacorp" plugin
├── agents/
│   ├── coordinador.md  investigador.md  product-manager.md  arquitecto.md
│   ├── implementador.md  test-writer.md  revisor.md  auditor-seguridad.md
│   └── documentador.md
├── skills/
│   ├── nueva-idea/SKILL.md           # /pandacorp:nueva-idea
│   ├── investigar/SKILL.md           # /pandacorp:investigar
│   ├── spec/SKILL.md                 # /pandacorp:spec  (PRD + EARS)
│   ├── plan/SKILL.md                 # /pandacorp:plan  (stack + ADRs + tasks)
│   ├── scaffold/SKILL.md             # /pandacorp:scaffold (creates the project repo)
│   ├── implementar/SKILL.md          # /pandacorp:implementar (TDD loop)
│   ├── revisar/SKILL.md              # /pandacorp:revisar (multi-lens panel)
│   └── release/SKILL.md              # /pandacorp:release (H2 gate)
├── hooks/hooks.json                  # blocks + verify-before-stop
├── factory/
│   ├── constitution.md  decisiones/registry.yaml
│   ├── plantillas/ (stack-a/ stack-b/ stack-c/ stack-d/ AGENTS.md.tpl CLAUDE.md.tpl)
│   └── portfolio.md
└── docs/ (investigacion/ propuestas/ adr/)
```

**Operator workflow (you):**

1. In `panda-corp/`: `/pandacorp:nueva-idea "One Piece Funko tracker"` → idea card + research + scoring → it shows you the Go/No-Go (H1 gate, you answer once).
2. `/pandacorp:scaffold funko-tracker` → creates `../funko-tracker/` from the chosen stack's template, with its CLAUDE.md, AGENTS.md, specs and plan copied, git repo initialized, CI configured.
3. In `funko-tracker/`: `/pandacorp:implementar` → the coordinator breaks the plan down into tasks, delegates to implementer/test-writer in parallel worktrees, the reviewer audits each PR, the hooks prevent finishing without green.
4. Scheduled **routines**: nightly progress review, backlog grooming, spec-vs-code verification, portfolio monitoring.

## How the know-how travels to separate projects

- The plugin installed at the user level (`~/.claude`) makes the factory's agents, skills, and hooks available in any folder — this solves "I don't want the projects inside panda-corp" without losing the inheritance of rules.
- `/scaffold` additionally copies a CLAUDE.md and AGENTS.md to the project, generated from templates (stack standards, forbidden patterns, done checklist), so that the project works even without the plugin (e.g., in CI or in the cloud).
- Standards updates are made once in the factory; the projects receive them when the plugin is updated (semantic versioning of the plugin).

## Autonomy and safeguards

- Interactive sessions: `acceptEdits` mode + deny-list + sandbox.
- Long autonomous sessions: isolated worktrees + `Stop` hooks that require green tests/lint + bounded tasks (5-6 per agent).
- Human gates only H1 (go/no-go) and H2 (production/money/external) — implemented as skills that stop and ask, plus branch protection on GitHub as a hard backstop.

## Advantages

- **Minimal build effort** (days, not weeks): it is configuration over infrastructure already proven by Anthropic.
- Resilient to model changes: explicit checklists + deterministic hooks (the mechanisms keep working with any model that runs Claude Code).
- Everything is versioned markdown: auditable, editable, with no orchestration code to maintain.
- Gradually scalable: **dynamic workflows** (a JS script that orchestrates subagents in the background) are the **build engine** of `/pandacorp:implement` — the work order loop, resumable and deterministic — and additionally serve for audits and mass migrations; Agent Teams is reserved only for occasional adversarial review when needed.

## Disadvantages / risks

- Tied to the Claude Code ecosystem (mitigation: the artifacts — specs, plans, AGENTS.md — are portable markdown that any agent can consume).
- The "while you sleep" autonomy depends on cloud routines (min. 1 h interval) or on leaving local sessions running.
- The build engine is Dynamic Workflows (native, resumable). Agent Teams is still experimental; use it only for occasional adversarial review, never as the backbone.

## Estimated startup effort

| Phase | Work | Approx. time |
|---|---|---|
| 1 | CLAUDE.md + constitution + decision registry | 1 session |
| 2 | 9 agents + 8 pipeline skills | 2-3 sessions |
| 3 | Hooks + permissions + templates for the 4 stacks | 2 sessions |
| 4 | Pilot with the Funko tracker case, adjustments | 1-2 calendar weeks |
