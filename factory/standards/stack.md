# Recommended stack (default suggestion)

> ⚠️ This is a **suggestion**, not an imposition. The `architect` agent proposes the stack in the **blueprint**, evaluates whether there are better technologies for THAT project, and **the owner approves it** there (lightweight human gate, recorded as an ADR). **The latest stable versions** of whatever is chosen are always used.

## Starting point by project type

### Full-stack web (default)
- **Next.js** (App Router) + **React** + **TypeScript** (strict)
- **Tailwind CSS** + custom components (`core`/`modules`); `cn()` (clsx + tailwind-merge)
- **Prisma** + **PostgreSQL** (Neon/Supabase); data layer in `queries/`
- **Better Auth** (email + OAuth)
- **next-intl** (i18n, Spanish by default)
- **Zod** (validation)
- **PostHog** (analytics) + **Sentry** (errors)
- **Cloudflare R2** (file/photo storage, S3 SDK) — bucket per app
- **Resend** (transactional email) + **Kit/ConvertKit** (marketing email / waitlist)
- **Polar** (payments, Merchant of Record — works from Peru/global) when the version charges
- **Vitest** (unit/integration) + **Playwright** (e2e)
- **Biome** — the single standard for **both formatting and linting** (replaces Prettier *and* ESLint); Tailwind class sorting via Biome `useSortedClasses`. **Do not add Prettier or ESLint** except as a documented escape hatch for a rule Biome lacks (Testing-Library-specific lint, full `eslint-plugin-next` parity) — and never re-add Prettier.
- Package manager: **npm**. Deploy: Vercel (web) / container on Railway or Fly.io (services)

> Account model, secrets (SOPS+age) and provisioning of these external services: `external-services.md`. The service stack validated in production is PandaTrack's.

### API / backend service
- TypeScript + Hono, or Python + FastAPI (depending on the case); Zod/Pydantic validation; isolated data layer.

### Data collection / scraping / notifications
- Python + FastAPI + Playwright/httpx + ARQ/Redis + PostgreSQL; responsible scraping (robots.txt, rate limiting, identifiable user-agent).

## Rules when choosing
1. By default, the above in **latest stable versions**.
2. The `architect` **can and should propose something better** if it fits (a better library, language or service) — with clear trade-offs.
3. The decision is **approved by the owner** in the blueprint and recorded as an ADR.
4. Don't mix technologies that break the durable conventions (strict typing, isolated data layer, testing).
5. Never homemade auth: use a proven solution.

## Version policy (DR-052)
- **New project / new install → always the latest stable version** (`@latest`). We don't pin to old versions out of habit.
- **An in-flight project stays on the version it was built with** — don't churn/migrate frameworks mid-build just to chase a release; upgrade deliberately, not reflexively.
- **Older / brownfield project → install only versions COMPATIBLE with the established framework major.** Before adding a dependency, check it supports that project's framework version (e.g. a Next.js 13 project must NOT get a library that requires Next 15+ — pick the latest version still compatible with Next 13). When unsure, resolve the compatible version range, don't assume `@latest`.
