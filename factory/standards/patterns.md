# Implementation patterns

> Domain: Architecture/Design · Severity: **MUST** (Server-Action authz, semantic HTML, no hardcoded colors, error net) / **SHOULD** (the rest) · Enforcement: lint + CI gate + `reviewer`. Operative forms: `rules/react.md`, `rules/nextjs.md`, `rules/styling-and-ui.md` (DR-051).

(For the default web stack; adapt the spirit to other stacks.)

## Server / Client (Next.js App Router)
- **Server Components by default.** `"use client"` only when needed: state/effects, browser APIs, event handlers.
- Keep client boundaries **minimal but coherent** (at the feature level, don't fragment into a thousand client components).
- **Server Actions first** for mutations triggered from the UI. Create `app/api/**/route.ts` only if: an external client/webhook consumes it, you need specific HTTP behavior, streaming/download, or it is machine-to-machine.
- **Treat every Server Action as a public endpoint.** It's a callable POST: authenticate and authorize **inside** the action, never assume the UI that called it already checked.

## Data fetching & caching (Next.js App Router)
- **Fetch in Server Components**; push data access down to the smallest component that needs it. Waterfall avoidance and `React.cache()` per-request dedup are canonical in [performance.md](performance.md) — dedupe shared reads through ONE cached resolver, never re-derive (DR-092).
- **`fetch` is uncached by default (Next 15+)** — cache **explicitly** (`next: { revalidate: N }` / `use cache`), set `revalidate` just above the real freshness need, and **tag cached reads** (`next: { tags: [...] }`) so mutations can target them.
- **After a mutating Server Action, always invalidate**: **`revalidateTag` for data** shared across routes (the default — one tag invalidation reaches every consumer); **`revalidatePath` only when one route's full rendered output must refresh** (e.g. a page-level layout change). Never serve knowingly-stale reads after a mutation.

## Optimistic UI (default pattern)
- Update the client immediately; revert if the server fails.
- Close modals/sheets synchronously on submit (don't wait for the server response). The parent handles the rollback + error toast.

## Forms (Server Actions + `useActionState`)
- Forms post to a **Server Action via `<form action={...}>`**; pending/error/result flow through **`useActionState`** (+ `useFormStatus` for nested submit buttons) — never hand-managed `isLoading`/`hasError` state.
- **Progressive enhancement**: the form works before hydration — don't reimplement with `onSubmit` + `preventDefault` + client fetch what `action` gives for free.
- Validation failures come back as **typed state rendered inline** next to the fields (per [error-handling.md](error-handling.md) — expected failures are control flow, never thrown).

## Streaming & Suspense boundaries
- A Suspense boundary earns its place around each **independently-slow** async region — the static shell streams first, slow regions fill in. One giant boundary around the whole page is as bad as none.
- Route `loading.tsx` only for the **whole-segment** fallback; finer states get their own `<Suspense>`.
- Don't wrap fast, always-available UI in Suspense (a fallback flash for data the server already has — see performance.md's no-fake-skeletons rule).

## Client-state discipline
- **URL as state for shareable views**: filters, tabs, pagination, search — anything the owner might bookmark/share lives in `searchParams`, not `useState` (survives reload, back button works, Server Components can read it).
- **Local component state** for the rest; **React Context only for genuinely cross-cutting concerns** (theme, session, a compound-component family). Never Context as a general store.
- **No global state library by default** — adding one (Zustand, Jotai…) is a blueprint/ADR decision, not a reflex.

## Component composition (React)
- **Prop drilling ≤ 3 levels.** Deeper → React Context or a provider that lifts the state; don't thread props through intermediaries that don't use them.
- **Composition over boolean-prop explosion.** Each boolean prop doubles the component's possible states; past a couple, split into explicit variants or compound components (`<Card>` + `<Card.Header>`… sharing context) instead of `isThread`/`isEditing`/`isCompact` flags.
- **Never `index` as the list `key`.** Use a stable unique id from the data; if none exists, add one to the model before rendering a dynamic/large list.
- **Don't define components inside components** (they remount on every parent render). Hoist them to module scope.
- **Derive, don't sync.** Compute derived values during render; never mirror props/state into `useState` + `useEffect`.
- `useMemo`/`useCallback` only for genuinely expensive work or a stable identity a dependency array needs — not by default.
- Extract event logic into named handlers (see `conventions.md`); constants that don't depend on props/state live outside the component.

## Semantic HTML and accessibility
- `<button>` for actions, `<a>` for navigation, `<nav>/<main>/<section>/<header>` as appropriate. No `<div onClick>`.
- Touch targets: 44px design target; 24px is the fail-closed gate floor (WCAG 2.2 SC 2.5.8 — see [accessibility.md](accessibility.md)). WCAG AA contrast, visible focus states. Verify with axe-core.

## Theme and styles
- **Light and dark always**: use semantic color variables, never hardcoded colors (`bg-background text-foreground`, not `bg-white text-black`).
- Tailwind with the `cn()` helper (clsx + tailwind-merge). Ordered classes (Biome `useSortedClasses` — DR-052; never re-add Prettier).
- Visual values come from the **design tokens** defined in the design phase (`docs/design/design-tokens.json`).

## States and data
- Always design **empty / loading / error** states (don't improvise them).
- Analytics by default on key interactions (CTAs, navigation, forms, toggles); events centralized in constants, never loose strings. Don't track hover/every keystroke.

## Global error net (web)
- `app/global-error.tsx` (with its own `<html>`/`<body>`), `error.tsx` per segment and `not-found.js` per route — so that no failure leaves the screen blank. Verifiable by file presence in `verify.sh`. (`global-not-found` is experimental/optional.)

## How it is verified
- **Semantic HTML / no `<div onClick>` / list keys / components-in-components**: Biome `a11y` group + `react` domain rules (error, `verify.sh` lint gate).
- **Tap targets ≥24px**: axe `target-size` in the Responsive Gate (fail-closed, DR-074); contrast/focus → `reviewer` (review-only).
- **Hardcoded colors vs tokens**: Biome `useSortedClasses` keeps classes canonical; token compliance itself is checked by the design-token gate (DR-056 visual fidelity) + `reviewer` — a raw hex/`bg-white` in JSX is a review-blocking finding.
- **Error net**: file-presence check in `verify.sh` (global-error/error/not-found).
- **Server-Action authz, optimistic UI, composition limits, derive-don't-sync, empty/loading/error states**: review-only (`reviewer` correctness lens; states are also part of the FRD completeness checklist, DR-100).
- **Caching/revalidation discipline (explicit cache, tags, invalidate-after-mutation), forms via `useActionState` + progressive enhancement, Suspense placement, client-state discipline (URL as state, no default global store)**: review-only (`reviewer` correctness lens), partially backed by Biome's `next`/`react` domain rules; a mutation that never invalidates its cached reads is a blocking correctness finding.
- **Analytics on key interactions**: the event plan (`docs/analytics/events.md`) vs instrumentation is verified by the `analytics` agent at hardening (checklist).

## Why
These patterns are where AI-built web apps consistently go wrong at scale: unauthz'd Server Actions are the top real vulnerability class, client-boundary sprawl kills performance, and improvised empty/error states are the difference between "demo" and "product". Encoding them as defaults means each project starts from the proven groove instead of rediscovering it.
