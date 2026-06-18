---
description: Folder organization, component layering (core/modules), single-file vs multi-file folders, test placement, feature-first code, isolated data layer.
applies_when: always
globs: ["src/**"]
source: Pandacorp standard — structure
---

# Project structure

Organize code by **reusability** and **scope**: app-wide vs feature-specific vs single-use. Put each thing in the **smallest scope that fits its current usage**, and promote it only when reuse actually appears. (File/function **size limits** live in `clean-code.md`.)

## Source root — `src/` is mandatory
- **All application code lives under `src/`** (`src/app/`, `src/components/`, `src/lib/`, `src/hooks/`, …) whenever the stack supports it (Next.js, Vite, Node/TS, and the equivalent source layout in other languages — e.g. a Python package dir). The `@/*` alias points at `src/` (`@/* → ./src/*`).
- **Config and tooling stay at the repo root** (`package.json`, `next.config.*`, `tsconfig.json`, `.env*`, CI). **Non-code assets/data stay at the root too** (`public/`, `content/`, `docs/`) — `src/` is for code, not data.
- **Why mandatory**: a clean separation between real code and configuration, an uncluttered root, and a predictable place every agent looks first. Not a per-project choice.
- Only skip `src/` when the technology genuinely doesn't allow it (then apply the spirit: one clear source root, separated from config).

## Components — two layers
- **`components/core/`** — essential, simple, **highly reusable primitives** (`Button`, `Input`, `Modal`, `Typography`, icons). If it's not a React component, it doesn't belong here.
- **`components/modules/`** — **composed, reusable** components built from primitives (a `Toolbar`, a `DataTable`, a `JobCard`), not tied to one page.
- **Route-local components** — used by a single route/feature → live in that route's `_components/` (see feature-first), **not** in the global folders.

## Component folder convention (single-file vs multi-file) — applies in core/, modules/ and `_components/`
- **Single-file component**: put the file directly in the parent folder (`core/Button.tsx`). **Don't** create a folder that would hold just one file.
- **Multi-file component**: use a folder named after the component; the main file has the **same name as the folder** (`Button/Button.tsx`) — **never** `index.tsx`. Component-scoped siblings go inside: `types.ts`, `utils.ts`, `*.styles.ts`, `use*.ts` hooks, subcomponents used only here, and **`_tests/`**.
- A component **becomes multi-file the moment it has any scoped sibling — including a test**. So a component that gets a test moves into its own folder with the test under `_tests/`. If a folder ends up with only one file, flatten it back.
- If a helper/subcomponent starts being used outside the component, it's no longer component-scoped — move it up (page → app) per the promotion rule.

## Test placement (definitive — no loose test siblings)
- **Unit/component tests live in a `_tests/` folder** inside the component/feature folder (`Button/_tests/Button.test.tsx`). **Never** leave `*.test.ts(x)` loose at the same level as implementation files — it's visual noise and makes the tree hard to scan.
- **Shared test infra** (render helpers, fixtures, factories, mocks) → `src/test/`.
- **E2E** (Playwright) → top-level `e2e/`, split by domain (`auth.spec.ts`, `dashboard.spec.ts`).

## Reuse before creating (promotion rule)
Before creating a new component, check and reuse in this order: **`components/core` → `components/modules` → the parent route's `_components/` → the route itself.** Only create if none fits. When something starts being used in several places, **move it to the smallest scope that now fits** in the same change (component → page → app); don't pre-promote on speculation.

## Feature-first code & page-level folders
Co-locate everything a route owns in `_`-prefixed sibling folders (the `_` keeps them out of the URL):
```
app/<feature>/
  ├── _components/   ├── _hooks/    ├── _actions/
  ├── _schemas/      ├── _types/    └── _utils/
```
**Scope by segment first**: files used only by a child segment (`stores/new/…`) go in that child's folders, not the parent. Prefer the smallest valid scope. Global, cross-feature code lives in shared roots: `lib/`, `hooks/`, `types/`. Use **route groups** `(group)/` to organize routes by section or to scope a `layout.tsx`/`loading.tsx` to a subset without affecting the URL.

## `src/lib/` organization
Group by **purpose**: one file per library/service (`mapbox.ts`, `prisma.ts`) or per classification (`formatting.ts`, `cookies.ts`, `constants.ts`). When a **second** file of a clear concern appears, promote it to a domain subfolder **in the same change** (`lib/auth/`, `lib/analytics/`) and move both — never leave one at the root and one nested.

## Isolated data layer
All database/persistence access lives in a dedicated data layer (`queries/`, one file per model) — **never** call the ORM/DB directly from components, pages, layouts, server actions, route handlers or hooks. (Library-specific data-layer rules ship separately when the stack defines an ORM.)
