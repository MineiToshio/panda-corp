# Implementation patterns

(For the default web stack; adapt the spirit to other stacks.)

## Server / Client (Next.js App Router)
- **Server Components by default.** `"use client"` only when needed: state/effects, browser APIs, event handlers.
- Keep client boundaries **minimal but coherent** (at the feature level, don't fragment into a thousand client components).
- **Server Actions first** for mutations triggered from the UI. Create `app/api/**/route.ts` only if: an external client/webhook consumes it, you need specific HTTP behavior, streaming/download, or it is machine-to-machine.

## Optimistic UI (default pattern)
- Update the client immediately; revert if the server fails.
- Close modals/sheets synchronously on submit (don't wait for the server response). The parent handles the rollback + error toast.

## Semantic HTML and accessibility
- `<button>` for actions, `<a>` for navigation, `<nav>/<main>/<section>/<header>` as appropriate. No `<div onClick>`.
- Touch targets ≥44px, WCAG AA contrast, visible focus states. Verify with axe-core.

## Theme and styles
- **Light and dark always**: use semantic color variables, never hardcoded colors (`bg-background text-foreground`, not `bg-white text-black`).
- Tailwind with the `cn()` helper (clsx + tailwind-merge). Ordered classes (prettier-plugin-tailwindcss or equivalent).
- Visual values come from the **design tokens** defined in the design phase (`docs/design/design-tokens.json`).

## States and data
- Always design **empty / loading / error** states (don't improvise them).
- Analytics by default on key interactions (CTAs, navigation, forms, toggles); events centralized in constants, never loose strings. Don't track hover/every keystroke.

## Global error net (web)
- `app/global-error.tsx` (with its own `<html>`/`<body>`), `error.tsx` per segment and `not-found.js` per route — so that no failure leaves the screen blank. Verifiable by file presence in `verify.sh`. (`global-not-found` is experimental/optional.)
