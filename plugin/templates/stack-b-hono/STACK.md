# Stack B — Backend API/service (TypeScript + Hono)

> **PROVISIONAL STACK — no canonical gate harness yet (audit-20, owner decision 2026-07-01).** Unlike stack A, this guide ships no canonical `verify.sh`/lint config, so the DR-059/DR-076 conformance ("installed byte-for-byte, upgrade diffs against the template") CANNOT yet protect a project born from it. This guide describes the **gate contract in prose**; the canonical files are listed under *Pending template machinery* below and MUST be built before/with the first real project on this stack. The browser gates (smoke/visual/responsive/shell) are N/A for a headless stack — that opt-out is DECLARED here (DR-059: an opt-out is a decision, not an omission).

Installation guide for `/pandacorp:architecture`. Use case: **headless** services — webhook receivers, gateways, integrations, an API consumed by clients other than its own web UI. If the product IS a web app, its API lives in stack A's route handlers (don't spin up a separate service). Why Hono: one codebase runs on Node, Bun, Deno, Cloudflare Workers and Lambda; tiny; Zod-first middleware. Fastify is the mature Node-only alternative (heavy Node-server workloads, plugin ecosystem) the architect may propose via ADR; Elysia is not the default (it means going all-in on Bun).

## Installation (pin at the install point — DR-102 + SEC-4 cooldown)

Latest stable for a new project (DR-052), **pinned at install, never in prose** (DR-102): before each add, check the version's publish date (`pnpm view <pkg> time --json`) and **never install one published < ~7 days ago** (new-release cooldown, `web-security.md` SEC-4 — take the previous stable); set `.npmrc` `minimum-release-age` where supported. Exact versions in the lockfile; no `^`/`~` drift.

```bash
pnpm create hono@latest . # template: nodejs (or cloudflare-workers per the blueprint)
pnpm add hono @hono/node-server @hono/zod-validator @hono/zod-openapi zod drizzle-orm postgres
pnpm add -D -E @biomejs/biome
pnpm add -D vitest drizzle-kit knip typescript@latest
```

**Biome config:** install a canonical `biome.json` (pending, see below); until then copy stack-a's `biome.json` (`${CLAUDE_PLUGIN_ROOT}/templates/stack-a-nextjs/biome.json`) and strip the `react`/`next` domains — **never `biome init` and hand-tune** (DR-059).

## Standard Pandacorp configuration

1. **tsconfig**: `"strict": true`, `"noUncheckedIndexedAccess": true`.
2. **Validation at the boundary**: ALL endpoint input with Zod (`@hono/zod-validator` / the `@hono/zod-openapi` route schemas). Shared schemas in `src/schemas/`; no raw `c.req.json()` into the logic.
3. **3-layer structure**: `src/routes/` → `src/services/` → `src/repositories/` — the **isolated data layer**: Drizzle is called ONLY from `src/repositories/` (never from routes or services); repositories take the db client by dependency injection (first argument) so they are unit-testable.
4. **Error contract (`api-design.md`, RFC 9457)**: every 4xx/5xx goes through a shared `problem()` helper (`src/lib/problem.ts`, same shape as stack-a's) returning `application/problem+json` with `type/title/status/detail/instance` (+ `errors[]` `{detail, pointer}` for validation). Wire it as the `app.onError` / `app.notFound` handler AND use it in route branches — never ad-hoc `c.json({error})`.
5. **OpenAPI is generated, never hand-written**: define routes with `@hono/zod-openapi` (`createRoute` + `app.doc("/doc", …)`) so the spec derives from the same Zod schemas that validate. Sanctioned lighter alternative: the `hono-openapi` middleware over plain Hono routes — choose ONE in the blueprint, don't mix.
6. **DB**: Drizzle + Postgres (Neon — Supabase was evaluated and rejected, see `external-services.md`). Migrations with drizzle-kit, always with down (`quality.md`). Dev DB in Docker per `infra.md` port conventions.
7. **Observability**: structured logger (hono/logger or pino) + Sentry — capture only unexpected errors, through one helper that redacts PII (same convention as stack A).
8. **Tests**: Vitest, **in-process** — `app.request()` or `testClient` from `hono/testing` (typed client); no network, no running server. Repositories tested against an isolated test DB; services with injected fakes. Tests colocated per `structure.md`.

## The gate contract — what `verify.sh` MUST cover (fail-closed, DR-059)

Until the canonical harness ships, the architect hand-writes `.pandacorp/verify.sh` to this contract — `set -euo pipefail`, every step blocking, a missing tool is RED not a skip:

1. **Lint + format**: `pnpm biome check --error-on-warnings .` (every warn is a hard gate).
2. **Types**: `pnpm tsc --noEmit` (strict + `noUncheckedIndexedAccess`).
3. **Tests**: `pnpm vitest run`.
4. **Dead code**: `pnpm knip` (entry = the server entrypoint; a `knip.json` is part of the pending machinery).
5. **Data-layer isolation** (STRUCT-2): grep gate — Drizzle/`postgres` imports outside `src/repositories/` are RED.
6. **API error contract** (API-1, `api-design.md`): grep gate — a route returning 4xx/5xx without the shared `problem()` helper is RED.
7. **OpenAPI presence**: the `/doc` route (or generated spec artifact) exists — an API without a generated spec is RED.

Browser gates: N/A (headless — declared opt-out above). Interim minimal script = steps 1-3; steps 4-7 become real the moment the canonical harness lands.

## Library conventions (apply only when the project uses the library)

- **Drizzle**: schema in `src/db/schema.ts`; queries only in repositories, named `getXByY`/`createX`/`updateX`/`deleteX`; multi-step atomic writes via `db.transaction`.
- **Zod**: one schema per contract in `src/schemas/`, reused by validator AND OpenAPI — never duplicated shapes.
- **Rate limiting** (`web-security.md`): any public/auth endpoint gets a sliding-window limiter from day 1 (in-memory per instance is the single-container default; Upstash Ratelimit when state must be shared).

## CI / Deploy (CI is an optional external-governance layer — DR-040)

**The primary quality gate is LOCAL** (`.pandacorp/verify.sh`); the solo operator pushes to `main` directly. GitHub Actions (lint + typecheck + test) is an **optional** layer for projects with an external remote/collaborators — it re-runs the same gate, never replaces it. Deploy: **container on Railway** (default — reads `process.env.PORT`, Railpack/Dockerfile) or Fly.io (Dockerfile); **Cloudflare Workers** if the blueprint calls for edge (then the entry adapter changes and Node-only libs are off the table — decide in the blueprint, not mid-build).

## Pending template machinery (honest TODO — factory backlog)

Canonical, conformance-checked files this stack does NOT ship yet (each is a gap, not a silent default):

- [ ] `biome.json` (headless profile: no `react`/`next` domains, `test` domain on, hard-enforcement rules at `error`)
- [ ] `verify.sh` implementing the full gate contract above (incl. STRUCT-2 + API-1 grep gates, knip, OpenAPI presence) + `canary.sh` (DR-079)
- [ ] `knip.json` (entry/project globs for a Hono service)
- [ ] `src/lib/problem.ts` canonical snippet file (today: copy the shape from `stack-a-nextjs/STACK.md`)
- [ ] `/pandacorp:upgrade` conformance wiring for this stack's set (DR-059/DR-076)
