---
id: LESSON-0550
type: gotcha
domain: frontend
tags: [svg, css, grid, img, onerror, sizing, viewbox]
context: "rendering an SVG via `<img src=\"...\">` whose source file declares only `viewBox` (no explicit `width`/`height` attributes) inside a CSS grid cell sized `auto`, with the `<img>` itself using `width: auto; height: auto`"
trigger: use this when a logo/icon/decorative SVG rendered through an `<img>` tag inside an auto-sized grid/flex column silently disappears (no broken-image icon, no fallback text, no `onError` fired)
source: "funko-tracker .pandacorp/run/lessons.md (undated, agent-inferred) — an SVG with only a `viewBox` attribute, rendered via `<img>` with `width: auto; height: auto`, inside a CSS grid column track sized `auto`, computed to a 0x0 box and rendered nothing; `onError` never fired because the request succeeded and the image decoded fine — it just had no intrinsic size for the layout to resolve"
provenance: agent-inferred
created: 2026-10-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a logo SVG file declared a `viewBox` (e.g. `viewBox="0 0 120 40"`) but no `width`/`height`
attributes. Rendered through `<img src="logo.svg" style="width:auto;height:auto">` inside a CSS grid
whose column track was itself sized `auto` (deriving its size from its content), the browser had no
intrinsic size to anchor to: `viewBox` alone does not establish an intrinsic aspect ratio/size for an
`<img>` element the way it does for an inline `<svg>`, so both the image and the `auto`-sized grid track
collapsed to zero. The image request succeeded (200 OK, valid SVG, decodes fine) so `onError` never
fired — there was nothing a script-level error handler could catch, because nothing actually failed.

**Lesson:** an `<img>`-embedded SVG needs an intrinsic size the browser can use for layout BEFORE any
CSS `auto` sizing can resolve around it — `viewBox` alone is not that size when the element is an
`<img>` (as opposed to an inline `<svg>`, where `viewBox` does establish aspect ratio). Pairing "no
explicit size on the SVG file" with "no explicit size on the `<img>`" with "an `auto`-sized layout
container" produces a silent 0x0 render with zero error signal — not a broken-image icon, not a console
error, not an `onError` callback — making it look like the logo/asset is simply "missing" when it is
actually rendering at zero size successfully.

**Apply next time:** when embedding an SVG via `<img>` (not inline), ensure the SVG file itself declares
explicit `width`/`height` attributes (in addition to `viewBox`), OR give the `<img>` element its own
explicit CSS size (not `auto`) so the layout has something concrete to size around, OR give the
containing grid/flex track a non-`auto` size. Do not rely on `onError`/fallback-text wiring to catch this
class of failure — a zero-size successful render never triggers it; verify visually (or via a measured
bounding-box assertion in a visual/fidelity gate) that a logo/icon actually occupies non-zero space, not
just that its network request succeeded.
