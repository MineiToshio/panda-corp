# Mission Control — Design Contract

> **Frozen FROM the approved prototype `prototype/index.html`** (+ `prototype/party-proposal.html`, `prototype/party-pipeline.html`).
> **Mission Control's pixel-RPG / "guild" identity is intentional and owner-approved.** Mission Control is the factory's own internal tool — its pixel-RPG look is its real identity, NOT a generic default and NOT a template for product apps. (The standing rule "never reuse Mission Control's RPG style" applies to *other* product apps, never to Mission Control itself.)
>
> Re-anchored 2026-06-18 under DR-054 (ADOPT-VISUAL). The job here was **fidelity, not novelty** — this contract extracts the prototype's real visual language; nothing was invented or modernized. The canonical token values live in `docs/design/design-tokens.json`; this file is the human-readable contract on top.

## Source of truth

- **Tokens (machine):** `docs/design/design-tokens.json` — the build reads this; `src/app/globals.css` `@theme` mirrors it.
- **Visual (binding):** `prototype/index.html` defines BOTH a dark theme (default) and a light theme; `party-proposal.html` (La Fragua) and `party-pipeline.html` (La Campaña) are embedded sub-views and are **part of the contract** (pixel-art zones + agent sprites).
- **Hierarchy:** FRD > FDD > **design-tokens** > blueprint > work order.

## The system — "Atelier"

A warm-dark, dense, gamified guild console. Not corporate, not a uniform grid: the factory rendered as a workshop/guild where agents (sprites) work in pixel-art zones.

### Themes — both first-class

**Dark (default)** and **light** are both first-class and must both be verified for appearance and AA contrast. Theme resolves from `[data-theme]`, falling back to `prefers-color-scheme`.

### Surfaces — elevation (warm dark, 3 + 1)

Three everyday elevation steps plus a fourth reserved for the pixel-art Party canvas:

| Token | Dark | Light | Use |
|---|---|---|---|
| `canvas` | `#0F1517` | `#F8F7F3` | App background |
| `panel` | `#192123` | `#FEFDFA` | Sections / panels |
| `card` | `#222A2D` | `#FFFFFF` | Cards / raised content |
| `card2` | `#2A3336` | `#F1EFEA` | 4th step — Party pixel-art canvas only |

### Text & borders

- Text: `t1` (primary) → `t2` (secondary) → `t3` (muted).
- Borders: `bd` (hairline, `.5px`/`1px`) → `bd2` (stronger).

### Accent — rationed (punctuation, not paint)

**One** steel-blue accent (`#33B6D1` dark / `#007890` light) used as punctuation: active tab/nav, focus ring, hover glow. `accentBg` + `accentText` for the "on" state. Never wash the UI in it.

> Note: this teal/steel-blue accent is the prototype's REAL accent. It is NOT the invented cold-blue (hue-230) palette from the superseded brief — see Prohibitions.

### Status — by color AND icon/shape

`ok` / `warn` / `danger` / `info`, each with a paired `*-bg`. Status is never color-alone: pair with an icon or text label.

### Categories (9) & tiers (5)

- **Categories** `cat1..cat9` — per-agent / per-domain hues.
- **Tiers / rarity** `tier1..tier5` — gris → verde → azul → morado → naranja (the RPG rarity ramp).
- **Trace palette** `trace1..trace10` (DR-087a, NOT from the prototype extraction) — a 10-color **desaturated, harmonious** categorical set used ONLY to recolor highlighted lines on the Observabilidad **DAG** when a work order is selected, so crossing/converging lines stay traceable (each highlighted line a distinct hue; repeats across distant ones are fine). Desaturated so it never competes with the saturated status colors; both themes verified for AA. At rest DAG edges are uniform accent — `trace*` only appears on selection.

### Radii & shadows

- Radii: `sm 8` · `md 12` · `lg 16` · `pill 999`. (Cards use 9px, buttons/tabs 8px — extracted as-is.)
- **3 elevation shadows**: `shadow` (resting), `shadow-pop` (popovers/modals). Subtle inner highlight (`inset 0 1px 0 rgba(255,255,255,.04–.06)`) on cards/buttons for the embossed feel.

## Typography — three families, each with a job

| Family | Token | When |
|---|---|---|
| **Pixelify Sans** | `--pixel` | Pixel/level numerals, XP, tier/rarity badges — the gamified RPG signature. |
| **Space Grotesk** | `--display` | Display, headings (h1/h2/h3), buttons, tabs, nav, card titles. |
| **mono** (`ui-monospace`) | `--mono` | Code, ids, command strings, paths (`/pandacorp:*`, `REQ-NN`, file paths). |
| system body | `--body` | Default body copy / prose. |

- Both web fonts ship weights **400 / 500 / 600 / 700**.
- Base body: `15px` / line-height `1.6`.
- **`tabular-nums` on every number** (set globally via `font-variant-numeric: tabular-nums`).

## Component vocabulary

- **`panel`** — section container: `panel` bg, `.5px` `bd` border, `lg` radius, `16px 18px` padding.
- **`card`** — raised content: `card` bg, `1px` `bd2` border, `9px` radius, `10px` padding; hover lifts the border to `accent` with a faint glow.
- **`chip`** — small label: `11px`, `2px 8px`, `md` radius.
- **`button` / `tab` / `navitem`** — Space Grotesk; active state uses `accentBg` + `accentText`; hover glow on `accent`.
- **Pixel-art (Party):** zones (`.mcstation`) and agent sprites (`.mcag`, 54×54) render with **`image-rendering: pixelated`** on a 32px scene grid. Sprite bob, status halos, emotes and speech bubbles are the *expressive* (rare-moment) motion layer — everyday UI stays sober.

## The app-wide RPG skin — the surface treatment that actually renders

> **Complete-extraction note (DR-056).** The base `panel`/`navitem`/`cmd` above are the *structural* fallback. The prototype then applies a **global RPG skin** (a second-pass override block, `index.html` 128–158, labelled *"Skin RPG — GLOBAL (toda la app: una sola identidad)"*) that re-skins those base components and adds the RPG primitives. **This skin is what renders app-wide** — shipping the base panel alone silently drops the look. Tokens live in `design-tokens.json › rpgSkin`.

### The emboss signature

Every skinned surface gets the chunky "pressed pixel tile" treatment:

```
box-shadow: inset 0 1px 0 rgba(255,255,255,.05),   /* top highlight */
            inset 0 -2px 0 rgba(0,0,0,.22),          /* inner bottom shadow */
            0 2px 0 var(--canvas);                    /* 2px canvas-colored bottom ledge */
border: 1px solid var(--bd2);  border-radius: 10px;
```

The two `rgba(...)` literals are **theme-independent structural** values (they work in both themes) — keep them verbatim, do not tokenize them to a surface color.

### App-wide overrides (these replace the base look)

| Component | Skinned look |
|---|---|
| `.panel` | `card` bg, `1px bd2`, `10px` radius, **emboss signature**. |
| `.cfgcard` | `card` bg, `1px bd2`, `10px` radius, `inset 0 1px 0 …, inset 0 -2px 0 rgba(0,0,0,.2)`; hover → `accent` border + glow. |
| `.navitem` | Space Grotesk 500, `8px` radius; active keeps `accentBg`/`accentText` **and adds** `inset 0 0 0 1px accent` ring. |
| `.cmd` | command chips inset on `canvas` with a `bd2` hairline, `8px` radius. |

### RPG primitives

- **`.rpgpanel`** — same embossed surface as the skinned panel; the explicit container for hero stats, lock chips, the shield.
- **`.rpggrid`** — a **22px** embossed grid texture (`bd` 1px lines) overlaid on RPG panels. *Distinct from the Party scene grids (32px/30px).*
- **`.shield`** — the hero crest: **96×96**, `2px accent` border + `accentBg` fill, glow `0 0 22px -6px accent` + `inset 0 0 0 2px card`, `14px` radius, `image-rendering: pixelated` (usually carries `.rpggrid`).
- **`.xpbar`** — **18px** tall, `7px` radius, `1px bd2`, `canvas` track; `accent` fill (`width .6s`); `::after` striping `repeating-linear-gradient(90deg, transparent 0 16px, canvas 16px 18px)` at `.5` opacity.
- **`.herostat .big`** — the **40px Pixelify-Sans** stat numeral (line-height `.85`, `tabular-nums`) — the gamified RPG count; the panel carries an absolute tier badge.
- **`.lockchip` / `.reveal`** — the **locked → hover/focus-reveal** mechanic: `.reveal` is an absolute `card` overlay (`opacity 0 → 1`, `.18s`) shown on `:hover`/`:focus-within` (keyboard-reachable). `.lockslot` dims the locked item (`saturate(.55)`). Honors `prefers-reduced-motion`.
- **`.secthead`** — Space Grotesk 600, `13px`, `t2`, with a trailing `.ln` 1px rule (`bd`) that fills remaining width.
- **`.itemslot`** — pixelated inventory slot (centered inline-flex, `9px` radius); size set per use (**34/40/42/58px** observed), `1.5–2px` tier/accent border.
- **`.node`** — `15×15`, `4px` radius pixel node marker.
- **`.sprite`** — generic pixelated sprite base (Party sub-views define their own larger sprite specs).
- **`.glowwarn`** — `warn`-colored attention glow (`0 0 18px -7px warn`).
- **`.anim` / `rpgIn`** — app-wide panel entrance: `9px` rise + fade, **340ms**, `transform`/`opacity` only; disabled under `prefers-reduced-motion`.
- **`.spot`** — emphasis variant (`1.5px` border).

## The Party pixel-art spec — the two embedded sub-views are part of the contract

> **Complete-extraction note (DR-056).** Beyond the dashboard's own Party canvas, two embedded sub-views are binding: **La Fragua** (`party-proposal.html`, the build view) and **La Campaña** (`party-pipeline.html`, the pipeline view). Each has its OWN sprite scale, grid and structural palette — a tokens-only build must reproduce all three. Tokens live in `design-tokens.json › party`.

### Per-view sprite & grid sizes (do NOT average)

| View | File | Sprite | Scene grid | Stage / room |
|---|---|---|---|---|
| **Dashboard** | `index.html` (`.mcag`) | **54px** | **32px** | positioned on `#rpg-scene` |
| **La Fragua** | `party-proposal.html` (`.ag`) | **52px** (vault 42, relay step 29) | **30px** | 920×560 stage, positioned rooms |
| **La Campaña** | `party-pipeline.html` (`.sp`) | **58px** (small 46) | **30px** | 920×560 stage, **250×208** rooms |

### Sprite state machines

- **Dashboard `.mcag`:** `s-work` (halo + prog bar) · `s-review` (halo) · `s-blocked` (faster halo, `.9s`) · `s-idle` (`opacity .45` + `grayscale .4`) · `carry` (`.pkt` packet). Plus `has-emote`, `has-say`, `mcdots` typing dots.
- **Fragua `.ag`:** `work`/`review` (halo + cat7 prog) · `carry` (warn scroll icon) · `vault` (42px + medal + ok tag) · `split` (img hidden, **sequential relay** test→backend→contrato→frontend with 29px steps) · `say-on` (speech bubble).
- **Campaña `.spi`:** `idle` (`idlebob 2.6s`) · `walking` (`walkbob .42s`, the lead roams) · `small` (46px) · room-locked (animation off). Rooms: `roompulse` glow (active) · `badge.done/active/locked`.

### Structural background colors — the `partyStructural` token group

The Party maps are painted with **~10 hardcoded structural colors** that are NOT in the semantic palette (scene fill, grid lines, paths/connectors, vault floor, scrims). They are tokenized as `party.partyStructural` so a tokens-only build reproduces the backgrounds pixel-faithfully:

| Token | Value | Paints |
|---|---|---|
| `sceneFillRadialA/B/C` | `#16201f` · `#141b22` · `#16201d` | body/stage radial-gradient stops |
| `sceneBase` | `#0c1113` | solid base under the stage; map chip/doc bg |
| `gridLine` | `#1d2629` | the `.stage::before` 30px scene-grid lines |
| `pathTrackLight` / `pathTrackDarkFragua` / `pathTrackDarkCampana` | `#26312f` · `#202927` · `#1c2523` | dashed path/connector stripes |
| `pathSeam` | `#2c3836` | 1px inset seam on tracks |
| `pathFlowLight` / `pathFlowDarkCampana` | `#2f4a3a` · `#21342a` | active/flowing connector (Campaña) |
| `vaultFloorSeam` | `#1c3a2a` | 1px seam on the vault floor |

Plus the **`rgba(12,17,19, α)` scrim family** (label/tag/room-darkening/vault gradients) at α = `.1 / .28 / .32 / .5 / .6 / .8 / .82 / .85 / .86` — theme-independent dark-map overlays, kept verbatim.

### Keyframe inventory (the expressive motion layer)

- **Dashboard:** `pcbob` (idle wander) · `mchalo` (halo pulse) · `mceb` (emote bob) · `mcsay` (speech in) · `mcdt` (typing dots).
- **Fragua:** `halo` (scale .8→1.18) · `sayin` · `pulse` (live/FRD pip).
- **Campaña:** `roompulse` (active-room glow breathing) · `idlebob` · `walkbob` · `cbob` (lead bob) · `slidein` (doc pip along an active connector) · `halo` (scale .85→1.15) · `sayin` · `pulse`.

All are `transform`/`opacity` only. The Party canvas is where the **expressive (rare-moment) motion is reserved** per the frequency test; the app shell honors `prefers-reduced-motion`.

## Motion

- `transform` / `opacity` only, **< 300ms**. Focus ring: `2px solid accent`, offset `2px`.
- Sober everyday; expressive motion (sprite bob/halo/emote) reserved for the Party canvas. **Respect `prefers-reduced-motion`.**

## Prohibitions

- **No invented cold-blue (hue-230) palette.** That palette came from the superseded `docs/design/brief.md` and was the root cause of the design divergence. The accent is the prototype's teal/steel-blue. Do not "modernize" or relax it.
- **No hardcoded colors/spacing/radii** in committed code (`bg-white`, `text-[#abc]`, `w-[37px]`). Tokens only, via the `@theme` registry mirroring `design-tokens.json`.
- **Do not generate alternative directions** for Mission Control. The visual is frozen FROM the approved prototype; this is a fidelity contract, not an exploration.
- **Do not drop the pixel-art.** Sprites/zones and `image-rendering: pixelated` are part of the contract, not decoration.
- **Do not ship the base components without the RPG skin.** The app-wide skin (emboss signature + RPG primitives, `rpgSkin` group) is what renders everywhere — the bare `.panel`/`.cfgcard`/`.navitem`/`.cmd` are only the structural fallback. Applying the base look alone silently drops the identity (DR-056 complete-extraction).
- **Do not average the Party sprite sizes.** Each sub-view has its own scale (Dashboard 54px / Fragua 52px / Campaña 58px); use the per-view value, not a blend.

## Assets (must be staged to `public/`)

`prototype/assets/zones/*.png` (12 zones), `prototype/assets/agents/*.png` (13 sprites + sheets), `prototype/assets/pandacorp.png`. ~19MB total — see `docs/design/technical-assumptions.md`.
