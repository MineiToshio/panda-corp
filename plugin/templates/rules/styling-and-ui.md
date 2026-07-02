---
description: Styling and UI — Tailwind with cn(), design tokens, semantic HTML, accessibility, theming, responsive.
applies_when: tailwind
globs: ["**/*.tsx", "**/*.css"]
source: Pandacorp standard — patterns
---

# Styling & UI

(Class ordering is mechanical — Biome `useSortedClasses` in the canonical `biome.json`; fix the gate's message, don't argue with it. Biome is the format+lint tool; no Prettier.)

## Tailwind (v4)
- Combine/conditionally apply classes with **`cn()`** (clsx + tailwind-merge).
- App-wide patterns → `@layer components` in `globals.css`; area-specific → scoped CSS for that area. Don't repeat long class strings.

## Design tokens (no hardcoded visuals)
- Tokens live in the **`@theme` block** (Tailwind v4 registry); **semantic** tokens (`--color-primary`, `bg-background text-foreground`) reference base tokens. Never hardcode colors/spacing/radii; never fixed colors like `bg-white text-black`. (Contract: `docs/design/design-tokens.json`.)
- **No arbitrary values** in committed code (`w-[37px]`, `text-[#abc]`); a value needed twice becomes an `@theme` token. Only exception: `calc()` referencing a theme var.

## Visual coherence — one app, not a set of screens (DR-062)
- Every new page/section/tab/panel must be visually consistent with siblings — same scale and meaning for colors, type sizes, spacing, radii, component styles. Inconsistency is a **defect**, same class as a near-duplicate component.
- Before styling a new surface, look at its siblings and reuse their values (title size, muted-text token, established card/section style). Don't invent a parallel scale.
- Prefer a shared primitive/token over a copied style constant — re-deriving the same look in two `*.styles.ts` files is how they drift.
- Deviate only where genuinely justified (an intentionally immersive view), and record why — never silently.

## Theming, accessibility, responsive
- Light and dark are both first-class: verify appearance and contrast in both when you build or change UI.
- UI work must satisfy **`accessibility.md`** (semantic HTML, keyboard/focus, forms, motion, WCAG 2.2).
- Every component looks correct at all sizes — no overlap/overflow/clipping; `min-w-0` on flex children that should shrink. When one layout would be cramped on small viewports, use a **different component/pattern** for that breakpoint instead of forcing one layout to fit all.
