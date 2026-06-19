# Design decisions — Mission Control

History and rationale for the design contract. The canonical token values live in `docs/design/design-tokens.json`; the human-readable contract in root `DESIGN.md`. This file records *how we got here and why*.

---

## 2026-06-19 — Complete the extraction: app-wide RPG skin + Party pixel-art spec (DR-056) — **FROZEN**

**What.** A completeness audit of the 2026-06-18 freeze found **two layers of the approved prototype were missed** (the core extraction captured palette/typography/categories/tiers/radii/shadows/base components, but not these). Added them to the contract under the DR-056 complete-extraction rule — **ADDING the missing layers, not rewriting the core**:

- **Layer 1 — the app-wide RPG embossed skin** (`design-tokens.json › rpgSkin`, new `## The app-wide RPG skin` section in `DESIGN.md`). The prototype applies a **global second-pass skin** (`index.html` 128–158, *"Skin RPG — GLOBAL"*) that **re-skins the base components** (`.panel`/`.cfgcard`/`.navitem`/`.cmd`) with the emboss signature (`inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--canvas)`, `1px bd2`, `10px` radius) and adds the RPG primitives: `.rpgpanel`, `.rpggrid` (22px texture), `.shield` (96×96 accent crest + glow), `.xpbar` (18px striped), `.herostat .big` (40px Pixelify numeral), `.lockchip`/`.reveal` (locked→hover/focus-reveal), `.secthead`, `.itemslot`, `.node`, `.sprite`, `.glowwarn`, `.anim`/`rpgIn`, `.spot`. **This skin is what actually renders app-wide** — the base `.panel` alone would silently drop the look.
- **Layer 2 — the Party pixel-art spec** (`design-tokens.json › party`, new `## The Party pixel-art spec` section). The two embedded sub-views are part of the contract, each with its OWN scale: **per-view sprite sizes recorded individually (Dashboard 54px / Fragua 52px / Campaña 58px — NOT averaged)**, scene grids (Dashboard 32px / Fragua·Campaña 30px), room sizes (Campaña 250×208 on a 920×560 stage), the sprite state machines (`s-work/s-review/s-blocked/s-idle/carry`; Fragua `work/review/carry/vault/split/say-on`; Campaña `idle/walking/small/locked`), the full keyframe inventory (`pcbob`, `mchalo`, `mceb`, `mcsay`, `mcdt`, `rpgIn`, `roompulse`, `idlebob`, `walkbob`, `cbob`, `slidein`, `halo`, `sayin`, `pulse`), and a new **`partyStructural`** token group capturing the ~10 hardcoded structural background colors (`#16201f #141b22 #16201d #0c1113 #1d2629 #26312f #202927 #1c2523 #2c3836 #2f4a3a #21342a #1c3a2a`) + the `rgba(12,17,19, α)` scrim family — so a tokens-only build reproduces the Party map backgrounds pixel-faithfully.

**Why.** DR-056 complete-extraction: base components + any app-wide skin/theme overrides + each embedded sub-view's own spec are ALL part of the contract; partial extraction silently drops the look (exactly the failure mode that re-occurred here — an app-wide RPG skin and a pixel-art sub-view spec were missed). The structural colors and the skin emboss are not "decoration" — they are the surface treatment the owner approved.

**Verified by grepping the prototype directly** (never read whole — `index.html` is 2.4MB): `index.html` lines 87–158 (party block + global skin block), `party-proposal.html` (Fragua) and `party-pipeline.html` (Campaña) for sprite/grid/room sizes, state classes and keyframe bodies. The `rgba(...)` emboss/scrim literals are theme-independent structural values — kept verbatim, NOT tokenized to a surface color.

**Ambiguity recorded (resolved as found).** The audit brief cited a **Fragua room of 432×372 and a 32px Fragua grid**. The CURRENT approved prototype (`party-proposal.html`, the redesign) actually uses a **920×560 stage with absolutely-positioned forge/vault rooms and a 30px scene grid** (no single fixed 432×372 room box). Recorded **as found in the prototype** (the source of truth), with a note in `party.roomSizes_px`. If the owner intends the older 432×372 framing, that is a prototype change to confirm — not a value to invent here.

**Impact / docs touched.**
- Canonical tokens → `docs/design/design-tokens.json` (added `rpgSkin` + `party` groups; core tokens untouched; JSON validated).
- Contract → root `DESIGN.md` (added `## The app-wide RPG skin` and `## The Party pixel-art spec` sections).

**Carried into the next phase (implementation, NOT done here).** `src/app/globals.css` and components must apply the `rpgSkin` overrides app-wide (not just the base `.panel`) and the Party sub-views must use their per-view sprite/grid/room sizes and the `partyStructural` colors. `src/`/`globals.css` were intentionally NOT touched — that is the implementer's job.

---

## 2026-06-18 — Re-anchor on the approved prototype (DR-054 ADOPT-VISUAL) — **FROZEN**

**What.** Froze the design system **FROM the owner-approved prototype `prototype/index.html`** (+ embedded sub-views `party-proposal.html` / La Fragua and `party-pipeline.html` / La Campaña). Extracted both themes (dark default + light) faithfully into `docs/design/design-tokens.json` and wrote the contract in root `DESIGN.md`.

**Why.** Mission Control's UI had **diverged from the approved prototype** (see factory memory: "Fallo de fidelidad de diseño en MC"). The build shipped a cold, generic look instead of the pixel-RPG identity the owner approved. DR-054 mandates that when an owner-approved visual exists, the designer's job is **fidelity, not novelty**: extract the real visual language, generate no alternative directions, relax nothing.

**Root cause — superseded brief.** `docs/design/brief.md` wrongly **demoted the prototype to a functional-only reference** and instructed the designer to **invent a fresh cold-blue palette (hue ~230)**. That invented palette is what landed in `src/app/globals.css` and caused the divergence. This decision **SUPERSEDES `docs/design/brief.md`** (kept for history with a banner; not deleted).

**Decisions taken (all = "reproduce the prototype exactly"):**

- **Two themes, both first-class.** Dark (default) + light, extracted verbatim from the prototype's `:root` and `[data-theme="light"]` blocks, including the `prefers-color-scheme: light` fallback.
- **Surfaces = 3 + 1 elevations.** `canvas / panel / card` everyday, plus `card2` (`#2A3336` dark / `#F1EFEA` light) — the 4th step the Party sub-views add for the pixel-art canvas.
- **One rationed accent** = the prototype's **teal/steel-blue** (`#33B6D1` dark / `#007890` light). Explicitly **NOT** the invented hue-230 cold-blue.
- **Three font families with distinct jobs:** Pixelify Sans (pixel/level numerals — the RPG signature), Space Grotesk (display/headings/buttons/tabs/nav), mono (code/ids/commands/paths). Both web fonts at weights 400/500/600/700.
- **Categories (9) + tiers (5)** preserved as the agent-hue and RPG-rarity ramps.
- **Pixel-art is part of the contract.** Zones + 54×54 agent sprites render with `image-rendering: pixelated` on a 32px grid; expressive motion (bob/halo/emote) is reserved for the Party canvas.
- **`tabular-nums` global**, 3 elevation shadows, focus ring `2px solid accent`.

**Provenance.** Frozen FROM `prototype/index.html` (+ `party-*.html`) on 2026-06-18. Token values verified by grepping the prototype directly (not only the supplied summary): the `:root`/`[data-theme]` blocks, the typography scale (sizes 9–42px, weights 400–700, line-heights), the padding/gap scale, and the component classes (`.panel`, `.card`, `.chip`, `button`, `.tab`, `.navitem`, `.mcstation`, `.mcag`). The exact light-theme tier values (`#757B81 #1C8742 #006EB8 #7C3EB3 #C26300`) and the `card2` 4th-surface step were extracted from the prototype, not assumed.

**Impact / docs touched.**
- Canonical tokens → `docs/design/design-tokens.json` (created/frozen).
- Contract → root `DESIGN.md` (created).
- `docs/design/brief.md` → **superseded** (banner prepended; kept for history).
- `docs/design/technical-assumptions.md` → costs of faithful reproduction (custom fonts, 19MB pixel-art assets, `image-rendering: pixelated`).

**Carried into the next phase (NOT implemented here — implementation is the build's job):**
- `src/app/globals.css` currently holds the **wrong** cold-blue (hue-230) tokens → must be replaced by the `@theme` mirror of `design-tokens.json`.
- Fonts (Pixelify Sans, Space Grotesk) must be wired via `next/font`.
- `prototype/assets/` must be staged into `public/` so the app serves the zones/sprites/logo.

**Fidelity note.** No values were invented, relaxed, or modernized. The contract is the prototype, transcribed.
