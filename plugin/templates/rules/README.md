# Engineering rules — injectable library

Canonical, **project-injectable** engineering rules, split by purpose and technology (Cursor-`.mdc`-style). This folder is the **source**: `/pandacorp:scaffold` and `/pandacorp:architecture` copy the relevant files into a project's `docs/rules/`, and `/pandacorp:upgrade` keeps that copy in sync. They live in `docs/` (not `.pandacorp/`) on purpose — they are good practices any agent should follow, **whether or not the project is built with Pandacorp**.

These are the operative, portable form of the factory's `factory/standards/` (the long-form policy + rationale + verification). When a project-facing standard changes, its rule file here changes **in the same edit**, and `OVERLAY_VERSION` is bumped so every project picks it up (see the propagation contract: `factory/standards/README.md` + `DR-051`).

## How injection works

Each rule file declares in its frontmatter **`applies_when`** — a single token saying when it ships to a project:

| Token | Ships when… |
|---|---|
| `always` | every project, no condition (general best practices) |
| `typescript` | the project is written in TypeScript |
| `web-ui` | the project has a web UI |
| `react` | the stack includes React |
| `nextjs` | the stack includes Next.js (App Router) |
| `tailwind` | the stack includes Tailwind |
| `public-web` | a publicly reachable web app |
| `prisma` | the data layer uses Prisma |
| `next-intl` | i18n via next-intl |
| `posthog` | analytics via PostHog |
| `sentry` | error tracking via Sentry |

The copying skill reads the project's chosen stack (from `docs/product/architecture.md`) and copies every file whose `applies_when` is `always` **or** matches a technology the project actually uses. A React-only project gets `react.md` but **not** `nextjs.md`; a project without Prisma never sees `prisma.md`. After copying, the skill writes a `docs/rules/README.md` listing only the files that landed, and `CLAUDE.md`/`AGENTS.md` reference that folder.

## Catalog

| File | applies_when | What it covers |
|---|---|---|
| `code-conventions.md` | `always` | Language, naming, strict typing, constants, imports, handlers, comments/commits, env vars, deps |
| `clean-code.md` | `always` | File/function size, complexity, SRP/SoC, DRY (rule of three), dead code, purity, module boundaries, AI-legibility |
| `project-structure.md` | `always` | Mandatory `src/`, `core/`+`modules/`, single/multi-file folders, `_tests/`, feature-first, promotion |
| `quality-and-testing.md` | `always` | Green gates, TDD, risk-based coverage, test discipline (getByRole, isolation, no hard waits) |
| `documentation-and-decisions.md` | `always` | Canonical doc + decision log discipline, two-layer docs |
| `typescript.md` | `typescript` | `import type`, `satisfies`, discriminated unions + exhaustive switch, no unsafe `as`, const maps, `readonly` |
| `react.md` | `react` | Composition, prop-drilling limit, list keys, derive-don't-sync, React 19 primitives |
| `nextjs.md` | `nextjs` | Server Components, Server Actions + authz, optimistic UI, caching/revalidation, streaming, error net |
| `styling-and-ui.md` | `tailwind` | `cn()`, `@theme` tokens (no arbitrary values), light/dark, responsive |
| `accessibility.md` | `web-ui` | Semantic HTML, keyboard/focus, forms, motion, landmarks, WCAG 2.2 |
| `web-performance.md` | `web-ui` | Core Web Vitals, no waterfalls/dedup, runtime (long tasks, layout thrash, debounce, virtualization) |
| `web-security.md` | `public-web` | Authz, secrets, headers/CSP, injection (SSRF/XSS), rate-limit, supply-chain |
| `prisma.md` | `prisma` | Queries in the data layer, naming, DI of the client, transactions |
| `i18n-next-intl.md` | `next-intl` | Hooks in components, server helpers only outside React |
| `analytics-and-errors.md` | `posthog` / `sentry` | Centralized PostHog events; Sentry only for unexpected errors, PII-redacted |

> Each file is self-contained and tool-agnostic (plain Markdown with a small frontmatter; the `globs` field also makes them drop-in Cursor rules). When in doubt, follow the spirit; recurring decisions are governed by the factory's decision registry.
