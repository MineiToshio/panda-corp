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
- Update the client immediately; revert if the server fails. The parent owns the rollback + error toast.
- Close modals/sheets **synchronously** on submit — don't await the server response before dismissing.

## States & rendering
- Always design **empty / loading / error** states; don't improvise them.
- **Don't add skeletons/loading props for UI the server already delivers** in the same navigation — it implies a client loading phase that isn't there.

## Global error net
- `app/global-error.tsx` (with its own `<html>`/`<body>`), an `error.tsx` per segment, and `not-found` per route — so no failure leaves a blank screen.
