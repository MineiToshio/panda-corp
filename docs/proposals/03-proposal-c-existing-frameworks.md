# Proposal C — Adopt existing frameworks (Spec Kit + BMAD hybrid)

## Core idea

Build or configure almost nothing of your own: adopt **GitHub Spec Kit** as the phase methodology (Specify → Plan → Tasks → Implement) and take from **BMAD-METHOD** the agent roles already written and tested by the community (PM, Analyst, Architect, Scrum Master, Dev, QA). Pandacorp is limited to a thin customization layer: constitution, golden paths, and decision registry.

## Architecture

```
panda-corp/
├── factory/
│   ├── constitution.md              # injected via Spec Kit's /constitution
│   ├── golden-paths.md              # the 4 standard stacks
│   └── portfolio.md
└── docs/

proyecto-x/
├── .specify/                        # Spec Kit structure (specs, plans, tasks)
├── memory/constitution.md           # copied from the factory
└── src/
```

**Flow:** `specify init proyecto-x` → `/constitution` (loads Pandacorp standards) → `/specify` (spec from the idea) → `/plan` (stack and architecture) → `/tasks` → `/implement`, all within Claude Code, which is one of the 30+ agents supported by Spec Kit. The BMAD roles are used in the planning phase (Analyst→PM→Architect generate PRD and architecture).

## Advantages

- **Almost immediate startup**: you install and start the same day; thousands of users have already debugged these flows.
- Delegated maintenance: GitHub and the BMAD community evolve the templates for you.
- Abundant documentation and tutorials; fewer of your own design decisions to make.
- Tool-agnostic: Spec Kit works with Copilot, Gemini CLI, etc., in addition to Claude Code.

## Disadvantages / risks

- **They are not designed for your central objective (autonomy)**: both assume a human reviewing at every phase boundary. Reducing those checkpoints requires fighting against the grain of the framework.
- Documented criticism (Martin Fowler): Spec Kit generates excessive markdown (8 files per medium feature) and the agents "frequently ignore the instructions" of the checklists; Kiro/BMAD tend toward over-engineering (a 1-line fix → 4 user stories).
- BMAD is designed for enterprise teams, not for a solo operator: 9 agentic personas are too much ceremony for a side-project.
- No portfolio pipeline: these frameworks manage **one** project; the multi-project orchestration (idea intake, scoring, routines) you'd have to add anyway.
- Dependence on others' roadmaps; customizing deeply = fork = you lose the updates.

## When to choose it

If you want to validate the spec-driven methodology with zero effort before investing in your own infrastructure, or as a **source of inspiration**: the practical recommendation is to plunder their templates (BMAD's role prompts and Spec Kit's spec/plan templates are excellent starting material) and incorporate them into Proposal A, rather than adopting them as a system.

## Estimated startup effort

| Phase | Work | Approx. time |
|---|---|---|
| 1 | Install Spec Kit, write the constitution | 1 session |
| 2 | Adapt BMAD role templates | 1-2 sessions |
| 3 | Pilot with a project | days |
| 4 | (Inevitable) add a custom portfolio and autonomy layer | open-ended |
