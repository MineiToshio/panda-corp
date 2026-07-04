# Pandacorp standards

Engineering standards that the factory injects into every project. These files are the **canonical, long-form** standards (rule + how-verified + why + severity); their **project-injectable operative form** is the rule library at `plugin/templates/rules/`, copied as files into each project's `docs/rules/` (see *How standards reach projects* below).

## How standards reach projects (the rule library + propagation — DR-051)

A standard that isn't injected is dead on arrival (Mission Control once violated `core/modules` even though it was written in the embed). So:

- **Rules ship as FILES, selectively.** `plugin/templates/rules/` holds the portable, tech-bucketed rules (each declares `applies_when`). `scaffold` copies the `always` files into the project's `docs/rules/` at birth; `blueprint` adds the tech-gated files matching the **approved** stack; `adopt` injects the set matching a brownfield project's stack. They live in `docs/` (not `.pandacorp/`) so any agent follows them whether or not the project uses Pandacorp. `CLAUDE.md` loads them via `@docs/rules/README.md` (recursive `@import`); `AGENTS.md` points there.
- **Propagation is deterministic.** The plugin's rule files are the source of truth; `/pandacorp:upgrade` re-copies them verbatim into existing projects, and bumping `templates/OVERLAY_VERSION` on any rule change is the trigger (DR-048 auto-upgrade loop).
- **The contract (enforced in `/pandacorp:learn`):** adding/changing a project-facing standard MUST, in the same change, (1) update the matching `plugin/templates/rules/` file with the right `applies_when`, (2) wire any hard-enforceable part into the stack's lint/`verify.sh` so violations FAIL the gate, and (3) bump `OVERLAY_VERSION`. Three enforcement layers: **presence** (the file, read by every agent) + **propagation** (upgrade + OVERLAY_VERSION) + **hard gate** (lint/CI). Factory-internal-only standards (build orchestration, factory ops) don't ship → no rule-library change, stated explicitly.

## Two levels (important)

1. **Durable conventions — MANDATORY and identical across all projects**: structure, naming, quality, patterns, testing. They live here and are not negotiated per project.
2. **Technology stack — DEFAULT SUGGESTION**: there is a recommended stack ([stack.md](stack.md)), always on the **latest stable versions**. It is NOT mandatory: the `architect` agent **proposes it in the blueprint**, may suggest better technologies if they fit the project, and **the owner approves it** there (lightweight human gate, recorded as an ADR).

## Categories (10 domains) + index

| Domain | Standards |
|---|---|
| **Programming / Conventions** | [conventions.md](conventions.md) · [api-design.md](api-design.md) · [error-handling.md](error-handling.md) · [ai-implementation.md](ai-implementation.md) (how AI agents write code here) |
| **Architecture / Structure** | [structure.md](structure.md) · [patterns.md](patterns.md) |
| **Design / Design system** | [patterns.md](patterns.md) (tokens, theme, a11y); the design system is generated per project in `/pandacorp:design` |
| **Accessibility** | [accessibility.md](accessibility.md) (WCAG 2.2 AA, tap-target tiers, focus, motion — canonical behind `rules/accessibility.md`) |
| **Technology / Stack** | [stack.md](stack.md) (golden paths A/B/C/D) |
| **Quality / Testing** | [quality.md](quality.md) · [performance.md](performance.md) · [build-orchestration.md](build-orchestration.md) (how a build is planned/run — DR-050) |
| **Security** | [web-security.md](web-security.md) (+ constitution §12, DR-017, `security-auditor` agent) · [auth.md](auth.md) (RBAC, sessions, resource-level authz) · [dependency-lifecycle.md](dependency-lifecycle.md) (update cadence, audit, licenses) |
| **Operation / Observability** | [infra.md](infra.md) (local dev, backup/restore, incidents) · [observability.md](observability.md) (production) · [resilience.md](resilience.md) (timeouts, retries, bulkheads) · [background-jobs.md](background-jobs.md) · [external-services.md](external-services.md) (accounts, secrets, payments, provisioning — DR-035..038) |
| **Data / Privacy** | [privacy.md](privacy.md) · [data-modeling.md](data-modeling.md) (entities, deletion policy, N+1, seeds) |
| **Product / Documentation** | [documentation.md](documentation.md) (canonical doc + decision log) · [feature-flags.md](feature-flags.md) (no flags at MVP; PostHog when earned) · [seo-i18n.md](seo-i18n.md) (+ living docs: constitution §20, DR-018) |
| **Factory operation / Portability** | [agent-portability.md](agent-portability.md) (operate the factory from any runtime: capability matrix, model tiers, tool translation, attended build loop — DR-113) |

## Two cross-cutting axes (by rule, not by file)

- **Severity (RFC 2119)**: each rule is `MUST` (mandatory — violating it is a hard failure), `SHOULD` (recommended — relaxable by recording an ADR) or `MAY` (optional). The agent **only escalates to the owner if it is going to break a `MUST`**; a `SHOULD` it decides with an ADR. The entire stack is `SHOULD` (golden path).
- **Enforcement (how it is verified)**: `lint` · `CI gate` · `checklist` · `human gate / deny rule`. Makes visible what a script validates (automatic green/red) vs. what is the owner's decision (rule 4: the model never marks its own checks).

## Shape of a standard ("executable standard") — the template

Every standard file follows this shape (validated by `check-standards.sh`, see below):

1. **Preamble** (first content line, blockquote): `> Domain: X · Severity: MUST|SHOULD|MAY (scope) · Enforcement: lint | CI gate | checklist | human gate`. Factory-internal process standards (build orchestration, design process) carry the preamble too, marked `factory-internal — not injected`.
2. **Rule** (one or more `## Rule — <topic>` sections): taxative, imperative bullets — what gets injected into the agent.
3. **How it is verified**: every bullet NAMES its concrete check — a Biome rule, a `verify.sh` gate, an e2e spec, a hook, a skill's checklist step, a human gate — or is explicitly tagged **`review-only`** (= known weak point, a candidate to wire). "It is verified" without a named mechanism is not allowed: that is how promise-without-mechanism rules slip in.
4. **Why**: 1–3 lines of rationale/trade-offs, for humans and ADRs.
5. **Example** *(optional)*: one short good/bad pair where it clarifies more than prose — agents follow examples better than paragraphs.
6. **Exceptions** *(optional)*: when deviating is legitimate and how it is recorded (ADR).

Playbook-style standards (`external-services.md`) keep their procedural body but still carry the preamble and a "How it is verified" section. The **rule registry** ([rule-registry.md](rule-registry.md)) indexes every rule with its enforcement status (`wired` / `manual` / `aspirational`) — the catalog's health metric is the % of rules with a named automated check; every `aspirational` MUST is a defect to burn down.

The structure/patterns conventions are written for the default web stack (TypeScript/Next.js). For other stacks (Python/scraping) the **spirit** applies (separated layers, isolated data layer, colocated tests, strict typing), adapted to the language. To add a new standard, rule or skill: `/pandacorp:learn` (which enforces the DR-051 propagation contract and a registry row for every new rule).
