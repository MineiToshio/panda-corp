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

## Hard enforcement (lint rules — make the rule library fail the gate, not just live in prose)

The engineering rules in `docs/rules/` are read by agents (soft enforcement); wire the **mechanically-checkable** ones into the linter so a violation **fails `verify.sh`/CI** (this is what catches a rule an agent ignored). Enable in the lint config (Biome rules, or the ESLint equivalents in parentheses):

- **`noArrayIndexKey`** (`react/no-array-index-key`) — bans `index` as a React list `key` (`react.md`).
- **`useExhaustiveDependencies`** (`react-hooks/exhaustive-deps`) — catches `useEffect`/`useMemo`/`useCallback` dependency bugs (`react.md`).
- **`noExplicitAny`** + `tsc` strict — `any`/`@ts-ignore` forbidden (`code-conventions.md`).
- **`noRestrictedImports`** for the project's own barrels (e.g. ban `@/components` as an import source in app code) — enforces "no barrel imports in hot paths" (`web-performance.md`).
- **`useImportType`** / no-unused-imports — keeps imports clean.
- **a11y rules** (Biome `a11y/*` or `eslint-plugin-jsx-a11y`) — backs the accessibility rules in `styling-and-ui.md`.

`tsc --noEmit` (strict, with `noUncheckedIndexedAccess`) is the typing gate; `vitest`/`playwright` are the behavior gate (`quality-and-testing.md`). A rule that can't be linted stays as a reviewer/agent check.

**Structure guard (file placement isn't lintable — add a check).** The `_tests/` rule (`project-structure.md`) needs a guard in `verify.sh`, since linters don't check file location:
```bash
# fail if any unit/component test sits loose (outside a _tests/ folder, outside e2e/ and src/test/)
stray=$(find src -name '*.test.ts' -o -name '*.test.tsx' | grep -v '/_tests/' || true)
[ -n "$stray" ] && { echo "✗ tests must live in a _tests/ folder, not beside source:"; echo "$stray"; exit 1; } || true
```

## `.pandacorp/verify.sh`

```bash
#!/bin/bash
set -e
pnpm biome check . 2>/dev/null || pnpm lint   # includes the hard-enforcement rules above
pnpm tsc --noEmit
pnpm vitest run --reporter=dot
```

## CI (`.github/workflows/ci.yml`)

Parallel jobs on PR: `lint` (biome check), `typecheck` (tsc --noEmit), `test` (vitest run). E2E (`playwright test`) on PRs to main. pnpm cache.

## Library conventions (apply only when the project uses the library)

Tech-gated rules: they ride with this stack's libraries. If the blueprint swaps a library out, its rule doesn't apply.

**Prisma (data layer).** All queries live in the data layer (`queries/`, one file per model) — never call Prisma from components, pages, Server Actions or route handlers. Naming: `getXByY` / `createX` / `updateX` / `deleteX`. Lean on Prisma-generated types (don't redefine them). Pass the Prisma client by **dependency injection** (first argument) so queries are unit-testable. Multi-step writes that must be atomic go through `prisma.$transaction`.

**next-intl (i18n).** In React components use the hooks (`useTranslations`, `useLocale`); use the server helpers (`getTranslations`) only in non-React code (route handlers, metadata, framework functions). Never hardcode user-facing copy.

**PostHog (analytics).** Every event name lives in a single `POSTHOG_EVENTS` constant (`src/lib/constants.ts`) — never loose strings. Prefer the declarative `data-ph-event` / `data-ph-props` attributes consumed by a global click delegate; fall back to manual `posthog.capture()` only for logic the delegate can't express. Capture meaningful interactions (CTAs, nav, forms, toggles), not hover/keystrokes.

**Sentry (errors).** Capture only **unexpected** errors (bugs, broken dependencies). Expected errors (validation, permissions, rate limits) are handled in-flow, not reported — unless watching for an abnormal spike. Route capture through one small helper that standardizes tags/context and **redacts PII**; don't sprinkle `captureException` everywhere.

**Design system.** One canonical component per UI pattern (a single `<Modal>`, one `<Button>`): consume it, never fork or hand-roll a parallel version. New shared UI is promoted core → modules per `factory/standards/structure.md`.

## Deploy

Vercel (hobby to start). Environment variables via the Vercel dashboard, never in the repo.
