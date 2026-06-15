# Pandacorp standards

Engineering standards that the factory injects into every project (via the scaffold's `AGENTS.md`/`CLAUDE.md` and the plugin's agents).

## Two levels (important)

1. **Durable conventions — MANDATORY and identical across all projects**: structure, naming, quality, patterns, testing. They live here and are not negotiated per project.
2. **Technology stack — DEFAULT SUGGESTION**: there is a recommended stack ([stack.md](stack.md)), always on the **latest stable versions**. It is NOT mandatory: the `architect` agent **proposes it in the blueprint**, may suggest better technologies if they fit the project, and **the owner approves it** there (lightweight human gate, recorded as an ADR).

## Categories (8 domains) + index

| Domain | Standards |
|---|---|
| **Programming / Conventions** | [conventions.md](conventions.md) · [api-design.md](api-design.md) |
| **Architecture / Structure** | [structure.md](structure.md) · [patterns.md](patterns.md) |
| **Design / Design system** | [patterns.md](patterns.md) (tokens, theme, a11y); the design system is generated per project in `/pandacorp:design` |
| **Technology / Stack** | [stack.md](stack.md) (golden paths A/B/C/D) |
| **Quality / Testing** | [quality.md](quality.md) · [performance.md](performance.md) |
| **Security** | [web-security.md](web-security.md) (+ constitution §12, DR-017, `security-auditor` agent) |
| **Operation / Observability** | [infra.md](infra.md) (local dev) · [observability.md](observability.md) (production) · [external-services.md](external-services.md) (accounts, secrets, payments, provisioning — DR-035..038) |
| **Data / Privacy** | [privacy.md](privacy.md) |
| **Product / Documentation** | [documentation.md](documentation.md) (canonical doc + decision log) · [seo-i18n.md](seo-i18n.md) (+ living docs: constitution §20, DR-018) |

## Two cross-cutting axes (by rule, not by file)

- **Severity (RFC 2119)**: each rule is `MUST` (mandatory — violating it is a hard failure), `SHOULD` (recommended — relaxable by recording an ADR) or `MAY` (optional). The agent **only escalates to the owner if it is going to break a `MUST`**; a `SHOULD` it decides with an ADR. The entire stack is `SHOULD` (golden path).
- **Enforcement (how it is verified)**: `lint` · `CI gate` · `checklist` · `human gate / deny rule`. Makes visible what a script validates (automatic green/red) vs. what is the owner's decision (rule 4: the model never marks its own checks).

## Shape of a standard ("executable standard")

Each file separates, without mixing: **Rule** (taxative, what gets injected into the agent) · **How it is verified** (binary check pluggable into `verify.sh`/CI) · **Why** (rationale/trade-offs, for humans and ADRs). The goal is that every rule has a verifier, not just prose.

## Two levels of obligation

1. **Durable conventions — MANDATORY** and identical in every project (structure, naming, quality, patterns, testing, security, privacy…).
2. **Technology stack — SUGGESTION** by default ([stack.md](stack.md), latest stable versions): the `architect` proposes it in the blueprint, may suggest better ones, and **the owner approves** (lightweight gate, ADR).

The structure/patterns conventions are written for the default web stack (TypeScript/Next.js). For other stacks (Python/scraping) the **spirit** applies (separated layers, isolated data layer, colocated tests, strict typing), adapted to the language. To add a new standard, rule or skill: `/pandacorp:learn`.
