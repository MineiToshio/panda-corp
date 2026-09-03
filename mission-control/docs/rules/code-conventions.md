---
description: Core code conventions — language, naming, strict typing, constants, imports, handlers, commits.
applies_when: always
globs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py"]
source: Pandacorp standard — conventions
---

# Code conventions

Mechanical rules (`any`/`@ts-ignore` bans, unused imports, import sorting, type-only imports…) are enforced by the canonical `biome.json` + `tsc --strict` — not repeated here; fix the gate's message, don't argue with it.

## Language
- Code is 100% English (identifiers, comments, logs, commits, file/folder names) whatever the product's language; user-facing copy is never hardcoded — it goes through i18n.

## Naming
| Element | Convention | Example |
|---|---|---|
| Files and folders | camelCase | `userProfile.tsx`, `lib/auth/` |
| Variables and functions | camelCase | `fetchOrders()`, `isLoading` |
| Types / interfaces / classes / components | PascalCase | `User`, `UserCard` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Event handlers / hooks / booleans | `handle*` / `use*` / `is,has,can*` | `handleSubmit`, `useUser`, `isOpen` |

Exception: framework-reserved filenames (`page.tsx`, `route.ts`) follow the framework.

## Typing (judgment on top of tsc strict)
- Prefer `unknown` at boundaries; explicit return types on exported functions (implicit is fine for trivial local helpers).
- Non-null assertion (`!`) is a last resort. Reuse generated types (e.g. ORM) instead of redefining schema shapes by hand.

## Constants & boundary validation
- No repeated inline magic strings/numbers — extract to `src/lib/constants.ts` (`ROUTES`, `APP_NAME`, event names). Self-describing literals stay in place: Tailwind values (`w-[360px]`), clearly-named props (`size={20}`).
- Validate ALL external input (Server Actions, route handlers, public APIs, AI output) with schemas (Zod); centralize schemas, derive the TS type via `z.infer`.

## Imports & handlers
- Absolute alias `@/*` → `./src/*`; avoid relative imports deeper than one level.
- No inline logic in JSX — named handlers (`handleClick`), not multi-statement arrows in markup.

## User-facing copy
- **No em dash (`—`), and no en dash (`–`) used as a sentence separator, in product copy** — UI/i18n strings, MDX pages, blog posts, metadata, and anything an automated content generator drafts. It is the most recognizable tell of AI-written prose; use a period, colon, comma or parentheses instead. A hyphen inside compound words and a middle dot (`·`) as a structural separator are fine. Where a content pipeline exists, `grep` its output for the two characters rather than trusting the guideline. (Code, technical docs and commit messages are out of scope.)

## Verified traps (each cost the same bug twice)
- **Never compare ISO-8601 timestamp strings lexicographically** to find the most recent one unless every producer stamps the identical offset AND identical fractional-second precision (`…42Z` sorts after `…42.920Z` as characters). Use `Date.parse` at the comparison point, or pin one format at every emitter of a stream you own.
- **`gray-matter@4`:** always `matter(content, { excerpt: false })`, never bare `matter(content)` — its LRU is keyed by the raw content string, so a repeat parse returns the cached result, and a first call that threw on bad YAML still poisons it into a silent `{ data: {} }`. `matter.stringify()` appends a trailing newline; normalize before diffing a round trip.
- **`git add <path>` refused as ignored on an already-tracked file** under a directory gitignored later (even when `git check-ignore` reports nothing for that path): use `git add -u -- <path>`, falling back to `git add -f -- <path>`. Never weaken `.gitignore` to work around it.

## Env vars, comments & commits
- Update `.env.example` in the SAME change that adds a variable (grouped, one-line "what / how to obtain"). Never commit real values or secrets.
- Comments explain **why**, not what; no ticket/issue references in code. Conventional Commits with scope, in English (`feat(orders): add table selection`); small single-purpose commits; never force-push a shared branch; never commit secrets or build artifacts.

## Dependencies
- Versions (DR-052): new project → latest stable (`@latest`); in-flight → don't churn mid-build; brownfield → latest still compatible with its framework major (check before adding). This governs which version to ADD; independently, **pin it exact in the lockfile (no `^`/`~`)** — same discipline as `web-security.md`'s Supply chain section, not limited to public-web projects: selecting `@latest` and pinning it exactly are not in tension.
- Pin the package manager (`packageManager` field + corepack); declare `engines`; one package manager / one lockfile per repo.
- Justify every new dependency (maintenance health, footprint, license, bundle size); prefer the standard library/platform; remove it the moment it's no longer imported.
