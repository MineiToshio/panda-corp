# Stack A — Full-stack web app (Next.js) · default suggestion

Installation guide for `/pandacorp:blueprint`, full-stack web case. It's the **recommended starting point** (`factory/standards/stack.md`), NOT a mandate: the `architect` can propose better alternatives and the owner approves in the blueprint. **Always use the latest stable versions** (the `@latest` commands already do this). Recommended stack: Next.js + React + TypeScript + Tailwind + **Prisma** + **Better Auth** + **next-intl** + **PostHog** + **Sentry** + Vitest + Playwright + **ESLint/Prettier** + **npm**, `src/` structure with the data layer in `queries/`.

## Installation

```bash
# Official scaffolder (choose based on the blueprint: tRPC or default options)
pnpm create t3-app@latest . --noGit   # the Pandacorp scaffold already has git
# Options: TypeScript, Tailwind, Drizzle, App Router; auth per the blueprint (Better Auth post-install or NextAuth)
```

## Standard Pandacorp configuration (after the scaffolder)

1. **tsconfig**: add `"noUncheckedIndexedAccess": true` (strict already comes).
2. **Biome** (replaces ESLint+Prettier if the blueprint doesn't require specific ESLint plugins):
   ```bash
   pnpm add -D -E @biomejs/biome && pnpm biome init
   ```
3. **Testing**: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test`
4. **shadcn/ui**: `pnpm dlx shadcn@latest init` — use the preset/tokens from `docs/design/design-tokens.json`.
5. **DB**: **dev → Postgres in Docker** (see below); **staging/prod → managed** (Neon/Supabase). Connection string only in `.env` (DR-021).
6. **Structure**: features in folders (`src/features/<feature>/`), shared in `src/lib/`, components one file + colocated test.

## Database in dev (Docker) + worktrees (DR-021/022/023)

`docker-compose.yml` with Postgres (and Redis if applicable); the port comes from the `.env` (port convention in `factory/standards/infra.md`). The agent brings it up with `docker compose up -d` before the tests.

```yaml
# docker-compose.yml (dev)
services:
  db:
    image: postgres:17
    ports: ["${DB_PORT:-5432}:5432"]
    environment: { POSTGRES_PASSWORD: dev, POSTGRES_DB: ${PROJECT_DB:-app} }
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes: { pgdata: {} }
```

**`.worktreeinclude`** at the root (copies unversioned config to each new worktree, to test a snapshot without reconfiguring):

```
.env
.env.local
```

Test the last green without stopping the agent: `git worktree add ../<project>-review <last_green_sha>` → in that folder, `pnpm install` (fast with the pnpm store), adjust `DB_PORT` in its `.env`, `docker compose -p <project>-review up -d`, and run the dev server. A single review folder, refreshed to the last green.

## `.pandacorp/verify.sh`

```bash
#!/bin/bash
set -e
pnpm biome check . 2>/dev/null || pnpm lint
pnpm tsc --noEmit
pnpm vitest run --reporter=dot
```

## CI (`.github/workflows/ci.yml`)

Parallel jobs on PR: `lint` (biome check), `typecheck` (tsc --noEmit), `test` (vitest run). E2E (`playwright test`) on PRs to main. pnpm cache.

## Deploy

Vercel (hobby to start). Environment variables via the Vercel dashboard, never in the repo.
