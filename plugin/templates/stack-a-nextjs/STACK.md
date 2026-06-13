# Stack A — Web app full-stack (Next.js) · sugerencia por defecto

Guía de instalación para `/pandacorp:blueprint`, caso web full-stack. Es el **punto de partida recomendado** (`fabrica/estandares/stack.md`), NO una imposición: el `architect` puede proponer alternativas mejores y Sergio aprueba en el blueprint. **Usar siempre últimas versiones estables** (los comandos `@latest` ya lo hacen). Alineado a los estándares de PandaTrack: Next.js + React + TypeScript + Tailwind + **Prisma** + **Better Auth** + **next-intl** + **PostHog** + **Sentry** + Vitest + Playwright + **ESLint/Prettier** + **npm**, estructura `src/` con data layer en `queries/`.

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
5. **BD**: Postgres en Supabase (prod) / Neon o local (dev). Connection string solo en `.env`.
6. **Estructura**: features en carpetas (`src/features/<feature>/`), shared en `src/lib/`, componentes un archivo + test colocado.

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
