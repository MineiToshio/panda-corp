# Stack B — Backend API/service (TypeScript + Hono)

> **PROVISIONAL STACK — no canonical gate harness yet (audit-20, owner decision 2026-07-01).** Unlike stack A, this guide ships no canonical `verify.sh`/lint config/e2e set, so the DR-059/DR-076 conformance ("installed byte-for-byte, upgrade diffs against the template") CANNOT protect a project born from it — its gates would be hand-rolled, the exact failure mode DR-059 closes. Before building the first real project on this stack, build its canonical gate harness first (tracked as a factory-backlog item). The browser gates (smoke/visual/responsive/shell) are N/A for a headless stack — that opt-out is DECLARED here (DR-059: an opt-out is a decision, not an omission).

Installation guide for `/pandacorp:architecture`. Use case: stateless APIs, webhooks, gateways, edge services.

## Installation

```bash
pnpm create hono@latest . # template: nodejs (or cloudflare-workers per the blueprint)
pnpm add zod drizzle-orm postgres
pnpm add -D -E @biomejs/biome
pnpm add -D vitest drizzle-kit typescript@latest
```

**Biome config:** install a canonical `biome.json` (to be created with this stack's harness); until then copy stack-a's `biome.json` (`${CLAUDE_PLUGIN_ROOT}/templates/stack-a-nextjs/biome.json`) and strip the `react`/`next` domains — **never `biome init` and hand-tune** (DR-052/DR-059).

## Standard Pandacorp configuration

1. **tsconfig**: `"strict": true`, `"noUncheckedIndexedAccess": true`.
2. **Validation**: ALL endpoint input with Zod (`@hono/zod-validator`). Shared schemas in `src/schemas/`.
3. **3-layer structure**: `src/routes/` → `src/services/` → `src/repositories/` (no queries in routes).
4. **DB**: Drizzle + Postgres (Neon — Supabase was evaluated and rejected, see `external-services.md`). Migrations with drizzle-kit, always with down.
5. **Observability**: structured logger (hono/logger) + Sentry.

## `.pandacorp/verify.sh`

Interim snippet (until the canonical harness exists — see the banner above):

```bash
#!/bin/bash
set -euo pipefail
pnpm biome check --error-on-warnings .   # every warn is a hard gate (DR-059)
pnpm tsc --noEmit
pnpm vitest run --reporter=dot
```

## CI (optional external-governance layer — DR-040)

**The primary quality gate is LOCAL** (`.pandacorp/verify.sh`); the solo operator pushes to `main` directly. GitHub Actions (lint + typecheck + test) is an **optional** layer for projects with an external remote/collaborators — it re-runs the same gate, never replaces it. Deploy: Railway or Fly.io (Dockerfile) / Cloudflare Workers if edge.
