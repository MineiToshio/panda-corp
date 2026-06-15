# Proposal B — Programmatic pipeline with Agent SDK + CI/CD

## Core idea

The factory is **software**: a custom orchestrator (TypeScript or Python on top of the Claude Agent SDK) that executes the idea→product pipeline as deterministic code, with each stage running `claude` headless with structured outputs (validated JSON Schema), and GitHub Actions as the backbone for execution and gates.

The model proposes; **the orchestrator (code) decides and executes**. It is the strictest embodiment of the principle "the LLM never controls workflow progression".

## Architecture

```
panda-corp/
├── orchestrator/                     # the heart: TS code on @anthropic-ai/claude-agent-sdk
│   ├── pipeline.ts                   # state machine: intake→research→spec→plan→build→review→release
│   ├── stages/*.ts                   # each stage: prompt + json-schema + validator + bounded retry
│   ├── policies/                     # decision registry as code (auto-defaults, escalation)
│   └── audit/                        # immutable log of every agent decision
├── factory/ (constitucion, plantillas, portfolio)   # same as in A
└── .github/workflows/               # CI for the factory itself

proyecto-x/  (its own GitHub repo, created by the orchestrator)
├── .github/workflows/quality.yml    # the 5 gates: lint+types / coverage+mutation / SAST+secrets / review / e2e
├── docs/ (idea, investigacion, spec, plan, adr)
└── src/
```

**Flow:**

1. `pnpm factory new "Funko tracker"` (or a GitHub issue with the `idea` label) triggers the pipeline.
2. Each stage runs the SDK's `query()` with an output schema; if validation fails, it retries with the error injected (max. 3) and then escalates.
3. Go/No-Go: the orchestrator computes the scoring; if it passes the threshold and involves no spending, it continues on its own; if not, it opens an approval issue and waits (asynchronous H1 gate).
4. The orchestrator creates the project repo via the GitHub API from the stack template, configures branch protection and secrets.
5. Implementation: GitHub Actions jobs (or custom runners in Docker with `bypassPermissions` + sandbox) run headless sessions per task; each task = 1 PR; CI is the gate, not the agent.
6. Production release: GitHub environment with required reviewer = you (GitHub's native H2 gate).

## Advantages

- **Maximum determinism and auditability**: every phase transition is testable code; the audit trail is complete by construction.
- **True unattended operation**: it runs in CI/cloud without your machine; the triggers are issues, webhooks, crons.
- Truly model-agnostic: changing the model means changing a parameter; the schemas and validators don't change.
- The human gates use GitHub's native mechanisms (environments, required reviewers) — impossible for the agent to skip.

## Disadvantages / risks

- **High initial effort**: you're building a product (the orchestrator) before building products. Weeks, not days.
- Maintenance: the orchestrator is your own code that ages; the SDK evolves quickly.
- Cost: headless/SDK is billed as API (a separate pool from the subscription since 2026-06-15) — iteratively developing the orchestrator itself consumes credit.
- Risk of over-engineering for a portfolio that doesn't yet exist: it optimizes a pipeline you haven't yet seen fail.

## When to choose it

When the volume justifies it: many products in parallel, a need for 24/7 operation without intervention, or when Proposal A falls short on determinism. **Natural path: start with A and migrate to B the stages that become repetitive and stable** (A generates the prompts, checklists, and templates that B then freezes into code).

## Estimated startup effort

| Phase | Work | Approx. time |
|---|---|---|
| 1 | State machine + 3 stages (intake/research/spec) with schemas | 1-2 weeks |
| 2 | Repo creation + templates + 5-gate CI | 1 week |
| 3 | Implementation loop with sandboxed runners | 1-2 weeks |
| 4 | Pilot + hardening | 2+ weeks |
