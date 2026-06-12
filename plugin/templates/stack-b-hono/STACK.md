# Stack B — API/servicio backend (TypeScript + Hono)

Guía de instalación para `/pandacorp:blueprint`. Caso de uso: APIs stateless, webhooks, gateways, servicios edge.

## Instalación

```bash
pnpm create hono@latest . # template: nodejs (o cloudflare-workers según blueprint)
pnpm add zod drizzle-orm postgres
pnpm add -D -E @biomejs/biome
pnpm add -D vitest drizzle-kit typescript@latest
pnpm biome init
```

## Configuración estándar Pandacorp

1. **tsconfig**: `"strict": true`, `"noUncheckedIndexedAccess": true`.
2. **Validación**: TODO input de endpoint con Zod (`@hono/zod-validator`). Schemas compartidos en `src/schemas/`.
3. **Estructura 3 capas**: `src/routes/` → `src/services/` → `src/repositories/` (sin queries en routes).
4. **BD**: Drizzle + Postgres (Neon/Supabase). Migraciones con drizzle-kit, siempre con down.
5. **Observabilidad**: logger estructurado (hono/logger) + Sentry.

## `.pandacorp/verify.sh`

```bash
#!/bin/bash
set -e
pnpm biome check .
pnpm tsc --noEmit
pnpm vitest run --reporter=dot
```

## CI

GitHub Actions: lint + typecheck + test en PR. Deploy: Railway o Fly.io (Dockerfile) / Cloudflare Workers si edge.
