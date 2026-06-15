# Stack A — Web app full-stack (Next.js) · sugerencia por defecto

Guía de instalación para `/pandacorp:blueprint`, caso web full-stack. Es el **punto de partida recomendado** (`fabrica/estandares/stack.md`), NO una imposición: el `architect` puede proponer alternativas mejores y el dueño aprueba en el blueprint. **Usar siempre últimas versiones estables** (los comandos `@latest` ya lo hacen). Stack recomendado: Next.js + React + TypeScript + Tailwind + **Prisma** + **Better Auth** + **next-intl** + **PostHog** + **Sentry** + Vitest + Playwright + **ESLint/Prettier** + **npm**, estructura `src/` con data layer en `queries/`.

## Instalación

```bash
# Scaffolder oficial (elegir según blueprint: tRPC u opciones por defecto)
pnpm create t3-app@latest . --noGit   # ya hay git del scaffold Pandacorp
# Opciones: TypeScript, Tailwind, Drizzle, App Router; auth según blueprint (Better Auth post-install o NextAuth)
```

## Configuración estándar Pandacorp (después del scaffolder)

1. **tsconfig**: agregar `"noUncheckedIndexedAccess": true` (strict ya viene).
2. **Biome** (reemplaza ESLint+Prettier si el blueprint no exige plugins ESLint específicos):
   ```bash
   pnpm add -D -E @biomejs/biome && pnpm biome init
   ```
3. **Testing**: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test`
4. **shadcn/ui**: `pnpm dlx shadcn@latest init` — usar el preset/tokens de `docs/diseno/design-tokens.json`.
5. **BD**: **dev → Postgres en Docker** (ver abajo); **staging/prod → managed** (Neon/Supabase). Connection string solo en `.env` (DR-021).
6. **Estructura**: features en carpetas (`src/features/<feature>/`), shared en `src/lib/`, componentes un archivo + test colocado.

## Base de datos en dev (Docker) + worktrees (DR-021/022/023)

`docker-compose.yml` con Postgres (y Redis si aplica); el puerto sale del `.env` (convención de puertos de `fabrica/estandares/infra.md`). El agente lo levanta con `docker compose up -d` antes de los tests.

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

**`.worktreeinclude`** en la raíz (copia config no versionada a cada worktree nuevo, para probar un snapshot sin reconfigurar):

```
.env
.env.local
```

Probar el último verde sin parar al agente: `git worktree add ../<proyecto>-review <last_green_sha>` → en esa carpeta, `pnpm install` (rápido con el store de pnpm), ajusta `DB_PORT` en su `.env`, `docker compose -p <proyecto>-review up -d`, y corre el dev server. Una sola carpeta de review, refrescada al último verde.

## `.pandacorp/verify.sh`

```bash
#!/bin/bash
set -e
pnpm biome check . 2>/dev/null || pnpm lint
pnpm tsc --noEmit
pnpm vitest run --reporter=dot
```

## CI (`.github/workflows/ci.yml`)

Jobs en paralelo sobre PR: `lint` (biome check), `typecheck` (tsc --noEmit), `test` (vitest run). E2E (`playwright test`) en PRs hacia main. Cache de pnpm.

## Deploy

Vercel (hobby para empezar). Variables de entorno vía dashboard de Vercel, nunca en el repo.
