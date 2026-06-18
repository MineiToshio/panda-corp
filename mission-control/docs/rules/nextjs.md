---
description: Next.js App Router patterns — server/client boundaries, Server Actions, optimistic UI, error nets.
applies_when: nextjs
globs: ["app/**", "src/app/**"]
source: Pandacorp standard — patterns
---

# Next.js (App Router)

## Server / Client
- **Server Components by default.** Add `"use client"` only when needed: state/effects, browser APIs, event handlers.
- Keep client boundaries **minimal but coherent** — at the feature level, don't fragment into a thousand tiny client components.

## Mutations
- **Server Actions first** for mutations triggered from the UI. Create `app/api/**/route.ts` only when an external client/webhook consumes it, you need specific HTTP behavior, streaming/download, or it's machine-to-machine.
- **Treat every Server Action as a public endpoint.** It is a callable POST: **authenticate and authorize inside the action itself** — never assume the UI that called it already checked.

## Optimistic UI (default)
- Update the client immediately; revert if the server fails. Prefer React 19 **`useOptimistic`** (auto-reverts on error) over a manual mirror-and-rollback (see `react.md`).
- Close modals/sheets **synchronously** on submit — don't await the server response before dismissing.

## Caching & revalidation (Next 15+: opt-in)
- **`fetch` is uncached by default.** Cache **explicitly** (`fetch(url, { next: { revalidate: N } })` or `use cache`) and set `revalidate` just above the real freshness need — never cache by reflex, never leave it implicit.
- **After a mutating Server Action, invalidate** with `revalidateTag` / `revalidatePath`; tag cached reads so the action can target them. Don't serve stale reads.

## Streaming
- Wrap each independently-slow async Server Component in its **own `<Suspense>`** and push data access down to the smallest component that needs it; use route `loading.tsx` only for the whole-segment fallback.
- Keep `generateMetadata` **Server-only and fast** — a slow async metadata call blocks the route's stream; fetch heavy data in the page (under Suspense), not in metadata.

## States & rendering
- Always design **empty / loading / error** states; don't improvise them.
- **Don't add skeletons/loading props for UI the server already delivers** in the same navigation — it implies a client loading phase that isn't there.

## Global error net
- `app/global-error.tsx` (with its own `<html>`/`<body>`), an `error.tsx` per segment, and `not-found` per route — so no failure leaves a blank screen.
