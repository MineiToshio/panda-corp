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
- **ESLint + Prettier** (with `prettier-plugin-tailwindcss`)
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
