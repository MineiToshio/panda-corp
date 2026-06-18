---
description: Styling and UI — Tailwind with cn(), design tokens, semantic HTML, accessibility, theming, responsive.
applies_when: tailwind
globs: ["**/*.tsx", "**/*.css"]
source: Pandacorp standard — patterns
---

# Styling & UI

## Tailwind
- Combine and conditionally apply classes with the **`cn()`** helper (clsx + tailwind-merge). Keep class lists readable and ordered (prettier-plugin-tailwindcss).
- App-wide patterns → `@layer components` in `globals.css`; area-specific patterns → scoped CSS for that area. Don't repeat long class strings.

## Design tokens (no hardcoded visuals)
- **Visual values come from the design tokens** (`docs/design/design-tokens.json`) — never hardcode colors, spacing or radii.
- Use **semantic** color variables (`bg-background text-foreground`), never fixed colors like `bg-white text-black`.

## Theming
- **Light and dark are both first-class.** Verify appearance and contrast in both themes when you build or change UI.

## Semantic HTML & accessibility
- Use semantic elements that convey meaning: `<button>` for actions, `<a>`/`<nav>` for navigation, `<main>`/`<section>`/`<header>`/`<article>` as appropriate. **No `<div onClick>`.**
- A native `<button>` is correct and preferred; wrap it only to reuse shared styles/behavior. Provide proper `type`, `aria-*` where needed.
- Touch targets ≥ 44px, WCAG AA contrast, visible focus states. Verify with axe-core.

## Responsive
- Every component must look correct on all device sizes — no overlap, overflow or clipping. Use `min-w-0` on flex children that should shrink.
- When one layout would be cramped on small viewports, use a **different component/pattern** for that breakpoint instead of forcing one layout to fit all.
