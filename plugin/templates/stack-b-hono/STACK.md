# Stack B — Backend API/service (TypeScript + Hono)

Installation guide for `/pandacorp:blueprint`. Use case: stateless APIs, webhooks, gateways, edge services.

## Installation

```bash
pnpm create hono@latest . # template: nodejs (or cloudflare-workers per the blueprint)
pnpm add zod drizzle-orm postgres
pnpm add -D -E @biomejs/biome
pnpm add -D vitest drizzle-kit typescript@latest
pnpm biome init
```

## Standard Pandacorp configuration

1. **tsconfig**: `"strict": true`, `"noUncheckedIndexedAccess": true`.
2. **Validation**: ALL endpoint input with Zod (`@hono/zod-validator`). Shared schemas in `src/schemas/`.
3. **3-layer structure**: `src/routes/` → `src/services/` → `src/repositories/` (no queries in routes).
4. **DB**: Drizzle + Postgres (Neon/Supabase). Migrations with drizzle-kit, always with down.
5. **Observability**: structured logger (hono/logger) + Sentry.

## `.pandacorp/verify.sh`

```bash
#!/bin/bash
set -e
pnpm biome check .
pnpm tsc --noEmit
pnpm vitest run --reporter=dot
```

## CI

GitHub Actions: lint + typecheck + test on PR. Deploy: Railway or Fly.io (Dockerfile) / Cloudflare Workers if edge.
