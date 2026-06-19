# Technical assumptions — Mission Control design (ADOPT-VISUAL, DR-054)

What the **faithful reproduction** of the approved prototype (`prototype/index.html` + `party-*.html`) assumes from the implementation. The architect/build reads this; none are high-risk (Mission Control is an internal, read-only, local tool — no real-time backend, no offline, no server-side media generation, no third-party integrations). These are **cost/staging** notes, not feasibility blockers.

## 1. Two custom web fonts via `next/font`

- The contract requires **Pixelify Sans** (pixel numerals) and **Space Grotesk** (display) at weights **400 / 500 / 600 / 700**.
- The prototype loaded them from the Google Fonts CDN (`fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700`).
- **Assumption:** wire both via `next/font/google` (self-hosted, no runtime CDN call, avoids CLS per `web-performance.md`). Cost: low. Expose them as the `--pixel` / `--display` CSS vars the `@theme` mirror expects. `--mono` and `--body` are system stacks (no download).
- **Frequency test:** Pixelify is the *rare/expressive* face (numerals/badges) — keep its usage rationed; Space Grotesk is the everyday display face.

## 2. ~19MB of pixel-art assets to stage in `public/`

- `prototype/assets/` is **~19MB**: `zones/` (~12MB, 12 zone PNGs), `agents/` (~5.2MB, 13 sprite PNGs + grid sheets), `pandacorp.png` (~1.6MB logo).
- **Assumption:** these must be copied into `public/` (e.g. `public/assets/{zones,agents}/`, `public/pandacorp.png`) so the Next.js app serves them. They are part of the contract (the Party / La Fragua / La Campaña views), not optional decoration.
- **Cost / flag:** 19MB is heavy for a repo and for first paint. Mitigations for the build to consider (NOT for the designer to decide):
  - The logo (1.6MB) and individual zone PNGs are oversized for their on-screen size — re-export/optimize (the sprites are small pixel-art; they should compress hard).
  - The grid sheets (`grid.png`, `grid-v2.png`, `zones-grid.png`, `zones-grid-v2.png`) look like authoring sheets — confirm whether the runtime needs them or only the individual frames; drop the unused ones.
  - Pixel-art tolerates aggressive PNG quantization / lossless crush with no visible loss.
  - Lazy-load the Party canvas assets (they only appear on the Party view), not on the dashboard's critical path.

## 3. `image-rendering: pixelated` for sprites and zones

- The pixel-art identity depends on **`image-rendering: pixelated`** on agent sprites (`.mcag img`, 54×54) and zone backgrounds (`.mcstation .bg`), on a 32px scene grid.
- **Assumption:** supported in all evergreen browsers; no polyfill, no cost. Just don't let an image pipeline (e.g. `next/image` optimization/resampling) re-sample these and soften them — sprites should be served at integer scale with pixelated rendering, likely via plain `<img>`/CSS background rather than the optimizing `<Image>` for these specific pixel-art assets.

## 4. Both themes, theme switching

- Dark (default) + light are both first-class; the prototype resolves theme from `[data-theme]` with a `prefers-color-scheme` fallback. **Assumption:** a class/attribute theme toggle (no server round-trip). Cost: low.

## Not assumed / explicitly out of scope

- No real-time/collaboration, no offline, no server-side PDF/media generation, no heavy data export, no costly third-party integrations. The expressive sprite motion (bob/halo/emote) is pure CSS `transform`/`opacity`, gated by `prefers-reduced-motion` — no animation library required.
