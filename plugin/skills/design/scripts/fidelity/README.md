# Design-freeze fidelity tools

Node-only tools that turn the frozen whole-app prototype into the fidelity references the build is checked against:
portable CSS, measured computed styles, per-FRD mocks, whole-app screenshots, the component catalogue, and the
comparator the build gate reuses. One config per project drives all of them, and the design phase's other two tools
read the same file: `docs/design/freeze/fidelity.config.json` (schema: `config.schema.json`, example:
`fidelity.config.example.json`). `../preflight-round.mjs` takes its thresholds from `preflight`;
`../check-design-gate.mjs` validates the whole file against the schema and reads `widths`, `themes` and `states`.

```bash
# from the project root
node "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/fidelity/freeze.mjs" all
node ".../freeze.mjs" shard --only frd-03     # one FRD's mocks
node ".../freeze.mjs" measure --all-states    # the full matrix instead of the scope cap
```

## Pipeline

| Stage | Module | Writes | Needs |
|---|---|---|---|
| `split` | `split-css.mjs` + `tokens.mjs` | `<prototype dir>/reference/css/*.css` + `README.md` (load order, verification, per-file table); `docs/design/freeze/split-report.json` (order, families, rule counts, id rules); `docs/design/design-tokens.json` (the custom properties per theme, grouped, plus `overrides`; curated keys such as `fonts` are kept) and a dated entry in `docs/design/design-tokens-history.json` when the set changed | the prototype |
| `measure` | `measure.mjs` (+ `measure-page.mjs`) | `reference/computed-styles.json`, `reference/components/*.png`; `freeze/measure-cache.json` (per component: input hash, records, DOM snapshots) | the prototype |
| `shard` | `shard.mjs` | `docs/frds/<frd>/mocks/<slug>.html`, `mocks/screenshots/<id>-<width>-<theme>.jpg`; `freeze/shard-cache.json` | split |
| `screens` | `screens.mjs` | `<prototype dir>/screenshots/<prefix>--<screen>--<width>--<theme>.jpg` | the prototype |
| `catalog` | `catalog.mjs` | `<prototype dir>/components.html`, `reference/components-<theme>[-N].png`, the `exports` files; `freeze/components-sheet.json`, `freeze/exports.json` | split, measure |
| `identity` | `identity.mjs` | nothing (a check): the prototype with its `<style>` replaced by `<link>`s to `reference/css/` must render pixel-identical | split |

`freeze.mjs <stage|all> [--only <frd>] [--all-states] [--all] [--force] [--workers N] [--config file]` runs them in
that order on one shared browser. It is resumable: `docs/design/freeze/state.json` records, per stage, the status,
the input hash (prototype + assets + the config sections the stage reads + the tools' own code), the output hash, the
duration and a summary, plus the last 20 runs. A stage whose inputs did not change since its last success, and whose
outputs exist, is skipped (`up-to-date`). A failed stage marks its dependents `blocked`; independent stages still run;
the exit code is 1. `--force` re-runs stages anyway; `--all` also ignores the measure and shard caches.
Exit codes: 0 green, 1 a stage failed, 2 bad usage or config, 3 no browser.

Inside a stage the work is incremental too: `measure` hashes each component's inputs (its config, its floating
panels, the scope, the prototype and the measuring code) and re-measures only the components whose hash changed;
`shard` does the same per FRD.

Other modules: `config.mjs` (load, validate against the schema, defaults, paths, hashes), `tokens.mjs` (the token
extraction: `:root` is the first theme, `[data-theme="<theme>"]` that theme, a `prefers-color-scheme` block fills what
the attribute block leaves out, every other custom-property rule is an override with its selector and context), `lib.mjs` (the capture
protocol), `pool.mjs` (the worker pool and staged writes), `cssparse.mjs` (the CSS tokenizer), `pixels.mjs` (the YIQ
metric and in-Chromium decoding), `diff.mjs` (the comparator). The legacy `../shard-prototype.mjs` and
`../measure-components.mjs` are wrappers that convert their old config shape and call these stages.

## Capture protocol (`lib.mjs`)

- **Launch:** `PLAYWRIGHT_MODULE` (the `playwright` package directory or its `index.mjs`), else `playwright` from the
  normal module path; `CHROME_PATH` (a Chromium or headless shell), else Playwright's bundled browser. Launched with
  `--allow-file-access-from-files`. The project root is `FIDELITY_ROOT`, else `PROJECT_ROOT`, else the current directory.
- **URLs:** every prototype URL gets the demo-off param (`demo=off`), the theme param (`theme=<theme>`) and the host
  param (`host=page`), on top of the route's own query (`?session=out#screen`).
- **Touch:** widths below `touchBelow` (768) are phones: Playwright `isMobile` + `hasTouch`, plus CDP
  `Emulation.setEmulatedMedia` `hover`/`any-hover: none`, `pointer`/`any-pointer: coarse`. Re-asserted after every shot.
- **Probe:** every capture records `hover`, `coarse`, `hostAuto`, the theme and (when `probe.demoOff` is set) demo-off.
  A capture fails when the `hostAutoClass` (`host-auto`) is on `<html>`, when demo scaffolding is on, or when a phone
  width lost the touch branch.
- **Full height:** the viewport is grown to the document height (capped at `maxCaptureHeight`) and shot, never
  Playwright `fullPage` (its `captureBeyondViewport` drops the touch emulation). A state with `capture: "viewport"`
  (an overlay, or a popover that closes on scroll or resize) is settled before its actions and shot as is.
- **Settle:** fonts ready; lazy images forced eager (the `loading` attribute is put back, so DOM snapshots are
  unchanged); every image decoded (at most `imageTimeoutMs`); an optional scroll pass (`settle.scrollPass`, for
  scroll-triggered content); `waitMs`. Then **fail-closed**: any visible `<img>` not decoded throws, listing its `src`.
- **Animations:** screenshots use Playwright `animations: 'disabled'` (finite ones finished, infinite ones cancelled).
  Measurements pause infinite animations at `currentTime` 0 and finish the finite ones; a record whose own property an
  endless animation drives is flagged `animated: "infinite"`.
- **Warm contexts:** each worker keeps one context per width x theme and prefers units of the context it holds. A
  page whose document is untouched moves to the next route by `location.hash`; any setup, state or snapshot makes it
  dirty and the next unit does a full load. Every navigation starts with empty Web Storage (an init script) and the pointer parked outside the page (a previous unit's click would otherwise leave `:hover` on whatever sits under it).
- **Pool:** P workers (`workers`, default 4; `FIDELITY_WORKERS` or `--workers` override) on one browser. A timeout or a
  crashed page is retried once on a fresh context; any other failure stops the batch.
- **Atomic writes:** captures go to a temporary staging folder; the repository folders change (stale files of the
  stage's own naming pattern removed, new ones copied) only after every capture of the batch succeeded. Text outputs
  are written only when their content changed.

## Config (`config.schema.json`)

| Key | Default | What |
|---|---|---|
| `prototype` | required | The frozen prototype, e.g. `docs/design/prototype/app.html`. |
| `widths`, `touchBelow`, `themes` | `[375,768,1280]`, `768`, `["light","dark"]` | The capture matrix. |
| `params` | `{demoOff: "demo=off", host: "host=page", theme: "theme"}` | URL params; `""` disables one. |
| `hostAutoClass`, `probe` | `host-auto`, `{}` | What the probe fails on. |
| `screens` | every `[data-screen]` not `data-demo-only` | Route ids of the whole-app set (`"id"` routes `#id`; or `{id, route, widths}`). |
| `css` | heuristic only | The component map: `families` (load order), `rules` (regex on the key selector, first match wins), `overrides` (by normalised prelude), `verbatim` blocks, `closingComments`, `prefixStrip`, `unmatched` (`heuristic` or `fail`), `numbered`. |
| `states` | `{}` | Per FRD folder: `{id, title, route, actions?, settleMs?, widths?, capture?, note?}`. Actions run in order: `click` (real), `domClick` (`element.click()`), `fill [sel, value]`, `wait ms`, `waitFor sel`, `scroll y|sel`, `removeAttr [sel, name]`, `setAttr [sel, name, value]`, `js`. |
| `shard` | dialogs only | `extras` (overlays shown below a screen), `strip` (demo-only markup), `gateAttributes`, `sectionAttributes`, `htmlAttributes`, `jpegQuality`. |
| `components` | `[]` | `{name, route, root, children?, pre?, show?, note?, states}`; a state: `force`, `attr`, `cls`, `js`, `click`, `spre`, `scroll`, `route`, `root`, `wait`, `widths`, `layout`. Target `$` = root, `$ sel` inside it, `doc:sel` anywhere. |
| `floating` | `[]` | `{component, state, panel, anchor}`: recorded as `anchor_offset` (panel box minus anchor box, `top_left` and `top_right`, viewport px). |
| `scope` | `{mode: "pareto"}` | The scope cap, below. |
| `workers` | `4` | P. |
| `catalog`, `identity`, `diff`, `screenshots` | see schema | Sheet height cap; identity screens, widths, theme, attempts; comparator thresholds; screenshot prefix and quality. |
| `exports` | none | JS expression evaluated in the prototype returning `{relativePath: content}` (icon and logo SVGs). |
| `tokens` | built-in groups | `groups`: `[{group, match}]`, regexes on the token name checked before the built-in prefixes (typography, space, radius, stroke, zIndex, motion, elevation, brand, color). |
| `preflight` | see `../preflight-round.mjs` | `minFontPx`, `textWidths`, `overflowWidth`, `demoSelectors`, `demoText`, `maxLiteralColors`, `maxLiteralLengths`, `screens`, `skipScreens`, `smallTextIgnore`. |

**What the design gate requires from this file.** The mock matrix is `widths` x `themes` (the defaults above when
omitted); a mock state's own `widths` (in `states`) narrows it for that id, and every configured state id must have
its `<id>-<width>-<theme>.jpg` set. The measured styles are checked against the scope `computed-styles.json` records
(pareto: the default state of each component at the touch and primary widths in every theme). A component with a
`note` is exempt from the width and 0x0 checks. Per-mock widths live only on the state: there is no separate `mocks`
block.

## The scope cap

The full matrix (every state x width x theme, 44 properties each) is rarely worth its cost: hover and focus states
look the same at every width, and dark mode changes colours, not layout. The default `pareto` scope measures:

- every state at the **primary width** (the widest) in the **primary theme** (the first), all properties, with an image and the catalogue's DOM snapshot;
- **layout states** at the **touch width** (the narrowest), all properties: every state except one made only of forced pseudo-classes (`force` with no click, toggle, code or scroll; override per state with `layout: true|false`);
- the **other themes** with the **colour properties only** (`color`, backgrounds, borders, `box-shadow`, `outline`, `filter`): every state at the primary width, the default state at the touch width;
- **component images** at the touch and primary widths in the primary theme, plus the other themes for the default state only.

Widths in between (768) are not measured; the shard and screens stages still capture every width x theme. A state
restricted by `widths` to other widths is measured at its widest allowed width. `--all-states` (or `scope.mode: "full"`)
measures the full matrix. `computed-styles.json` records the scope used, and the comparator only compares the
properties a reference record holds.

## Comparator (`diff.mjs`)

```bash
node diff.mjs pixels reference.png candidate.png [--slice 900] [--threshold 0.1] [--max-ratio 0.005] [--no-mask]
node diff.mjs styles reference/computed-styles.json candidate/computed-styles.json [--component Name]
```

- **Pixels:** both images are decoded in Chromium (PNG or JPEG) and compared per slice of `--slice` px (the viewport
  height): the pixelmatch 7 YIQ metric (ported, ISC; checked equal to pixelmatch 7.2.0 on random images), threshold
  0.1, anti-aliased pixels ignored, reference pixels in pure magenta (#FF00FF) masked out. A slice fails above 0.5%
  differing pixels; a size mismatch fails.
- **Styles:** typography, colour and size exact (numeric noise below 0.01 px ignored); padding, margin, gap, insets and
  `outline-offset` within 1 px; `border-radius` within 1 px; anchor offsets within 1 px; a missing component, state or
  child fails.
- Output: a JSON report on stdout; exit 0 pass, 1 differences, 2 bad input. `diffStyles` and `diffPixels` are exported.

## Timing

`T ~ boot + sum over stages of (units x t / P)`: `boot` is the browser start (under 1 s), `units` the page loads of a
stage (printed in the summary), `t` the time of one unit, `P` the workers. The work is dominated by the protocol's
fixed waits (the state wait, settles), not CPU, so `T` scales close to `1/P` up to about one worker per core.

Measured on a large single-file prototype (funko-tracker: 600 KB HTML, 24 screens, 119 components / 312 states,
9 floating panels, 8 FRDs / 64 mock states), pareto scope, P = 4, Apple silicon, from scratch:

| Stage | Units | `t` per unit | Wall |
|---|---|---|---|
| split | (no browser) | | 0.04 s |
| measure | 363 page loads, 945 records | 4.6 s (a load plus about 2.6 states at about 1.7 s each) | 415 s |
| shard | 348 captures (64 states x widths x themes, shared states captured once) | 2.3 s | 199 s |
| screens | 144 captures | 1.7 s | 62 s (35 s at P = 8) |
| catalog | 2 sheets (a 78,000 px page, 3 parts each) | 9 s | 9 s |
| identity | 8 screen x width pairs | 6.2 s | 12.5 s |
| **total** | | | **698 s** (about 12 min) |

`docs/design/freeze/state.json` keeps the real durations of the last runs; use them to plan. Re-runs after a small
edit are much cheaper: unchanged stages are skipped (a no-op `all` takes milliseconds), `measure` re-measures only
changed components while the prototype is unchanged, and `shard --only` re-shards one FRD.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `freeze: Playwright not found` (exit 3) | `npm i --prefix "$TMPDIR/pw" playwright` and `export PLAYWRIGHT_MODULE="$TMPDIR/pw/node_modules/playwright"`; set `CHROME_PATH` to an installed Chromium or headless shell to skip the browser download. |
| `N visible image(s) did not load` | A broken or missing asset path: fix the prototype. Nothing was written. |
| `touch emulation lost` | Something re-emulated the media mid-capture (a `fullPage` screenshot, an `emulateMedia` call). The protocol re-asserts after each shot; a custom action must not change the emulation. |
| `host-auto class ... was on` | The prototype switched to its auto-height host mode on a tall viewport: it must honour the host param (`host=page`), or set `params.host`/`hostAutoClass` to match it. |
| `css split is not complete` | The splitter dropped or duplicated a rule (an unbalanced brace, a rule inside an unsupported at-rule). The counts and the first missing/extra rules are printed; nothing was written. |
| `match no family` | `css.unmatched` is `fail` and a rule matches no `css.rules` entry: add a rule or an override. |
| `identity: N of M captures differ` | The load order changed the cascade: two families with equal-specificity rules on the same element are in the wrong order. Reorder `css.families`, or move one rule with an override. |
| `measure: N state(s) failed` | A root or state target is missing (the list says which). Successful components are cached; fix the config and re-run: only the failing ones are measured again. |
| A stage re-runs every time | Something under the prototype folder changes on every run (a generated file the tools do not know): move it out or regenerate it from `exports`. |
| Slow runs | Raise `workers` (CPU bound; about one per core), lower `settle.waitMs`, keep `scope.mode` at `pareto`, and avoid `pre` code on components (each `pre` state is its own page load). |
