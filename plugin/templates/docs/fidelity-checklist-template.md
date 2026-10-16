# Fidelity checklist — building <Product> exactly as designed

Status: frozen with the design (<YYYY-MM-DD>). Read this before building any screen and again before declaring it done. Source-of-truth order: `FRD > FDD + mocks > design tokens > blueprint > work order`. For how things look, the live prototype is the oracle: where a document disagrees with its CSS or JS, the prototype wins.

## Binding references

| What | Where | Use it to |
|---|---|---|
| Interactive prototype (whole app, every state through the DEMO panel) | `docs/design/prototype/<name>.html`; `?demo=off` hides every demo-only element, `?host=page` turns off host auto-detection (if the prototype has it), `?theme=light\|dark` pins the theme | behaviour, states, motion; **the oracle the gate renders live** |
| Self-hosted fonts | `docs/design/prototype/assets/fonts/` (files and licences; the `@font-face` rules in its `README.md`) | the build ships these exact files with the same rules (§ Fonts) |
| Portable CSS, split by component *(if produced)* | `docs/design/prototype/reference/css/*.css` | translate each component's rules exactly, including one-off geometry |
| Measured styles, state-complete | `docs/design/prototype/reference/computed-styles.json` (the toolkit's recorded `scope`; pareto: every state at 1280 light, layout states at 375 touch, dark with the colour properties; `full`: every state × width × theme) | the computed-style half of the gate |
| Oracle states | `docs/design/prototype/reference/oracle-states.json`: one entry per page state with its prototype recipe, build route, profile, seed, masks and viewports | the list of what the gate renders, and how to reach it on both sides |
| Fixtures | `docs/design/prototype/reference/fixtures/` | seed the build with exactly the data the prototype renders |
| Per-feature mocks and screenshots | `docs/frds/frd-NN-*/mocks/` + `fdd.md`; screenshots `<id>-<width>-<theme>.jpg`, rendered with `?demo=off&host=page` | build each screen; human side-by-side review (not the gate's reference) |
| Component catalogue (real markup, both themes) | `docs/design/prototype/components.html`, `reference/components-{light,dark}.jpg` | translate each component once, exactly |
| Tokens | `docs/design/design-tokens.json` | every value; never hardcode |
| Icons and logo (exact geometry) | `docs/design/prototype/{icons,logo}/*.svg` | use these files; no icon-library substitutes |
| Copy (every string, keyed) | `docs/design/<copy file>` | i18n strings verbatim |
| Fidelity toolkit | `<path of the toolkit copy in this project>` (`diff.mjs` and its capture library) | the reference implementation of the capture and comparison rules below |
| Images | `docs/design/prototype/assets/` | demo art and the gate's fixture photos; real images follow the credits policy |

## Fidelity target

The target is layered, measured and the same for every project; the owner approves it through one sentence: *"a simple vista no se distingue del prototipo, con fuentes y colores exactos"*. Source: `factory/standards/design.md` §5d (DR-129).

| Layer | What | Target |
|---|---|---|
| **L1 Typography and colour** | computed `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, text and background colours, border colours, shadow, opacity | **100% exact** |
| **L2 Geometry** | box sizes; spacing and radius; anchor offset of every floating panel from its trigger | **sizes exact; spacing and radius ±1 px; anchor offsets ±1 px** |
| **L3 Pixels** | each oracle state against the live prototype, in consecutive viewport-height slices | **per slice ≤ 0.5% of pixels differ** above YIQ threshold **0.1**, anti-aliased pixels ignored |
| **L4 Coverage** | every state the FDD lists | **100% of states × widths (375 touch / 768 / 1280) × themes (light / dark)**; axe **0 serious/critical** |

- **Comparator pinned: pixelmatch 7.x semantics** (`threshold: 0.1`, `includeAA: false`), exact version in the toolkit's lockfile. pixelmatch 8 changed the colour metric, so the numbers are not comparable across the major.
- **Gate mode: `blocking`** (the factory default, DR-129, which amends DR-072 for measured mismatches): a measured L1–L4 mismatch blocks the FRD. Judged nits (a reviewer's "looks off") stay advisory per DR-072, and leftovers below the bar go to `.pandacorp/comms/visual-punch-list.md` for the end-of-build Visual QA. `advisory` (a measured mismatch only goes to that punch list) needs the owner's decision recorded in `docs/design/design-decisions.md`. Whatever the mode, a missing or invalid capture is always RED (§ Fail closed).
- **No loosening without a measured flake.** A number above is relaxed only after the same render run twice on an unchanged build produced the difference, with both runs recorded. This project may tighten the numbers; the implementer never edits the prototype, the references, the fixtures, the oracle table, the tolerances or the gate (DR-080).
- **Product-specific additions:** <e.g. a stricter slice budget for the poster export; none>.

## Fonts

<Families, axes, weights, licence; delivery: self-hosted in the build with the same `@font-face` rules as the prototype (never a loader that renames the family or adds its own fallback faces). Baselines are blessed only after fonts load. Record the exact font-family stacks the build must produce.>

## Signature details that are easy to lose

1. <Detail> (`<selector>`): <what exactly, at which widths, in which themes>.
2. …

## How to verify (executable gate)

An FRD is not done until every check below passes for **every oracle state of that FRD** in `oracle-states.json` (which covers every route and state its FDD lists), at each listed viewport and theme. The gate renders the live prototype as its reference on every run; it never compares the build with its own earlier screenshots (a self-baseline may exist only as a regression guard after the oracle check passed).

**1. Where it runs, and failing closed.**
- Runs on <the owner's machine | the local build engine | CI> against a checkout that has <every private asset the gate needs>. <A worktree gets it from `<setup script>`, which fails when the main checkout lacks it.>
- **Fail closed.** A missing or empty asset pack, prototype, font file, reference file, fixture or browser, a prototype image still incomplete after the settle step, or a lost touch emulation makes the gate RED, never skipped and never a pass.

**2. Render conditions.**
- Viewports 375 (touch), 768, 1280; themes light and dark; device scale factor 1; one Chromium build for both sides; base viewport height 900 px. A state's `viewports` list restricts it.
- **Demo chrome off and host auto-detection off:** every prototype URL carries `?demo=off&host=page` (plus `&theme=<theme>`), whichever tool builds it. A capture taken without them is invalid whatever the diff says.
- **375 is a touch phone:** `isMobile` + `hasTouch`, plus CDP `Emulation.setEmulatedMedia` with `hover: none`, `any-hover: none`, `pointer: coarse`, `any-pointer: coarse`. A `matchMedia` probe taken with every capture must read `(hover: hover)` false and `(pointer: coarse)` true at 375, and the opposite at 768 and 1280; otherwise the capture fails.
- Theme: `prefers-color-scheme` emulated on both sides. The build runs in a fresh context with no stored theme choice.

**3. The two sides.**
- **Prototype:** `docs/design/prototype/<name>.html` opened from the repository (over `file://` with `--allow-file-access-from-files`, or the project's static server), then the state's recipe (setup code, fill, click, wait). Fonts and images load from `assets/`; nothing is fetched from the network.
- **Build:** seeded from `reference/fixtures/` exactly as its README says, with the fixture images served as **original bytes, unoptimised** (no image resizing, re-encoding or format conversion, same intrinsic size). The state is reached through its `build` column: route, profile, seed, test doubles and real actions (§ 8).

**4. Capture.**
- **Settle (both sides):** wait for `document.fonts.ready`; scroll through the document in 700 px steps to trigger lazy images, then back to the top; **force every lazy image to load and require every image complete** (8 s cap, then RED if one is still incomplete or broken); then 500 ms.
- **Full-height states: grow the viewport to the document height** (`max(scrollHeight)`, re-measured until stable, capped at 65,000 px) and screenshot the viewport; restore 900 px afterwards. **Never use Playwright `fullPage`**: it drops the touch emulation mid-capture.
- Overlay states (dialogs, sheets, menus): the 900 px viewport only.
- **Pause infinite animations** (spinners, shimmers) at `currentTime` 0 before reading styles or shooting; use `animations: 'disabled'` and `caret: 'hide'` on both sides so finite animations are at their end state.

**5. Pixel comparison (L3).**
- The two captures must have the same size; a height difference is a failure (layout drift), except below a masked region declared to differ in height.
- Cut each capture into consecutive **900 px slices** and compare slice by slice: YIQ threshold **0.1**, anti-aliased pixels ignored, at most **0.5%** of a slice's pixels may differ. Every slice must pass; one failing slice fails the state.
- **Masks** come only from the state's `masks` in `oracle-states.json`: the prototype selector for the mask and the build's `[data-oracle-mask="<kind>"]`. Read every matching box on each side after the settle step, rounded outward to whole pixels; the two sides' boxes must coincide within 1 px on every edge or the state fails as layout drift. **Paint them on the two captured PNGs, never in the page**: every pixel inside the union of the boxes becomes opaque magenta `#FF00FF` in both images, then the images are diffed (magenta appears in neither theme, so a mask that slipped shows up in the diff). Typical kinds: generated output, timers and countdowns, sample legal text. Product photos stay unmasked: a run with that mask on is a diagnostic only and never counts as a pass. Any other mask needs an FDD reason and a row in the oracle table.

**6. Computed-style comparison (L1, L2).**
- For every component and state in `computed-styles.json` that belongs to the FRD's routes, at each width and theme, read the build element's computed styles after the state's `read_after_ms` (normal motion settings, infinite animations paused) and compare with the recorded values for the root and every listed child.
- **Selector contract:** the build keeps the prototype's ids, class names and `data-*` / `aria-*` attributes on every recorded element and on the ancestors its selectors pass through, so the recorded selectors resolve unchanged (a utility-class-only build still adds them as semantic hooks). An element that cannot be resolved fails. A root or child recorded as `display: none` passes when the build element is absent or computes `display: none`.
- **Floating panels** (selects, menus, popovers, the phone menu): the panel's raw `position`, offsets and `transform` are **not** compared. Instead, in the open state, the offset of the panel box from its anchor box (dx and dy between the top-left corners of their `getBoundingClientRect()`) must equal the prototype's within **1 px**; the reference values are recorded on the recipe as `anchor_offset`. Every visual style of the panel and its children is compared as below. Panels render in place, never through a portal or a floating-positioning library.
- The compared properties are exactly those recorded in `computed-styles.json`:

| Group | Properties | Rule |
|---|---|---|
| Typography | `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `letter-spacing`, `text-transform`, `white-space`, `text-overflow` | exact |
| Colour and paint | `color`, `background-color`, `background-image`, border colours, `box-shadow` and `outline` colour, `opacity`, `filter`, `mix-blend-mode` | exact |
| Sizes | `width`, `height`, `min-height`, the bounding box `W×H`, border and outline widths, `grid-template-columns` tracks | exact |
| Spacing and radius | `padding`, `margin`, `gap`, `top`, `right`, `bottom`, `left`, `outline-offset`, `border-radius`, shadow offsets, blur and spread | within 1 px per length |
| Transforms | `transform`, `translate` | exact |
| Transitions | `transition` | same properties, durations and easing |
| Layout keywords | `display`, `position`, `z-index`, `visibility`, `cursor`, `object-fit`, border style | exact (floating panels: anchor-relative geometry above) |

**7. Accessibility (L4).** A separate run with reduced motion emulated: axe (WCAG 2.2 AA) on every oracle state after it settles, 0 serious or critical; no horizontal overflow at 320, 375, 768 and 1280.

**8. Test doubles for states the product reaches only with external effects.** Background jobs, auth providers, payments and slow requests are replaced, in gate and test builds only, by fixture-driven doubles the harness sets per state; the real service never runs in a gate state, and doubles are absent from production builds. Example, for an export job that renders a file:
- `generating`: an active job seeded with the state's frozen choices, restored on load; progress exactly as the prototype draws it.
- `ready`: a ready job with the expected part count, a creation time equal to the run's current time, an expiry later, and download URLs that serve **fixed reference files of the real intrinsic size** (a viewer's box depends on them, so a placeholder image would shift the layout); the generated image itself is masked, only its box must match.
- `failed`: never restored on load; the recipe presses the trigger and the double fails that job at once.
- `expired`: a ready job whose expiry is already past at the run's current time (or whose download answers 410), restored on load.

**9. The gate's report** lists, per state and context: the media probe, the host-detection probe, the slice results, the style mismatches (property, expected, actual), the floating-panel offsets (expected, actual) and the mask boxes used.

**Also checked, outside the numbers:** no hardcoded colours; icons come from the SVG set at the context size and stroke; strings identical to the copy file; every state the FDD lists is exercised, including any state specified only in text, built from the frozen components.
