# Recommended stack (default suggestion)

> Domain: Technology/Stack · Severity: **SHOULD** (the whole stack is golden-path; deviating = ADR) · Enforcement: human gate (owner approves the stack in the blueprint) + toolchain conformance check on `/pandacorp:upgrade`. See DR-030/DR-052/DR-096.

> ⚠️ This is a **suggestion**, not an imposition. The `architect` agent proposes the stack in the **blueprint**, evaluates whether there are better technologies for THAT project, and **the owner approves it** there (lightweight human gate, recorded as an ADR). **The latest stable versions** of whatever is chosen are always used.

## Starting point by project type

### Full-stack web (default) — golden path A
- **Next.js** (App Router) + **React** + **TypeScript** (strict)
- **Tailwind CSS** + custom components (`core`/`modules`); `cn()` (clsx + tailwind-merge)
- **Prisma** + **PostgreSQL** (Neon — Supabase was evaluated and rejected, see `external-services.md`); data layer in `queries/`
- **Better Auth** (email + OAuth)
- **next-intl** (i18n; launch locale from the market research — DR-041, never automatically Spanish)
- **Zod** (validation)
- **PostHog** (analytics) + **Sentry** (errors)
- **Cloudflare R2** (file/photo storage, S3 SDK) — bucket per app
- **Resend** (transactional email) + **Kit/ConvertKit** (marketing email / waitlist)
- **Polar** (payments, Merchant of Record — works from Peru/global) when the version charges
- **Vitest** (unit/integration) + **Playwright** (e2e)
- **Biome** — the single standard for **both formatting and linting** (replaces Prettier *and* ESLint); Tailwind class sorting via Biome `useSortedClasses`. **Do not add Prettier or ESLint** except as a documented escape hatch for a rule Biome lacks (Testing-Library-specific lint, full `eslint-plugin-next` parity) — and never re-add Prettier.
- Package manager: **pnpm** (shared content-addressable store, DR-096; the repo-wide standard). Deploy: Vercel (web) / container on Railway or Fly.io (services)

> Account model, secrets (SOPS+age) and provisioning of these external services: `external-services.md`. The service stack validated in production is PandaTrack's.

### API / backend service — golden path B (TypeScript + Hono)
For a **headless** service: webhook receivers, gateways, integrations, an API consumed by clients other than its own web UI. If the product IS a web app, its API lives in path A's route handlers — do NOT spin up a separate service for it.
- **Hono** — one codebase runs on Node, Bun, Deno, Workers and Lambda; tiny, Zod-first middleware ecosystem. (Fastify is the mature Node-only alternative the architect may propose for heavy Node-server workloads; Elysia is not the default — it means going all-in on Bun.)
- **TypeScript strict** + **Zod** at every boundary (`@hono/zod-validator`); errors per `api-design.md` (RFC 9457 `problem+json`).
- **OpenAPI derived from the Zod schemas** — `@hono/zod-openapi` (the most used/documented route; the lighter `hono-openapi` middleware is the sanctioned alternative). The spec is generated, never hand-written.
- **Drizzle + PostgreSQL** (Neon); migrations with drizzle-kit. Structure: Routes → Services → Repositories (isolated data layer).
- **Vitest** with Hono's in-process `app.request()`/`testClient` (no network in unit/integration tests).
- **Biome** (format+lint) + **pnpm**. Deploy: **container on Railway** (default) or Fly.io; Cloudflare Workers when the blueprint calls for edge.
- Install guide: `plugin/templates/stack-b-hono/STACK.md`.

### Data collection / scraping / notifications — golden path C (Python + FastAPI)
Also plain Python APIs and ML-adjacent services — the scraping machinery is an extension over the same base (old path D folded into C).
- **Python 3.12+** managed by **uv**; **ruff** (lint + format) + **mypy --strict** + **pytest** (httpx `AsyncClient` against the in-process app).
- **FastAPI** (jobs/query API; OpenAPI generated natively) + **Pydantic v2** at every boundary; **SQLAlchemy 2 + Alembic + PostgreSQL** (JSONB for semi-structured data).
- Fetch with **httpx + parsel**; **Playwright ONLY for JS-rendered pages** (httpx is 10-50× cheaper). Queue: **ARQ + Redis** (asyncio-native, stable — note: upstream is in maintenance-only mode; the architect may propose SAQ/Taskiq via ADR) + ARQ cron / APScheduler.
- **Responsible scraping (MUST)**: review robots.txt + the site's terms BEFORE scraping (documented in the blueprint); own per-domain rate limiting; identifiable user-agent; exponential backoff; never aggressively bypass anti-bot mechanisms.
- **Resilience**: idempotent jobs; dead-letter for repeated failures; per-source success-rate tracking (alert < 95%); broken selectors are THE NORM — contract tests against HTML fixtures + a production parse-failure alert.
- Deploy: Docker (API + worker as separate services) on Railway/Fly.io + Redis (Upstash) + Postgres (Neon).
- Install guide: `plugin/templates/stack-c-fastapi/STACK.md` (includes the scraping/worker extension; `stack-d-scraper/` is now a pointer to it).

## Other use cases (documented starting points — not yet production-validated)
None of these has shipped a Pandacorp project yet: each is a **starting point, not yet production-validated**. The architect proposes, the owner approves in the blueprint (ADR); the first real build should harden it into a full golden path (canonical gate template included).
- **CLI tool** — TypeScript: Node + **Commander** (args) + **@clack/prompts** (interactive), Vitest + Biome gates, published via npm. Python: **Typer** + uv + ruff/mypy. For developer/ops tooling distributed as a command.
- **Browser extension** — **WXT** (Vite-based, cross-browser MV3, actively maintained — Plasmo is in maintenance mode) + React + TypeScript; path A's lint/test discipline applies.
- **Static / content site** — **Astro** (content collections, near-zero JS, free static hosting) for landings, blogs, docs. Choose Next.js (path A) only if it will grow into an app.
- **AI-agent app** — an agent that autonomously *does work* (files, commands, APIs): **Claude Agent SDK**. AI *features* inside a web app (chat, streaming UI): **Vercel AI SDK** within path A. Both compose: Claude as the brain, the web app as the face.

## Rules when choosing
1. By default, the above in **latest stable versions**.
2. The `architect` **can and should propose something better** if it fits (a better library, language or service) — with clear trade-offs.
3. The decision is **approved by the owner** in the blueprint and recorded as an ADR.
4. Don't mix technologies that break the durable conventions (strict typing, isolated data layer, testing).
5. Never homemade auth: use a proven solution.

## How it is verified
- **Stack choice**: human gate — the `architect` proposes in the blueprint, the owner approves, recorded as an ADR (DR-030).
- **Toolchain conformance**: `/pandacorp:upgrade` reconciles `package.json` scripts/devDependencies + `tsconfig` strict with what `verify.sh` requires (DR-059).
- **Version policy**: review-only (`reviewer` + the architect's install step pins exact versions).

## Version policy (DR-052)
- **New project / new install → always the latest stable version** (`@latest`). We don't pin to old versions out of habit.
- **An in-flight project stays on the version it was built with** — don't churn/migrate frameworks mid-build just to chase a release; upgrade deliberately, not reflexively.
- **Older / brownfield project → install only versions COMPATIBLE with the established framework major.** Before adding a dependency, check it supports that project's framework version (e.g. a Next.js 13 project must NOT get a library that requires Next 15+ — pick the latest version still compatible with Next 13). When unsure, resolve the compatible version range, don't assume `@latest`.
