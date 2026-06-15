# Elements common to all proposals

These elements apply regardless of which proposal (A, B, or C) is chosen. They are Pandacorp's "operating system".

## 1. The pipeline: from idea to product

The input can be a **feature** ("app to order from a restaurant table") or a **problem** ("I don't know which One Piece Funkos exist or when they're announced"). The pipeline normalizes them the same way:

```
1. INTAKE        /nueva-idea     → idea card (problem, users, value hypothesis)
2. RESEARCH      /investigar     → report: market, competitors, data sources,
                                   available APIs, technical and legal feasibility, with citations
3. GO/NO-GO      automatic       → scoring with a rubric; human ONLY if the score is
                                   ambiguous or involves spending money              ← GATE H1
4. SPEC          /spec           → PRD with EARS acceptance criteria
5. ARCHITECTURE  /plan           → golden path selection, ADRs, breakdown into tasks
6. SCAFFOLD      /scaffold       → create the project repo from a deterministic template
7. IMPLEMENTATION                → TDD (tests first), coder + reviewer agents in parallel
8. VERIFICATION                  → tests, e2e, SAST, adversarial multi-lens review
9. RELEASE                       → automatic deploy to staging; production         ← GATE H2
10. OPERATION                    → routines: monitoring, improvements, backlog grooming
```

Each phase produces a **versioned artifact in the project repo** (not chat): `docs/idea.md`, `docs/research.md`, `docs/spec.md`, `docs/plan.md`, `docs/adr/*.md`. The next phase does not start if the previous artifact does not pass its gate (automatic validation via checklist/schema; human only at H1 and H2).

## 2. Human decisions (minimal, explicit)

Only two synchronous human gates in the normal flow:

- **H1 — Go/No-Go of the idea**: approve scope and budget. (It's a product decision: the AI doesn't know your priorities.)
- **H2 — Deploy to production / external actions**: production, sending communications to third parties, spending money, deleting data, changing access.

Everything else is governed by the **decision registry** (`factory/decisions/registry.yaml`): recurring decision types with pre-approved defaults (e.g.: "add a maintained dependency with no CVEs → auto-approve"). A decision outside the registry → escalates once to the human and the answer is codified as a new rule, so that **every human intervention reduces future ones**. Expired timeout → escalate, never auto-approve.

## 3. Agent roles and assigned models

| Agent | Role | Model | Effort |
|---|---|---|---|
| `coordinador` | Orchestrates the pipeline, delegates, never implements | opus/fable | high |
| `investigador` | Web search, market, data sources, APIs | sonnet | medium |
| `product-manager` | Idea card, PRD with EARS criteria | opus | high |
| `arquitecto` | Technical plan, stack selection, ADRs | opus/fable | high |
| `implementador` | Code with TDD; explicit done checklist | sonnet | medium |
| `test-writer` | Tests from acceptance criteria (RED phase) | sonnet | medium |
| `revisor` | Multi-lens review (bugs/security/perf) | opus (family ≠ generator if possible) | high |
| `auditor-seguridad` | SAST, secrets, dependencies, agentic OWASP | sonnet | medium |
| `documentador` | README, changelogs, user docs | haiku/sonnet | low |
| `explorador` | Read-only searches in codebases | haiku | low |

Golden rule: **judgment** tasks (architecture, review, specs) use the most capable model; **mechanical and verifiable** tasks (formatting, docs, search) use the cheapest. Each agent's prompts include an explicit done checklist so they work the same with weaker models.

## 4. Safeguards (non-negotiable)

- **Hooks**: `PreToolUse` blocks `rm -rf`, force-push, push to main, reading `.env`; `Stop` prevents declaring "done" without green tests and clean lint; `PostToolUse` auto-formats.
- **Permissions**: deny-list in `settings.json`; sandbox enabled; full autonomy only inside a container.
- **Git**: protected branches, agents only on feature branches, green CI mandatory for merge, conventional commits with commitlint.
- **Deterministic verification**: CI runs the checklist, not the model. The model never checks its own checkboxes. Bounded retries (max. 3 per subtask) with escalation.
- **Traceability**: ADRs + AgDRs (which agent, which model, which trade-off) in `docs/adr/`; per-project audit log.
- **Secrets**: never in the agent's context; injection via environment; Gitleaks in pre-commit and CI.
- **Dependencies**: lockfiles, no installing from unapproved registries, scanning for CVEs and typosquatting (LLMs hallucinate packages).

## 5. Standard stacks (golden paths)

Defined in detail in [research 04](../research/04-recommended-stacks.md):

- **Stack A** · Full-stack web: Next.js + Drizzle + Postgres + Tailwind/shadcn + Better Auth → Vercel
- **Stack B** · TypeScript API: Hono + Drizzle + Zod → Railway/Fly
- **Stack C** · Python API: FastAPI + Pydantic + SQLAlchemy → Railway/Fly
- **Stack D** · Scraping/data/notifications: Python + Playwright + ARQ/Redis + Postgres → Docker

The `arquitecto` chooses among these 4 (combinable: the Funko case = D to collect + A to display). Going off the golden path requires an ADR with justification and is a decision escalable to a human the first time.

## 6. Factory / projects separation

```
<projects-folder>/
├── panda-corp/                  ← THE FACTORY (this repo): know-how, never product code
│   ├── CLAUDE.md                ← the company's constitution
│   ├── .claude/ (agents, skills, hooks, rules)
│   ├── factory/
│   │   ├── constitution.md      ← non-negotiable principles and standards
│   │   ├── decisiones/registry.yaml
│   │   ├── plantillas/          ← scaffolds per golden path + AGENTS.md template
│   │   └── portfolio.md         ← index of products and their status in the pipeline
│   └── docs/ (investigacion, propuestas, adr)
│
├── funko-tracker/               ← PROJECT (its own git repo)
│   ├── CLAUDE.md                ← generated by /scaffold from the factory's templates
│   ├── docs/ (idea, investigacion, spec, plan, adr/)
│   └── src/ …
└── mesa-facil/                  ← another project
```

The factory is the source of truth for the **how** (process, standards, templates) and maintains the index of the **what** (portfolio). Each project is autonomous and carries its own product documentation. The handover of know-how factory→project varies depending on the chosen proposal (plugin, scaffold with copy, or subfolders).
