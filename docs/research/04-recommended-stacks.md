# Research: Technology stacks for AI-generated software (2025-2026)

> Reference report. Generated 2026-06-12.

## Why typed, popular ecosystems

- **94% of LLM-code compilation errors are type failures** — static typing is the primary error-detection layer for machine-written code. [GitHub Blog](https://github.blog/ai-and-ml/llms/why-ai-is-pushing-developers-toward-typed-languages/)
- LLMs are measurably and significantly better at stacks with more training corpus: **TypeScript + React + Postgres + Tailwind** and **Python**. TypeScript has been GitHub's #1 language since August 2025.
- Rule: never leave an agent a codebase without static analysis. Untyped JavaScript and unannotated Python are the two highest-risk choices.
- Deterministic scaffolds beat letting AI improvise the setup: the costliest errors happen during initialization (inconsistent aliases, conflicting versions, structure with no canonical reference).

## Pandacorp's 4 "golden paths" (proposed)

### Stack A — Full-stack web application
```
Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
tRPC or Server Actions · Drizzle ORM + PostgreSQL
Better Auth or Supabase Auth · Stripe (payments)
Vitest (unit) + Playwright (e2e) · Biome + tsconfig strict
Vercel (deploy) + GitHub Actions (CI)
Inngest/Trigger.dev (jobs) · Upstash Redis (cache/rate-limit)
Scaffold: create-t3-app / create-t3-turbo (monorepo)
```
Use case: a restaurant app (list, pick a table, order).

### Stack B — Backend API/service (TypeScript)
```
Hono (Node/Bun, 14 kB, multi-runtime, 2-3x NestJS in throughput)
Drizzle + PostgreSQL · Zod · Vitest · Biome
Railway or Fly.io · GitHub Actions
```
Use case: stateless APIs, webhooks, gateways.

### Stack C — Backend API/service (Python, ML-adjacent)
```
FastAPI (Python 3.12) + Pydantic v2 + SQLAlchemy 2.x
pytest + pytest-asyncio · mypy --strict · Ruff
Docker on Railway/Fly.io · GitHub Actions
```
Use case: ML inference APIs, data pipelines.

### Stack D — Data collection / scraping / notifications
```
Python 3.12 + FastAPI (jobs API)
Playwright async (JS pages) + httpx/parsel (static, 10-50x faster)
ARQ + Redis (asyncio queue; Celery if CPU-bound)
APScheduler/ARQ cron · PostgreSQL (JSONB) · Sentry
Residential proxies with per-domain success tracking
pytest + ruff + mypy · Docker + Railway/Fly.io
```
Use case: real-time Funko catalog (scrapers of Funko.com, stores, listings + notifications).

## Default infrastructure (solo operator + agents)

| Layer | Default | Alternative | Note |
|---|---|---|---|
| Frontend/web | Vercel | — | Free Hobby; $20/mo Pro |
| Workers/services | Railway | Fly.io | Persistent containers |
| Postgres | Supabase (full-stack prod) | Neon (per-PR branching, scale-to-zero) | Neon ideal for ephemeral agent environments |
| Auth | Better Auth (TS, $0, your own data) | Supabase Auth / Clerk (MVP only) | Clerk expensive at scale (~$1.8k/mo at 100K MAU). **Never roll your own auth** |
| Payments | Stripe | — | The undisputed standard |
| Cache/rate-limit | Upstash Redis | Self-hosted Redis | TTL mandatory on every key |
| Email | Resend | — | |
| Errors | Sentry | — | |
| CI/CD | GitHub Actions | — | lint+typecheck+tests in parallel; e2e on PR |

Reference monthly cost: $0 at launch → ~$125-150/mo with traction.

## Monorepo vs separate repos

- **pnpm monorepo** when web+API share types (tRPC, Zod, Drizzle schema) or web+mobile share logic. Layout: `apps/web`, `apps/api`, `packages/db`, `packages/shared`, `packages/ui`. Turborepo only from 3+ apps onward.
- **Separate repos** at polyglot boundaries (Python scraper vs TS web) or independent deploy cadences.
- Rules for agents: `packages/shared` is the single source of types/validators; one component per file with a colocated test; folders per feature; backend in 3 layers (Routes → Services → Repositories).

## Conventions that help agents

- **TS**: Biome (10-100x faster than ESLint+Prettier, a single binary); tsconfig with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; absolute aliases `@/` (deep relative imports `../../..` forbidden).
- **Python**: Ruff (replaces flake8+isort+Black+bandit) + mypy strict.
- **Commits**: Conventional Commits with a mandatory scope + semantic-release (automatic changelog and versioning).
- **AGENTS.md** (100-250 lines) per repo as a contract: stack with exact versions, forbidden patterns (`any`, `@ts-ignore`, deep relative imports), verification checklist before finishing, migration rules (never edit applied ones, always `down`), commit format, required evidence (test output, Playwright traces).
- **E2E**: only 5-20 critical flows; `data-testid` selectors (never CSS classes); traces as evidence in CI.
- **Quality MCP**: SonarQube/Codacy/Semgrep/Biome expose MCP servers so the agent can validate its own output before presenting it.

Sources: [Typed languages](https://github.blog/ai-and-ml/llms/why-ai-is-pushing-developers-toward-typed-languages/) · [Fullstack+AI playbook](https://dev.to/truongpx396/building-production-grade-fullstack-products-with-ai-coding-agents-a-practical-playbook-2idd) · [Hono vs NestJS vs Fastify](https://encore.dev/articles/nestjs-vs-fastify-vs-hono) · [Neon vs Supabase](https://www.bytebase.com/blog/neon-vs-supabase/) · [Auth compared](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk) · [ARQ vs Celery](https://leapcell.io/blog/celery-versus-arq-choosing-the-right-task-queue-for-python-applications) · [Scraping architecture](https://sociavault.com/blog/scraping-infrastructure-architecture-2025) · [create-t3-turbo](https://github.com/t3-oss/create-t3-turbo) · [Biome](https://github.com/biomejs/biome) · [semantic-release](https://github.com/semantic-release/semantic-release)
