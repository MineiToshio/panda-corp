---
description: Styling and UI — Tailwind with cn(), design tokens, semantic HTML, accessibility, theming, responsive.
applies_when: tailwind
globs: ["**/*.tsx", "**/*.css"]
source: Pandacorp standard — patterns
---

# Styling & UI

## Tailwind (v4)
- Combine and conditionally apply classes with the **`cn()`** helper (clsx + tailwind-merge). Class ordering is enforced by **Biome's `useSortedClasses`** (run `biome check` in CI) — Biome is the standard format+lint tool; we don't use Prettier.
- App-wide patterns → `@layer components` in `globals.css`; area-specific patterns → scoped CSS for that area. Don't repeat long class strings.

## Design tokens (no hardcoded visuals)
- **Tokens are declared in the `@theme` block** of the global stylesheet (Tailwind v4's registry); each becomes a utility *and* a runtime CSS var. **Semantic** tokens (`--color-primary`, `bg-background text-foreground`) reference base tokens — never hardcode colors/spacing/radii, never fixed colors like `bg-white text-black`. (The design contract lives in `docs/design/design-tokens.json`.)
- **No arbitrary values** in committed code (`w-[37px]`, `text-[#abc]`); if a value is needed twice, promote it to an `@theme` token. The only accepted exception is `calc()` referencing a theme var.

## Visual coherence — one app, not a set of screens (DR-062)
- **Every new page, section, tab or panel must be visually consistent with the ones already built** — same scale and meaning for **colors, type sizes, spacing, radii, and component styles**. The owner must never feel they jumped between different apps when switching tabs/pages. Inconsistency here is a **defect**, the same class as a near-duplicate component.
- **Before styling a new surface, look at its siblings and reuse their values.** A title is the title size used elsewhere; a description uses the same muted-text token siblings use; a "card" (role/feature/item) reuses the established card style (padding, radius, title color); a labelled section reuses the established block tint + label color. Don't invent a parallel scale.
- **Prefer a shared primitive/token over a copied style constant.** When two surfaces show the same kind of thing (cards, rows, badges, section headers), factor the style into a shared component or token map and have both consume it — re-deriving the same look in two `*.styles.ts` files is how they drift (a card grid that says "blue title" in one tab and "amber title" in another is the bug this prevents).
- **Deviate only where genuinely justified** (an intentionally immersive view), and record why — never silently.

## Theming
- **Light and dark are both first-class.** Verify appearance and contrast in both themes when you build or change UI.

## Accessibility
- See **`accessibility.md`** — semantic HTML, keyboard/focus, forms, motion, WCAG 2.2. (UI work must satisfy it.)

## Responsive
- Every component must look correct on all device sizes — no overlap, overflow or clipping. Use `min-w-0` on flex children that should shrink.
- When one layout would be cramped on small viewports, use a **different component/pattern** for that breakpoint instead of forcing one layout to fit all.
