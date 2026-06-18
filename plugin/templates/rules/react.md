---
description: React component composition and rendering rules (framework-agnostic React).
applies_when: react
globs: ["**/*.tsx", "**/*.jsx"]
source: Pandacorp standard — patterns
---

# React

## Composition
- **Prop drilling ≤ 3 levels.** Deeper → React Context or a provider that lifts the state; don't thread props through intermediaries that don't use them.
- **Composition over boolean-prop explosion.** Each boolean prop doubles the component's possible states; past a couple, split into explicit variants or **compound components** (`<Card>` + `<Card.Header>`… sharing context) instead of `isThread`/`isEditing`/`isCompact` flags.
- **Generic context interfaces** when a component family shares state: shape it as `{ state, actions, meta }` so the same UI works with different state implementations (dependency injection).
- Keep components **small and focused** (single responsibility).

## Rendering correctness
- **Never use the array `index` as a list `key`.** Use a stable unique id from the data; if none exists, add one to the model before rendering a dynamic/large list.
- **Don't define components inside components** — they remount on every parent render. Hoist them to module scope.
- **Derive, don't sync.** Compute derived values during render; never mirror props/state into `useState` + `useEffect`.
- Constants that don't depend on props/state live **outside** the component.

## React 19 primitives (use them instead of hand-rolling)
- **Form action lifecycle → `useActionState`** (pending/error/result) instead of hand-managed `isLoading`/`hasError`/`isSuccess`; pair with `useFormStatus` for nested submit buttons.
- **Optimistic UI → `useOptimistic`**: it auto-reverts to the real state on settle/error — don't manually mirror-and-rollback with `useState`.
- **Read a promise/context in render → the `use` hook** (e.g. unwrap a promise passed from a Server Component) rather than `useEffect`+`useState` client fetching.

## Performance hygiene
- `useMemo`/`useCallback` only for genuinely expensive work or a stable identity a dependency array needs — **not by default**. If the React Compiler is enabled, prefer removing manual memoization it already handles.
- Extract event logic into named handlers (see `code-conventions`).
