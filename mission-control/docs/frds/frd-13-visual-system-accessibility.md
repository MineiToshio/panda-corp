# FRD-13 — Visual system and accessibility

Mission Control must feel **engineered, not decorative**, without the owner (weak at design) having to tune anything. The lever is **tokenized restraint**: few colors, few theme variables, restrained motion. Derived from the 2026 research (see [docs/proposals/06](../../../docs/proposals/06-improvement-plan-2026.md), Linear/Vercel Geist/Rauno references). It keeps the warm Anthropic-style palette already approved in the prototype.

## Acceptance criteria (EARS)

- The theme SHALL be derived from **few tokens in perceptual space** (OKLCH/LCH: base, accent, contrast) instead of dozens of loose hex values, so that touching the accent doesn't throw off the text contrast and a **high-contrast mode** can be enabled without a redesign.
- The UI SHALL use **a single rationed accent** (punctuation, not paint): accent only on what matters (active tab, working agent, XP bar); the rest, warm neutrals.
- EVERY number (XP, levels, per-column counts, stats, timestamps) SHALL use **`font-variant-numeric: tabular-nums`**.
- Elevation SHALL have **3 levels** (canvas → panel → card/popup) with a tokenized shadow/spacing scale (radius 8px, base 16px, hairline 1px, spacing in multiples of 0.25rem).
- Animation SHALL use **only `transform` and `opacity`**, duration **<300ms**, and apply the *frequency test*: what is seen dozens of times a day (tabs, hover) is restrained; the expressive is reserved for rare and satisfying events (achievement, level-up, completed work order). 2–3 easing tokens, not per-component curves.
- The UI SHALL honor **`prefers-reduced-motion`**: it disables all Party animation (long sessions → avoid fatigue).
- NO state SHALL depend on color alone: each state (working / idle / failed / completed) is paired with an **icon or shape + label** (critical with a warm palette, where reds/oranges/amber are close together).
- The accessibility SHALL comply: `aria-label` in Spanish on icons, `aria-live="polite"` to announce events without stealing focus, a visible focus ring that respects the `border-radius`, keyboard list navigation, **contrast ≥4.5:1** (a real risk with light warms).

## Non-goals (v1)
- It is not a publishable design system: it is Mission Control's internal system. It reuses shadcn/Tailwind as vocabulary.

## Relationship
It applies cross-cuttingly to all tabs (FRD-02 through FRD-06, FRD-10) and to the `prototype/index.html` prototype, which already incorporates `tabular-nums`, `prefers-reduced-motion` and visible focus as a base.
