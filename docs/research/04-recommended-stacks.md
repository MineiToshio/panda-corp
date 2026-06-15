# Investigación: Stacks tecnológicos para software generado por IA (2025-2026)

> Informe de referencia. Generado 2026-06-12.

## Por qué ecosistemas tipados y populares

- El **94% de los errores de compilación de código LLM son fallos de tipos** — el tipado estático es la capa primaria de detección de errores para código escrito por máquinas. [GitHub Blog](https://github.blog/ai-and-ml/llms/why-ai-is-pushing-developers-toward-typed-languages/)
- Los LLMs son medible y significativamente mejores en stacks con más corpus de entrenamiento: **TypeScript + React + Postgres + Tailwind** y **Python**. TypeScript es el lenguaje #1 de GitHub desde agosto 2025.
- Regla: nunca dejar a un agente un codebase sin análisis estático. JavaScript sin tipos y Python sin anotaciones son las dos elecciones de mayor riesgo.
- Los scaffolds deterministas superan a dejar que la IA improvise el setup: los errores más caros ocurren en la inicialización (aliases inconsistentes, versiones en conflicto, estructura sin referencia canónica).

## Los 4 "golden paths" de Pandacorp (propuestos)

### Stack A — Aplicación web full-stack
```
Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
tRPC o Server Actions · Drizzle ORM + PostgreSQL
Better Auth o Supabase Auth · Stripe (pagos)
Vitest (unit) + Playwright (e2e) · Biome + tsconfig strict
Vercel (deploy) + GitHub Actions (CI)
Inngest/Trigger.dev (jobs) · Upstash Redis (cache/rate-limit)
Scaffold: create-t3-app / create-t3-turbo (monorepo)
```
Caso de uso: app de restaurantes (listar, escoger mesa, pedir).

### Stack B — API/servicio backend (TypeScript)
```
Hono (Node/Bun, 14 kB, multi-runtime, 2-3x NestJS en throughput)
Drizzle + PostgreSQL · Zod · Vitest · Biome
Railway o Fly.io · GitHub Actions
```
Caso de uso: APIs stateless, webhooks, gateways.

### Stack C — API/servicio backend (Python, ML-adyacente)
```
FastAPI (Python 3.12) + Pydantic v2 + SQLAlchemy 2.x
pytest + pytest-asyncio · mypy --strict · Ruff
Docker en Railway/Fly.io · GitHub Actions
```
Caso de uso: APIs de inferencia ML, pipelines de datos.

### Stack D — Recolección de datos / scraping / notificaciones
```
Python 3.12 + FastAPI (API de jobs)
Playwright async (páginas JS) + httpx/parsel (estático, 10-50x más rápido)
ARQ + Redis (cola asyncio; Celery si CPU-bound)
APScheduler/ARQ cron · PostgreSQL (JSONB) · Sentry
Proxies residenciales con tracking de éxito por dominio
pytest + ruff + mypy · Docker + Railway/Fly.io
```
Caso de uso: catálogo de Funkos en tiempo real (scrapers de Funko.com, tiendas, anuncios + notificaciones).

## Infraestructura por defecto (operador solo + agentes)

| Capa | Default | Alternativa | Nota |
|---|---|---|---|
| Frontend/web | Vercel | — | Hobby gratis; $20/mes Pro |
| Workers/servicios | Railway | Fly.io | Contenedores persistentes |
| Postgres | Supabase (prod full-stack) | Neon (branching por PR, scale-to-zero) | Neon ideal para entornos efímeros de agentes |
| Auth | Better Auth (TS, $0, datos propios) | Supabase Auth / Clerk (solo MVP) | Clerk caro a escala (~$1.8k/mes a 100K MAU). **Nunca auth casero** |
| Pagos | Stripe | — | Estándar indiscutido |
| Cache/rate-limit | Upstash Redis | Redis self-hosted | TTL obligatorio en toda key |
| Email | Resend | — | |
| Errores | Sentry | — | |
| CI/CD | GitHub Actions | — | lint+typecheck+tests en paralelo; e2e en PR |

Costo mensual de referencia: $0 al lanzar → ~$125-150/mes con tracción.

## Monorepo vs repos separados

- **Monorepo pnpm** cuando web+API comparten tipos (tRPC, Zod, Drizzle schema) o web+móvil comparten lógica. Layout: `apps/web`, `apps/api`, `packages/db`, `packages/shared`, `packages/ui`. Turborepo solo a partir de 3+ apps.
- **Repos separados** en fronteras políglotas (scraper Python vs web TS) o cadencias de deploy independientes.
- Reglas para agentes: `packages/shared` es la fuente única de tipos/validadores; un componente por archivo con test colocado; carpetas por feature; backend en 3 capas (Routes → Services → Repositories).

## Convenciones que ayudan a los agentes

- **TS**: Biome (10-100x más rápido que ESLint+Prettier, un solo binario); tsconfig con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; aliases absolutos `@/` (prohibido `../../..`).
- **Python**: Ruff (reemplaza flake8+isort+Black+bandit) + mypy strict.
- **Commits**: Conventional Commits con scope obligatorio + semantic-release (changelog y versionado automáticos).
- **AGENTS.md** (100-250 líneas) por repo como contrato: stack con versiones exactas, patrones prohibidos (`any`, `@ts-ignore`, imports relativos profundos), checklist de verificación antes de terminar, reglas de migraciones (nunca editar aplicadas, siempre `down`), formato de commits, evidencia requerida (salida de tests, traces de Playwright).
- **E2E**: solo 5-20 flujos críticos; selectores `data-testid` (nunca clases CSS); traces como evidencia en CI.
- **MCP de calidad**: SonarQube/Codacy/Semgrep/Biome exponen MCP servers para que el agente valide su propio output antes de presentar.

Fuentes: [Typed languages](https://github.blog/ai-and-ml/llms/why-ai-is-pushing-developers-toward-typed-languages/) · [Playbook fullstack+IA](https://dev.to/truongpx396/building-production-grade-fullstack-products-with-ai-coding-agents-a-practical-playbook-2idd) · [Hono vs NestJS vs Fastify](https://encore.dev/articles/nestjs-vs-fastify-vs-hono) · [Neon vs Supabase](https://www.bytebase.com/blog/neon-vs-supabase/) · [Auth comparado](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk) · [ARQ vs Celery](https://leapcell.io/blog/celery-versus-arq-choosing-the-right-task-queue-for-python-applications) · [Arquitectura scraping](https://sociavault.com/blog/scraping-infrastructure-architecture-2025) · [create-t3-turbo](https://github.com/t3-oss/create-t3-turbo) · [Biome](https://github.com/biomejs/biome) · [semantic-release](https://github.com/semantic-release/semantic-release)
