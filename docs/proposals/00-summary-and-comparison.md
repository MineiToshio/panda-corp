# Pandacorp — Proposals for the 100% AI software factory

> Generated 2026-06-12 from 4 research efforts (see [docs/research/](../research/)).

## The objective

A system where you contribute **ideas or problems** ("app to order from the table", "One Piece Funko tracker") and the factory researches them, turns them into specifications, decides the architecture, creates a separate project, and implements it with verified quality — with minimal and explicit human intervention.

## What the evidence says (research synthesis)

1. **Spec-driven is the consensus**: the systems that work verify artifacts (PRD, plan, tasks), not conversations. The spec is the source of truth; code is generated and validated against it.
2. **The harness matters as much as the model**: the same model varies ±15 points depending on the orchestration. Investing in process pays off independently of the model — exactly your requirement of "working well with any model".
3. **Prompts are suggestions; hooks/CI are contracts**: quality without human review is sustained by deterministic gates (lint, types, tests, mutation, SAST) that the model cannot self-approve. Agents fabricate test results 17-22% of the time — never trust self-reporting.
4. **Only 5 decisions always require a human**: production, money, data deletion, external communications, access. The rest is codified in a decision registry with defaults; each human escalation becomes a new rule.
5. **Typed, popular stacks**: 94% of LLM compilation errors are type errors. TypeScript/Next.js and Python/FastAPI with deterministic scaffolds are the right golden paths.

## The three proposals

| | A — Native Claude Code factory ⭐ | B — Programmatic pipeline (SDK) | C — Existing frameworks |
|---|---|---|---|
| Essence | Skills + subagents + hooks + distributable plugin | Custom orchestrator in code + CI/CD as the gate | Spec Kit + BMAD roles with a thin custom layer |
| Startup effort | Days | Weeks | Hours |
| Degree of autonomy | High (routines, worktrees, hooks) | Maximum (24/7 in the cloud, unattended) | Medium (designed with a human at every phase) |
| Determinism | Medium-high (deterministic hooks, skill-guided flow) | Maximum (state machine in code) | Low-medium |
| Maintenance | Low (versioned markdown) | High (custom code + an evolving SDK) | Delegated, but customizing = fork |
| Multi-project | User-level plugin + scaffold | GitHub API + templates | Not solved (would have to be added) |
| Main risk | Tied to Claude Code | Premature over-engineering; API cost | Fighting against the grain of the framework |
| Detail | [Proposal A](01-proposal-a-native-factory.md) | [Proposal B](02-proposal-b-programmatic-pipeline.md) | [Proposal C](03-proposal-c-existing-frameworks.md) |

The four shared elements (10-phase pipeline, human decision model, agent roles, safeguards, and golden paths) are in [Common elements](04-common-elements.md) — they apply to any proposal.

## Recommendation

**Start with Proposal A**, stealing the best templates from C (BMAD role prompts, Spec Kit spec formats), and **evolve toward B in stages**: when a pipeline phase becomes repetitive and stable in A (e.g., the scaffold or the verification), freeze it as code/CI in the style of B. Reasons:

1. Your dominant requirement is **speed to validate the system with real cases** (Funkos, restaurants) — A delivers a working pipeline in days.
2. A produces, as a byproduct, everything B would need afterward (refined prompts, checklists, templates, decision registry). B first would mean betting weeks on a design without feedback.
3. The critical safeguards (hooks, branch protection, 5-gate CI) are identical in A and B — no security is lost by starting simple.

## What to decide now (this project's own H1 gate 🙂)

1. **Proposal A as the starting point?** (or do you prefer B or C)
2. **Are the two proposed human gates enough?** (H1 go/no-go of ideas, H2 production/money/external)
3. **Do you approve the 4 golden paths** and the default infrastructure (Vercel/Railway/Supabase/GitHub)?
4. **Language of the artifacts?** (I propose: product documents in Spanish, code and commits in English)
5. **First pilot?** (I propose the Funko tracker: it exercises real-time source research, scraping, notifications, and web — it covers stacks D + A)

With those answers, the next step is to build phase 1 of Proposal A: constitution, the factory's CLAUDE.md, decision registry, and the first agents/skills.
