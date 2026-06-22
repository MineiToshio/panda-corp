# Stack A — Full-stack web app (Next.js) · default suggestion

Installation guide for `/pandacorp:blueprint`, full-stack web case. It's the **recommended starting point** (`factory/standards/stack.md`), NOT a mandate: the `architect` can propose better alternatives and the owner approves in the blueprint. **Always use the latest stable versions** for a new project (`@latest`); an older/brownfield project installs only versions **compatible with its framework major** (DR-052). Recommended stack: Next.js + React + TypeScript + Tailwind + **Prisma** + **Better Auth** + **next-intl** + **PostHog** + **Sentry** + Vitest + Playwright + **Biome** (the single format+lint tool — no Prettier, no ESLint) + **npm**, `src/` structure with the data layer in `queries/`.

## Canonical config files (installed VERBATIM, conformance-checked — DR-059)

This stack ships **three canonical config files** next to this guide; they are installed **VERBATIM** into the project (no hand-rolled partial copies) and `/pandacorp:upgrade` **diffs them against these templates and regenerates on drift** — so a project's enforcement can never silently fall behind the standard:

- **`biome.json`** → project root — MAXIMUM fail-closed lint+format (domains `react`/`next`/`test`, the `a11y` group, hard-enforcement rules promoted to **error**, `noExcessiveCognitiveComplexity: "error"`, `useSortedClasses`). Carries `css.parser.tailwindDirectives: true` (or biome PARSE-ERRORS on `@theme`/`@apply` in `globals.css`), ignores `.pandacorp/` (the overlay isn't product code), and keeps `complexity.noImportantStyles: "off"` (the `prefers-reduced-motion` WCAG reset needs `!important`) — DR-076.
- **`verify.sh`** → `.pandacorp/verify.sh` — the fail-closed gate (structure guard, doc-lint, `biome --error-on-warnings`, `tsc`, `knip`, `madge --circular`, `vitest`, then ONE playwright run over `e2e/` — smoke + visual + responsive + shell in a single webServer boot, DR-076).
- **`knip.json`** → project root — the dead-code config (`knip@6` schema; entry = app routes + next config + `e2e/*.spec.ts`; project = `src/**`; `ignoreDependencies: ["tailwindcss", "@axe-core/playwright"]` — both are used outside the graph knip traces, DR-076).
- **`e2e/{smoke,visual,responsive,shell}.spec.ts` + `e2e/_responsive-helper.ts` + `playwright.config.ts`** → `e2e/` and project root — the gate **machinery** (DR-055/056/074/075), installed VERBATIM and conformance-checked, exactly like the config files above. **`e2e/routes.ts`, `e2e/_target.ts` and `e2e/shell.ts` are PER-PROJECT seeds** (the surface manifest + the platform read + the app-shell nav contract) — created only if missing, NEVER byte-diffed/overwritten.

The sections below explain *why* each is configured the way it is; they are the rationale, not a second source to hand-tune.

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
   pnpm add -D @biomejs/biome@latest
   ```
   **Do NOT run `biome init` and hand-tune it.** Install the **canonical `biome.json`** (`${CLAUDE_PLUGIN_ROOT}/templates/stack-a-nextjs/biome.json`) **VERBATIM** — it is the MAXIMUM fail-closed config (DR-059), conformance-checked by `/pandacorp:upgrade`. It enables the **domains** (`react`, `next`, `test`) and the **`a11y`** group, and promotes the hard-enforcement rules to **error**. **Correction:** Biome *detects the presence* of a domain from `package.json`, but **the domain's rules are NOT auto-activated** — you must enable each domain (and `useSortedClasses`, a nursery rule) **explicitly** in `biome.json`, which the canonical file does. Tailwind class ordering = Biome's `useSortedClasses` (replaces `prettier-plugin-tailwindcss`). Biome formats AND lints; do not add Prettier or ESLint. **Escape hatch only if needed**: a minimal ESLint config running *only* `eslint-plugin-testing-library` (and/or `eslint-config-next`) for the few rules Biome lacks — never re-add Prettier.
3. **Testing + dead-code gate**: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test knip madge` — then install the canonical **`knip.json`** (`${CLAUDE_PLUGIN_ROOT}/templates/stack-a-nextjs/knip.json`) VERBATIM (DR-059).
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

The engineering rules in `docs/rules/` are read by agents (soft enforcement); the **mechanically-checkable** ones are wired into **Biome** so a violation **fails `verify.sh`/CI** (this is what catches a rule an agent ignored). These are already enabled **as `error`** in the canonical `biome.json` (DR-059) — you don't re-enable them by hand; this list is the rationale map (rule → standard):

- **`noArrayIndexKey`** — bans `index` as a React list `key` (`react.md`).
- **`useExhaustiveDependencies`** + **`useHookAtTopLevel`** — hook dependency/ordering bugs (`react.md`).
- **`noExplicitAny`** + `tsc` strict — `any`/`@ts-ignore` forbidden (`code-conventions.md`, `typescript.md`).
- **`noImportCycles`** — no circular dependencies (`clean-code.md`). *(Youngest Biome rule — watch its open edge cases.)*
- **`noBarrelFile`** + **`noReExportAll`** — no barrel files (`clean-code.md` / `web-performance.md`); **`noRestrictedImports`** to ban specific barrel paths.
- **`useImportType`** — type-only imports (`typescript.md`); **`noUnusedVariables`** — clean imports.
- **`noParameterAssign`** — don't mutate inputs (`clean-code.md`); **`useMaxParams`** — ≤3 params; **`noExcessiveCognitiveComplexity: "error"`** — complexity cap (error, not warn — `clean-code.md`).
- **`a11y` group** (enabled by default via the domain) — backs `accessibility.md`.
- **`noDangerouslySetInnerHtml`** + **`noGlobalEval`** — injection (`web-security.md`).
- **`noFocusedTests`** + **`noSkippedTests`** (`test` domain) — test hygiene.

`tsc --noEmit` (strict, with `noUncheckedIndexedAccess`) is the typing gate; `vitest`/`playwright` the behavior gate.

**What Biome can't lint → other gates:** file-size limit and `_tests/` placement (`clean-code`/`project-structure`) → the structure guard below + reviewer; **Testing-Library-specific** query/async rules and full `eslint-plugin-next` parity → the optional ESLint escape hatch; deep type-aware rules → reviewer. A rule no tool can check stays a reviewer/agent check.

**Structure guard (file placement isn't lintable — already in the gate).** The `_tests/` rule (`project-structure.md`) is enforced by the structure guard at the top of the canonical `verify.sh` (DR-059) — linters don't check file location, so the gate fails on any loose `*.test.ts(x)` outside a `_tests/` folder. **Dead code** is the canonical `knip.json` + the fail-closed `pnpm knip` step in `verify.sh` (`clean-code.md`); **circular imports** double-checked by `madge --circular` (Biome's `noImportCycles` is the linter layer).

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
       // domcontentloaded, NOT networkidle (DR-071): a real-time transport (SSE/EventSource,
       // websocket, long-poll) keeps the network busy forever → networkidle never settles → the
       // page times out. The toBeVisible() below is the deterministic readiness signal instead.
       const res = await page.goto(route, { waitUntil: "domcontentloaded" });
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
    // Block any real-time transport so the shot is DETERMINISTIC + the page doesn't hang on a never-
    // settling network (DR-071). Adjust the glob to your live endpoint (SSE/websocket/poll):
    await page.route("**/api/live**", (r) => r.abort());
    await page.goto(route, { waitUntil: "domcontentloaded" });       // NOT networkidle — SSE never idles
    await expect(page.locator("main, h1").first()).toBeVisible();     // real content before the screenshot
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

**Baseline-blessing flow (DR-056) — a genuinely-new route has no baseline on its first build, and that is NOT a build-blocking RED.** A route's first `toHaveScreenshot` baseline does not exist until someone blesses it; CI never blesses (`updateSnapshots: "none"` / `"missing"`), so the bless happens **once, at the FRD gate, by the reviewer** — never the builder, never CI. The order is strict:
1. Layer B runs first: the VLM mock-judge confirms the route matches its `mocks/<file>` (named-divergence check, ≥2 viewports, majority vote).
2. **Only after Layer B passes**, the reviewer blesses the baseline: `playwright test e2e/visual.spec.ts --update-snapshots` and **commits the baseline PNGs** (LFS if large).
3. **Then** the reviewer runs the gate's `verify.sh` — now Layer A has a blessed baseline to diff against, and from here on Layer A is the **hard regression gate** (any later drift = RED).

So a **missing baseline on a genuinely-new route** is "to be blessed at the gate", not a failure. What IS fail-closed is the **absence of the `test:visual` harness/script itself** (no `e2e/visual.spec.ts`, no `test:visual` script, no visual shim in `verify.sh`) — that's a missing gate, RED, never a skip. Missing baseline = bless it; missing harness = fail.

**Layer B — VLM mock-judge (the reviewer step, catches the FIRST divergence from the mock).** Not a script — it's the `reviewer` (opus, vision, a different model from the sonnet builder): for each route it places the route screenshot next to the FRD's `mocks/<file>` and enumerates the NAMED divergences (missing/extra component, wrong color/token, gross layout/spacing) BEFORE a verdict, at ≥2 viewports, ≥3 samples with image order randomized (majority vote). Fail-closed on a named structural divergence; do not auto-fail on fine pixel/spacing deltas; an uncertain verdict (looks off but nothing nameable) → BLOCK `needs-owner`, never pass. (See `plugin/agents/reviewer.md` runtime/visual lens.)

## Responsive Gate (DR-074) — does the build actually WORK at a mobile width

A web app that ships desktop-first and overflows on a phone passes the smoke + visual gates (they only check "renders clean" and "matches its OWN baseline" — even a broken baseline). This gate is the real fix: a SHIPPED, smart, fail-closed check at the mobile viewport, propagated VERBATIM exactly like the smoke/visual machinery.

- **`e2e/_responsive-helper.ts`** exports `assertResponsive(page, url, { mobileWidth })`. It settles FIRST (the #1 flake risk: mobile viewport → block the live transport `**/api/live**` → `domcontentloaded` → `document.fonts.ready` → `<main>` visible), then runs four SMART checks at the mobile width:
  - **Per-scroll-root overflow**: RED if any element has `scrollWidth > clientWidth + 1` (sub-pixel tolerance only) UNLESS that element or an ancestor is marked `data-scroll-x="intentional"` (the author-declared escape hatch for legit kanban / DAG / wide-table horizontal scroll — broken-vs-intentional is DECLARED, not guessed).
  - **Silent off-canvas clip**: RED if `overflow-x: hidden|clip` AND `scrollWidth > clientWidth + 1` (content clipped off-screen — what MC actually shipped), same escape hatch.
  - **Tap targets**: axe-core `target-size` (WCAG 2.2 SC 2.5.8, the **24px** line — not 44px) at the mobile width.
  - **`<main>` not occluded** by a `position:fixed` element overlapping the top of its content box, UNLESS `<main>` reserves `scroll-margin-top ≥` the fixed element's height (the legit sticky-header pattern, WCAG 2.4.11).
- **`e2e/responsive.spec.ts`** runs the mobile-width checks **only when `target_platforms` includes mobile** (read from `.pandacorp/status.yaml` via `e2e/_target.ts`); for a desktop-only / API / scraper project it is a **vacuous pass**. Add `"test:responsive": "playwright test e2e/responsive.spec.ts"` to `package.json` and `@axe-core/playwright` to `devDependencies`.
- **Mark intentional scroll-x once**: a deliberate horizontal-scroll container (kanban board, dependency DAG, a wide data table that scrolls by design) carries `data-scroll-x="intentional"` so the gate doesn't false-red it — and so an implementer can't "fix" a false red by wrapping content in `overflow:hidden` (which would CREATE a silent-clip bug). That is the whole point: the gate distinguishes a real overflow defect from a designed scroll region by an explicit author signal, not a heuristic.

## Shell-Presence Gate (DR-075) — does the build have the prototype's global shell / nav

The visual gate (`toHaveScreenshot`) is a SELF-baseline regression guard: it proves **consistency** (matches its own committed baseline), **not fidelity** to the prototype. So a build that rendered every page **menu-less** produced menu-less baselines and shipped green — a whole global nav missing (the MC failure). The root cause upstream is that per-FRD sharding ("only that FRD's screens, never the whole app") drops the **persistent shell** (topbar/nav/footer/layout frame), which belongs to no single FRD. This gate is the downstream enforcement: a SHIPPED, deterministic, fail-closed check of the app **against the prototype's nav contract**, propagated VERBATIM like the smoke/visual/responsive machinery.

- **`e2e/shell.ts`** is the **per-project seed** (created-if-missing, NEVER byte-diffed — like `routes.ts`/`_target.ts`): the **author-declared, prototype-anchored** nav contract — `SHELL_SELECTOR` (the persistent-shell landmark), `NAV_DESTINATIONS` (`{label, path}` for each top-level nav link, seeded by `/pandacorp:design` or `/pandacorp:adopt` from `docs/design/prototype/` — **NOT** derived from `routes.ts`, which is a superset), `SHELL_EXEMPT` (routes that legitimately render without the shell — auth/print/embed/sub-destinations), and an optional `NAV_TOGGLE` (mobile drawer/hamburger). **Empty `NAV_DESTINATIONS` ⇒ the app has no persistent shell ⇒ vacuous pass.**
- **`e2e/shell.spec.ts`** (VERBATIM) iterates `SURFACES` **minus `SHELL_EXEMPT`** (NOT `BLESSED` — the MC failure is a route that shipped *blessed* with no shell, so gating on `blessed` would inherit the blind spot), settle-first exactly like the responsive helper (abort the live transport → `domcontentloaded` → `fonts.ready` → `<main>` visible), then asserts: the shell landmark is **visible** on every non-exempt route; every `NAV_DESTINATION` is a **visible link inside the shell** whose `href` equals its path; each destination **2xx-resolves**; and on mobile (`target_platforms` includes mobile) the nav is reachable (visible or via the declared toggle). Add `"test:shell": "playwright test e2e/shell.spec.ts"` to `package.json`.
- **The contract is anchored to the PROTOTYPE, not the app** — that is what makes it a *fidelity* check, not another *consistency* check: a build that drops a destination cannot make itself green by trimming its own routes, because the expected nav comes from the frozen prototype contract (it drifts only when the prototype itself changes, like a blessed baseline). Pairs with the responsive gate: once the shell exists it is one more route the responsive gate covers; this gate adds the **nav-reachability** check the responsive gate does not do.

### Scoped gate — `verify.sh --since <sha>` (fast per-FRD pass)

The full gate is expensive to run on every FRD. `verify.sh` accepts an optional `--since <sha>` that **scopes vitest to the changed tests** for the fast per-FRD gate — `vitest run --changed <sha>` (only specs affected since `<sha>`). The static gates stay **global** (cheap and catch cross-cutting breakage): `biome check` and `tsc --noEmit` always run over the whole tree. Without `--since`, `verify.sh` runs everything. **At close-out** the full suite runs unscoped — `vitest run` over all tests **plus every visual baseline** (all routes, all viewports) — so nothing ships on a partial pass. Per-FRD = scoped + fast; close-out = full + complete.

## `.pandacorp/verify.sh` — canonical, installed VERBATIM (DR-059)

The gate is **not** hand-rolled per project. Install `${CLAUDE_PLUGIN_ROOT}/templates/stack-a-nextjs/verify.sh` **VERBATIM** as `.pandacorp/verify.sh` (alongside `biome.json` and `knip.json`); `/pandacorp:upgrade` **conformance-checks** it against this template and regenerates on drift, so a project's enforcement can never silently fall behind the standard. It is MAXIMUM fail-closed — `set -euo pipefail` + `inherit_errexit`, every Biome warn promoted to a hard gate (`--error-on-warnings`), and a **missing** smoke/visual harness is RED, never a skip. The gate runs, in order: structure guard (no loose `*.test.ts(x)`) → doc-lint (DR-077) → `biome check` → `tsc --noEmit` → `knip` (dead code) → `madge --circular` → `vitest run` → the **browser gates in ONE `playwright test e2e/` invocation** (smoke DR-055 + visual DR-056 + responsive DR-074 + shell DR-075 — one webServer boot, fail-closed on each missing spec file, DR-076). The canonical file is the source of truth — read it there, don't duplicate it here.

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
