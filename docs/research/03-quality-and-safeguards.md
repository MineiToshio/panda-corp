# Research: Quality and safeguards for autonomous development (2025-2026)

> Reference report. Generated 2026-06-12.

## 1. The 5 quality gates (every AI PR must pass them)

1. **Static analysis** (every commit, zero tolerance): lint (ESLint/Biome, Ruff), formatting (Prettier/Black), types (TypeScript strict, mypy --strict). 94% of LLM-code compilation errors are type failures — the type system is the first detection layer.
2. **Coverage + mutation testing** (per PR): ≥80% on changed lines (not the repo average). Mutation testing (Stryker for TS, MutPy for Python) on critical paths — the only reliable signal that the asserts catch real defects. Property-based testing (Hypothesis, fast-check) for core logic.
3. **Security scanning** (zero high findings): SAST (Semgrep, CodeQL, SonarQube), dependencies (Snyk, Socket.dev, Dependabot), secrets (Gitleaks, TruffleHog — pre-commit AND CI, because agents sometimes skip pre-commit).
4. **Code review**: reviewer agents as a first pass (multi-lens panel), a human for PRs of architectural impact. Mitigate LLM-as-judge bias: predefined rubrics + combine with deterministic signals (tests, mutation score).
5. **Post-merge integration**: integration suite in staging before production; synthetic monitoring; performance regression gate.

## 2. TDD as governance (key pattern)

- **RED**: the agent generates failing tests, aligned with the spec's acceptance criteria.
- **GREEN**: minimal implementation; at most 3 repair attempts per subtask before escalating.
- **REFACTOR**: only when everything passes.
- **Orchestration rule**: the orchestrator/CI (not the LLM) has exclusive authority over workflow progression. The model proposes; the system validates and decides. The model cannot check off its own checkboxes.

## 3. Machine-verifiable specs: EARS notation

| Pattern | Template |
|---|---|
| Ubiquitous | THE system SHALL [behavior] |
| Event-driven | WHEN [trigger] THE system SHALL [response] |
| State-driven | WHILE [state] THE system SHALL [behavior] |
| Unwanted behavior | IF [condition] THEN THE system SHALL [response] |
| Optional feature | WHERE [feature enabled] THE system SHALL [behavior] |

Each EARS statement is converted into an executable test (BDD: Given/When/Then, Playwright). Lint rule: a spec change without a corresponding test change fails CI.

## 4. Decision classification (minimize the human)

| Tier | Action type | Human? |
|---|---|---|
| 1 | Read-only / analysis | No (log only) |
| 2 | Reversible internal changes | No (log + async review) |
| 3 | External integrations | Yes, asynchronous (approval queue) |
| 4 | Irreversible / high risk | Yes, synchronous (blocks) |

**The 5 categories that ALWAYS require a synchronous human**: (1) production deploy, (2) external communications (emails, public webhooks), (3) financial transactions, (4) data deletion, (5) privilege/access changes.

**Enforcement principle**: approval logic is applied at the execution layer (hooks, CI, branch protection), not negotiated with the model at runtime.

**Decision register**: a versioned document that lists recurring decision types with pre-approved defaults, e.g.:

```yaml
- id: DR-001
  pattern: "add an npm/pip dependency"
  default: "auto-approve if no known CVEs, maintained in the last 12 months, permissive license"
  requires_human: false
- id: DR-002
  pattern: "DB schema migration in production"
  default: "block; validate in staging + human approval"
  requires_human: true
  timeout_hours: 24
```

Expired timeout → escalate to kill-switch or a second approver, **never auto-approve**.

## 5. Technical safeguards

- **Protected branches**: agents commit only to feature branches; merge requires green CI. A technical restriction, not a guideline.
- **Conventional Commits** (commitlint) → automatic changelog and versioning (semantic-release / release-please).
- **ADRs** in `docs/adr/` + **AgDRs** (Agent Decision Records: which agent, which model, which trigger, the trade-off Y-statement) for traceability of agent decisions. [AgDR](https://github.com/me2resh/agent-decision-record)
- **Auditing**: an immutable log per relevant action (agent, model, prompt, tools, rationale, timestamp).
- **Secrets**: never pass them to the agent; ephemeral injection per environment; detection in pre-commit and CI; rotation at session close.
- **Supply chain**: dependencies pinned with lockfiles; block installation from unapproved registries; beware of LLM-hallucinated packages; pin and version MCP server definitions (rug-pull defense).
- **OWASP Top 10 Agentic (ASI, Dec 2025)**: goal hijack, tool misuse, identity abuse, agentic supply chain, unexpected execution, memory poisoning, insecure inter-agent communication, cascade failures, trust exploitation, rogue agents. [OWASP](https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications-the-benchmark-for-agentic-security-in-the-age-of-autonomous-ai/)

## 6. Model-independent robustness

> "A weak model with good orchestration usually beats a strong model with bad orchestration."

1. **Structured output contracts**: JSON/YAML validated against a schema (Zod/Pydantic) before acting; schema failure = retry.
2. **Atomic decomposition**: independently verifiable tasks; a task passes by its criteria, not by self-report.
3. **Unconditional verification loops**: propose → deterministic verifier → pass/retry with failure context (max N) → escalate.
4. **Bounded retries with failure signatures**: identical failure repeated = terminate and escalate, don't loop.
5. **Checklists executed by CI**, not by the model.
6. **Cross-model consistency test** (for critical paths): same spec by 2 models; behavioral divergence = ambiguous spec, harden the EARS.

## Minimum governance stack

EARS spec + versioned constitution → TDD-first with the orchestrator owning progression → lint+types+SAST+secrets per commit → coverage and mutation per PR → ephemeral identity and credentials per agent → audit trail → decision tiers with 5 blocking categories → conventional commits + ADR/AgDR → deterministic verification, never self-asserted.

Main sources: [Quality gates](https://www.motomtech.com/blog-post/ai-generated-code-quality-gates/) · [TDD governance](https://arxiv.org/html/2604.26615v1) · [PBT with Claude](https://red.anthropic.com/2026/property-based-testing/) · [HITL escalation](https://www.digitalapplied.com/blog/human-in-the-loop-escalation-design-ai-agents-2026) · [Agent security](https://lushbinary.com/blog/ai-agent-security-autonomous-coding-production-guide/) · [LLM-as-judge](https://labelyourdata.com/articles/llm-as-a-judge) · [SAST 2026](https://www.ox.security/blog/static-application-security-sast-tools/)
