# Stack A — Full-stack web app (Next.js) · default suggestion

Installation guide for `/pandacorp:blueprint`, full-stack web case. It's the **recommended starting point** (`factory/standards/stack.md`), NOT a mandate: the `architect` can propose better alternatives and the owner approves in the blueprint. **Always use the latest stable versions** for a new project (`@latest`); an older/brownfield project installs only versions **compatible with its framework major** (DR-052). Recommended stack: Next.js + React + TypeScript + Tailwind + **Prisma** + **Better Auth** + **next-intl** + **PostHog** + **Sentry** + Vitest + Playwright + **Biome** (the single format+lint tool — no Prettier, no ESLint) + **npm**, `src/` structure with the data layer in `queries/`.

## Installation

```bash
# Official scaffolder (choose based on the blueprint: tRPC or default options)
pnpm create t3-app@latest . --noGit   # the Pandacorp scaffold already has git
# Options: TypeScript, Tailwind, Drizzle, App Router; auth per the blueprint (Better Auth post-install or NextAuth)
```

## Standard Pandacorp configuration (after the scaffolder)

1. **tsconfig**: add `"noUncheckedIndexedAccess": true` (strict already comes).
2. **Biome — the single standard for format + lint (no Prettier, no ESLint):**
   ```bash
   pnpm add -D @biomejs/biome@latest && pnpm biome init
   ```
   In `biome.json` enable the recommended rules + the **domains** (`react`, `next`, `test` — Biome auto-detects them from `package.json`) and the **`a11y`** group. Tailwind class ordering = Biome's `useSortedClasses` (replaces `prettier-plugin-tailwindcss`). Biome formats AND lints; do not add Prettier or ESLint. **Escape hatch only if needed**: a minimal ESLint config running *only* `eslint-plugin-testing-library` (and/or `eslint-config-next`) for the few rules Biome lacks — never re-add Prettier.
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

The engineering rules in `docs/rules/` are read by agents (soft enforcement); wire the **mechanically-checkable** ones into **Biome** so a violation **fails `verify.sh`/CI** (this is what catches a rule an agent ignored). Enable these Biome rules:

- **`noArrayIndexKey`** — bans `index` as a React list `key` (`react.md`).
- **`useExhaustiveDependencies`** + **`useHookAtTopLevel`** — hook dependency/ordering bugs (`react.md`).
- **`noExplicitAny`** + `tsc` strict — `any`/`@ts-ignore` forbidden (`code-conventions.md`, `typescript.md`).
- **`noImportCycles`** — no circular dependencies (`clean-code.md`). *(Youngest Biome rule — watch its open edge cases.)*
- **`noBarrelFile`** + **`noReExportAll`** — no barrel files (`clean-code.md` / `web-performance.md`); **`noRestrictedImports`** to ban specific barrel paths.
- **`useImportType`** — type-only imports (`typescript.md`); **`noUnusedVariables`** — clean imports.
- **`noParameterAssign`** — don't mutate inputs (`clean-code.md`); **`useMaxParams`** — ≤3 params; **`noExcessiveCognitiveComplexity`** — complexity cap.
- **`a11y` group** (enabled by default via the domain) — backs `accessibility.md`.
- **`noDangerouslySetInnerHtml`** + **`noGlobalEval`** — injection (`web-security.md`).
- **`noFocusedTests`** + **`noSkippedTests`** (`test` domain) — test hygiene.

`tsc --noEmit` (strict, with `noUncheckedIndexedAccess`) is the typing gate; `vitest`/`playwright` the behavior gate.

**What Biome can't lint → other gates:** file-size limit and `_tests/` placement (`clean-code`/`project-structure`) → the structure guard below + reviewer; **Testing-Library-specific** query/async rules and full `eslint-plugin-next` parity → the optional ESLint escape hatch; deep type-aware rules → reviewer. A rule no tool can check stays a reviewer/agent check.

**Structure guard (file placement isn't lintable — add a check).** The `_tests/` rule (`project-structure.md`) needs a guard in `verify.sh`, since linters don't check file location:
```bash
# fail if any unit/component test sits loose (outside a _tests/ folder, outside e2e/ and src/test/)
stray=$(find src -name '*.test.ts' -o -name '*.test.tsx' | grep -v '/_tests/' || true)
[ -n "$stray" ] && { echo "✗ tests must live in a _tests/ folder, not beside source:"; echo "$stray"; exit 1; } || true
```

## Preview Smoke Gate (DR-055) — render every UI route, fail-closed

A web project's gate MUST open the app in a real browser, not just run static checks. This is the layer whose absence let a build pass green while every route threw and matched no mockup. It is **mandatory and fail-closed** for this (web) stack.

1. **`playwright.config.ts`** boots the app itself via `webServer` (so the smoke runs unattended, no human, in CI and inside `verify.sh`):
   ```ts
   import { defineConfig } from "@playwright/test";
   export default defineConfig({
     testDir: "e2e",
     webServer: { command: "pnpm build && pnpm start", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI, timeout: 120_000 },
     use: { baseURL: "http://127.0.0.1:3000" },
   });
   ```
2. **`e2e/smoke.spec.ts`** — one smoke per key UI route (each FRD contributes its routes). Fails the gate on any console error / uncaught exception / blank-or-error render; screenshots for the reviewer's fidelity check:
   ```ts
   import { test, expect } from "@playwright/test";
   const ROUTES = ["/"]; // each UI FRD appends its key routes (DR-055)
   for (const route of ROUTES) {
     test(`smoke ${route}`, async ({ page }) => {
       const problems: string[] = [];
       page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
       page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
       page.on("requestfailed", (r) => problems.push(`reqfailed: ${r.url()}`));
       const res = await page.goto(route, { waitUntil: "networkidle" });
       expect(res?.ok(), `${route} returned ${res?.status()}`).toBeTruthy();
       await expect(page.locator("main, h1").first()).toBeVisible(); // real content, not error.tsx/blank
       await page.screenshot({ path: `docs/reviews/smoke/${route.replace(/\W+/g, "_") || "root"}.png`, fullPage: true });
       expect(problems, `runtime problems on ${route}:\n${problems.join("\n")}`).toEqual([]);
     });
   }
   ```
   Add `"test:smoke": "playwright test e2e/smoke.spec.ts"` to `package.json`.

## Visual-Fidelity Gate (DR-056) — does the build MATCH the mock (two layers)

When an FRD has approved `mocks/`, "renders clean" is not enough — the build must look like the mock. Two layers, because no single tool reliably compares an arbitrary mock to a build.

**Layer A — deterministic visual regression (the hard block, runs in `verify.sh`).** Playwright `toHaveScreenshot()` against a blessed baseline. Determinism is the whole game (else it flakes):
```ts
// playwright.config.ts — add to defineConfig:
expect: { toHaveScreenshot: { threshold: 0.2, maxDiffPixelRatio: 0.02, animations: "disabled", caret: "hide", scale: "css" } },
updateSnapshots: process.env.CI ? "none" : "missing",   // CI never blesses drift
workers: 1, fullyParallel: false,
```
```ts
// e2e/visual.spec.ts — per key route, at ≥2 viewports
import { test, expect } from "@playwright/test";
const ROUTES = ["/"];                 // each UI FRD appends its routes
const SIZES = [{ w: 390, h: 844 }, { w: 1280, h: 900 }];
for (const route of ROUTES) for (const s of SIZES) {
  test(`visual ${route} @${s.w}`, async ({ page }) => {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.goto(route, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);                 // fonts loaded → no glyph flake
    await page.addStyleTag({ content: `*{transition:none!important;animation:none!important}` });
    await expect(page).toHaveScreenshot(`${route.replace(/\W+/g,"_")||"root"}-${s.w}.png`, {
      fullPage: true,
      mask: [page.locator("[data-dynamic]")],   // mask genuinely volatile regions; DON'T loosen the threshold
    });
  });
}
```
Determinism preconditions (all required): pinned Playwright Docker image (`mcr.microsoft.com/playwright:vX-noble`), `workers:1`, seeded deterministic fixtures + frozen clock + mocked network (so data never shifts pixels), and visual specs **excluded from retries** (a retry re-writes a missing baseline → fail-OPEN). Add `"test:visual": "playwright test e2e/visual.spec.ts"`. Baselines: commit via **Git LFS** if the set is large.

**Layer B — VLM mock-judge (the reviewer step, catches the FIRST divergence from the mock).** Not a script — it's the `reviewer` (opus, vision, a different model from the sonnet builder): for each route it places the route screenshot next to the FRD's `mocks/<file>` and enumerates the NAMED divergences (missing/extra component, wrong color/token, gross layout/spacing) BEFORE a verdict, at ≥2 viewports, ≥3 samples with image order randomized (majority vote). Fail-closed on a named structural divergence; do not auto-fail on fine pixel/spacing deltas; an uncertain verdict (looks off but nothing nameable) → BLOCK `needs-owner`, never pass. (See `plugin/agents/reviewer.md` runtime/visual lens.)

## `.pandacorp/verify.sh`

```bash
#!/bin/bash
set -e
pnpm biome check .          # format + lint in one (the hard-enforcement rules above)
pnpm tsc --noEmit
pnpm vitest run --reporter=dot
# Preview Smoke Gate (DR-055) — FAIL-CLOSED: a missing smoke harness is RED, never a skip.
if grep -q '"test:smoke"' package.json; then
  pnpm test:smoke
else
  echo "✗ Preview Smoke Gate missing: a web project must render its routes in a browser (DR-055). Add e2e/smoke.spec.ts + playwright.config.ts + the test:smoke script."; exit 1
fi
# Visual-Fidelity Gate Layer A (DR-056) — deterministic regression vs blessed baseline, fail-closed.
# (Layer B, the VLM mock-judge, is the reviewer's runtime/visual lens, not a script.)
if grep -q '"test:visual"' package.json; then
  pnpm test:visual
else
  echo "✗ Visual-Fidelity Gate missing: a UI project must diff its routes against blessed baselines (DR-056). Add e2e/visual.spec.ts + the test:visual script."; exit 1
fi
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
