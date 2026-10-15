# Fidelity checklist — building <Product> exactly as designed

Status: frozen with the design (<YYYY-MM-DD>). Read this before building any screen and again before declaring it done. Source-of-truth order: `FRD > FDD + mocks > design tokens > blueprint > work order`.

## Binding references

| What | Where | Use it to |
|---|---|---|
| Interactive prototype (whole app, every state through the DEMO panel) | `docs/design/prototype/<name>.html` | behaviour, states, motion, whole-app shell check |
| Per-feature mocks and screenshots (1280 and 375 px) | `docs/frds/frd-NN-*/mocks/` + `fdd.md` | build each screen; compare side by side |
| Component catalogue (real markup, both themes) | `docs/design/prototype/components.html`, `reference/components-{light,dark}.jpg` | translate each component once, exactly |
| Measured styles (light/dark × 1280/375) | `docs/design/prototype/reference/computed-styles.json` | compare numbers: size, weight, line height, spacing, radius, colour, shadow |
| Tokens | `docs/design/design-tokens.json` | every value; never hardcode |
| Icons and logo (exact geometry) | `docs/design/prototype/{icons,logo}/*.svg` | use these files; no icon-library substitutes |
| Copy (every string, keyed) | `docs/design/<copy file>` | i18n strings verbatim |
| Images | `docs/design/prototype/assets/` | demo art; real images follow the credits policy |

## Fonts

<Families, axes, weights, licence; delivery: self-hosted in the build. Baselines are blessed only after fonts load.>

## Signature details that are easy to lose

1. <Detail> (`<selector>`): <what exactly, at which widths, in which themes>.
2. …

## How to verify a screen

1. Render the route at 375 and 1280 px, light and dark, next to the mock.
2. Compare each component's computed styles with `computed-styles.json` (font size, weight, line height exact; spacing and radius within 1 px; colours exact).
3. No hardcoded colours, icons from the SVG set, strings identical to the copy file.
4. Exercise every state the FDD lists.
