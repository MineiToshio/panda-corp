# Implementation patterns

(For the default web stack; adapt the spirit to other stacks.)

## Server / Client (Next.js App Router)
- **Server Components by default.** `"use client"` only when needed: state/effects, browser APIs, event handlers.
- Keep client boundaries **minimal but coherent** (at the feature level, don't fragment into a thousand client components).
- **Server Actions first** for mutations triggered from the UI. Create `app/api/**/route.ts` only if: an external client/webhook consumes it, you need specific HTTP behavior, streaming/download, or it is machine-to-machine.
- **Treat every Server Action as a public endpoint.** It's a callable POST: authenticate and authorize **inside** the action, never assume the UI that called it already checked.

## Optimistic UI (default pattern)
- Update the client immediately; revert if the server fails.
- Close modals/sheets synchronously on submit (don't wait for the server response). The parent handles the rollback + error toast.

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
