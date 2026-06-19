---
description: Core code conventions — language, naming, strict typing, constants, imports, handlers, commits.
applies_when: always
globs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py"]
source: Pandacorp standard — conventions
---

# Code conventions

## Language
- **Code is 100% English**: variables, functions, types, comments, logs, commit messages, file and folder names — regardless of the product's language.
- **User-facing copy is never hardcoded** — it goes through i18n. Only the code/identifiers around it stay English.

## Naming
| Element | Convention | Example |
|---|---|---|
| Files and folders | camelCase | `userProfile.tsx`, `lib/auth/` |
| Variables and functions | camelCase | `fetchOrders()`, `isLoading` |
| Types / interfaces / classes | PascalCase | `User`, `OrderStatus` |
| Components | PascalCase | `Button`, `UserCard` |
| Constants | UPPER_SNAKE_CASE | `APP_NAME`, `MAX_RETRY_COUNT` |
| Event handlers | `handle*` | `handleSubmit()` |
| Hooks | `use*` | `useUser()` |
| Booleans | `is/has/can*` | `isOpen`, `hasError` |

Exception: framework-reserved filenames (e.g. Next.js `page.tsx`, `route.ts`) follow the framework.

## Typing
- **Strict typing always** (`tsconfig` `strict: true`; Python `mypy --strict`).
- Prefer `unknown` over `any`. **`any` and `@ts-ignore` are forbidden.**
- Explicit return types on public/exported functions; return types may be implicit for trivial local helpers.
- Non-null assertion (`!`) is a last resort.
- Reuse generated types (e.g. ORM-generated) instead of redefining schema shapes by hand.

## Constants & no magic values
- No repeated inline magic strings/numbers — extract to a constants module (`src/lib/constants.ts`): `ROUTES`, `APP_NAME`, analytics event names, etc.
- **Not magic numbers** (no constant needed): Tailwind utility values (`w-[360px]`, `gap-2`) and literals passed to clearly-named props (`size={20}`, `maxLength={50}`) — they are self-describing in place.

## Boundary validation
- Validate **all external input** (Server Actions, route handlers, public APIs, AI output) with schemas (Zod or equivalent). Centralize the schemas; don't inline them. Derive the TS type from the schema (`z.infer`).

## Imports
- Absolute alias `@/*` → `./src/*` (the mandatory source root — see `project-structure`). Avoid relative imports deeper than one level (`../../..`).
- Group imports: external libraries → internal modules → relative. Remove unused imports.

## Handlers
- **No inline logic in JSX** — use named handlers (`const handleClick = () => {…}`), not arrow bodies with multiple statements in the markup.

## Environment variables
- Keep `.env.example` in sync **in the same change** that introduces a new variable, grouped by section with a short comment on what it is for and how to obtain it.
- **Never commit real values or secrets.**

## Comments & commits
- Comments explain **why**, not what (and only when the code isn't already self-explanatory). Don't reference tickets/issues/epics in code.
- **Conventional Commits** with scope, in English: `feat(orders): add table selection`, `fix(api): handle null response`.
- Keep commits/changes **small and single-purpose** (one logical task). Never force-push a shared branch; never commit secrets or build artifacts (`.gitignore` them).

## Dependencies
- **Versions (DR-052)**: install the **latest stable** version for a new project/install (`@latest`). An in-flight project stays on the version it was built with (don't churn mid-build). For an **older/brownfield** project, install only versions **compatible with its framework major** — check support before adding (a Next.js 13 project must not get a library requiring Next 15+; pick the latest version still compatible).
- **Pin the package manager** via the `packageManager` field (+ corepack) so local, CI and agents use the same version; declare supported runtime in `engines`. **One package manager / one lockfile per repo.**
- **Justify every new dependency** before adding it (maintenance health, transitive footprint, license, bundle size); prefer the standard library / platform APIs. Remove a dependency the moment it's no longer imported.
