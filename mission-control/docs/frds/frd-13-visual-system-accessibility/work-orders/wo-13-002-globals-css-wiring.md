# WO-13-002 — globals.css wiring (themes, elevation, motion, reduced-motion, focus)

**Components/Interfaces:** `CMP-13-globals`, `IF-13-theme-vars` · **Traces:** REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-006
**Deploy unit:** global styles · **Location:** `app/globals.css`

## Acceptance criteria (verbatim EARS)
- AC-13-001.1: Theme from few OKLCH tokens; high-contrast mode without redesign.
- AC-13-002.1: A **single rationed accent** (punctuation, not paint); the rest warm neutrals.
- AC-13-004.1: 3 elevation levels with a tokenized shadow/spacing scale.
- AC-13-005.1: Animation only `transform`/`opacity`, <300ms, 2–3 easing tokens.
- AC-13-006.1: The UI SHALL honor `prefers-reduced-motion`: disables ALL Party animation.

## Scope
- Map the frozen `design-tokens.json` into Tailwind v4 `@theme` CSS variables (OKLCH base/accent/contrast; light/dark/high-contrast via `color-scheme` + a data-attr/class).
- Define the 3 elevation levels (canvas/panel/card) as tokenized shadow + radius (8px) + spacing (0.25rem multiples) + hairline (1px).
- Define the motion tokens (durations <300ms, 2–3 easings) as CSS vars; document that animations use only `transform`/`opacity`.
- `@media (prefers-reduced-motion: reduce)`: zero animation durations/transitions globally (the Party engine additionally skips its RAF loop in FRD-06 WO-06-011).
- Visible focus ring var that respects `border-radius`.

## Dependencies
- WO-13-001 (validated token shape), frozen `docs/design/design-tokens.json` (values).

## TDD / Definition of done
- CSS is not unit-tested directly; verification is via the design-phase a11y report (axe-core) + consuming component tests. DoD: the theme vars exist for light/dark/high-contrast; switching the theme attribute changes the resolved vars; the reduced-motion media query is present; biome/tsc clean (no JS). Build succeeds.
