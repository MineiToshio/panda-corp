# Design decisions — Mission Control

History and rationale for the design contract. The canonical token values live in `docs/design/design-tokens.json`; the human-readable contract in root `DESIGN.md`. This file records *how we got here and why*.

---

## 2026-06-26 — Reveal-more is a modal, never inline expand-that-pushes-content

**What.** Owner rule, now a design principle: a surface that reveals more detail (a rank's detail, the
discarded-ideas list, etc.) opens in a **modal overlay** — we do **not** use the inline
expand-that-pushes-the-page-down pattern ("se ve horrible… no hacemos nunca ese patrón salvo que
realmente tenga sentido"). To support this consistently there is **one shared `Modal` core**
(`components/core/Modal/Modal.tsx`, DR-057) — overlay + dimmed/blurred backdrop + centered panel +
focus-trap + Escape + backdrop-click-closes — extracted from the intake modal and reused by it, the
**"Ver descartadas"** modal, and any future reveal-more surface. Bespoke per-surface overlays are a defect.

**Why.** The accordion-style expand reflowed the whole page and read as broken; modals keep the context
stable and the reveal focused. One shared component keeps every modal coherent (the parallel-agent
coherence problem) and cheap to add.

---

## 2026-06-22 — Whole-app fidelity pass: design decisions (page chrome, campaign honesty, board↔campaign vocabulary)

**What.** A round of owner-QA fidelity decisions against the approved prototype
(`docs/design/prototype/index.html` + the embedded `party-pipeline.html` for La Campaña). These are
**fidelity decisions on the frozen tokens** — they change *how surfaces are composed*, not the token
contract (palette/typography/surfaces are untouched; the 2026-06-18 freeze stands). Recorded here per
the design decision-log discipline; the behavioural contract lives in the FRDs and the
[decision log](../decision-log.md) (the 2026-06-22 entries), the implementation in the blueprints.

- **Page chrome is one component (`PageLayout`).** Every top-level surface wraps its body in a single
  `PageLayout` (the page's one `<main>` + the shared `PageTitle` + the body slot), so the title block
  (icon + name + description) lands in the **same place with the same spacing** everywhere. The
  bespoke per-page `<main>`/padding (the Board was the worst offender) is gone. A *wrapper each page
  invokes* was chosen over the root shell rendering the title, to keep dynamic count tails
  (Propuestas/Logros) and the Board's conditional title (Tablero vs an open card) local while still
  enforcing one chrome. (The page-chrome principle was also added to `factory/standards/`, DR-062
  extension.)
- **Campaign liveliness is honest — roam only when an agent runs.** The active phase reads "● en
  curso" and its cast **roams** (rAF wander, lead halo, speech-on-meet) **only** when the project is
  genuinely `running` (`status.yaml running: true`, threaded card → CardDetail → CampaignPipeline);
  otherwise it reads **"fase actual"** and the cast **idle-bobs in place** ("quietecito en el
  centro"). The app only tracks a persistent running state for the build, so momentary skill runs
  (research/product/…) read the truthful "fase actual" rather than a fake "en curso." Honours
  `prefers-reduced-motion` (and jsdom/SSR → static). Consistent with FRD-09's honest-gamification
  principle: no fake motion implying work that isn't happening.
- **CSS road connectors, under the rooms.** La Campaña's inter-phase connectors are the prototype's
  striped **CSS road** (`StoneBridge variant="road"`, tinted ok-green while flowing) — *not* the
  Fragua stone PNG the campaign had been reusing (it was built faithful to an older mock,
  `la-campana.html`; the current canonical prototype is `party-pipeline.html`). The road sits **under**
  the room images (rooms z-index 2, road z-index 1) so connectors never paint over the pixel-art; the
  centred doc chip stays visible. Lesson: anchor to the *current* canonical prototype.
- **Deliverable = icon + short artifact name.** Each non-locked room shows the phase emoji + the short
  artifact only (`🔍 research.md`, `📋 PRD + FRDs`, …); the "entrega ▸" label + arrow were dropped and
  the leaked `phase.writes` split ("— hallazgos") removed. A `PHASE_META` map (emoji · deliver ·
  accent colour) feeds both the room chips and the connectors.
- **Board ↔ campaign share one vocabulary.** The Kanban columns use La Campaña's numbered phase names
  (`1 Investigación · 2 Producto · 3 Diseño · 4 Arquitectura · 5 Construcción · 6 Release` +
  `Descartada`), so the board and the card-detail campaign read the same words. Pure label change; the
  two-axis column derivation is untouched.
- **Locked-phase ficha shows its info.** A future (not-yet-reached) phase's ficha still renders its
  full information (description, LEE/ESCRIBE, the whole team) — information *about* the phase is
  readable regardless of progress; only the build phase's "Entrar a La Fragua" **action** is gated on
  reaching build. The header label ("en espera") signals the future phase.
- **Discard button: danger hover, not accent glow.** The discard affordance matches the shared
  `Button` `size="sm"` (same size as "← Volver al tablero") and gets a **danger-coloured** hover
  (`.pc-discard`: red border + danger-bg tint + danger glow) — a destructive button shouldn't glow
  accent-cyan. The transition is inline (the shared-Button pattern), since `globals.css` may only
  transition compositable props (AC-13-005.1). It uses `--color-danger` + the `ti-trash` icon.
- **Home alerts + tab bodies on the shared primitives.** Earlier in the same pass: the home health
  alerts became rounded `Banner` cards + an icon `CopyButton` + the shared `CmdRow` (terminal glyph);
  the card-detail Documentos tab became a rail + reader and Comandos a `CmdRow` + project-command box
  (both formerly bespoke). All fixed at the *primitive* level (DR-057 single-source), not per consumer.
  *(Superseded later: the card-detail **Comandos** tab was folded into La Campaña's ficha, and Propuesta/Spec/Arquitectura tabs were added — see `frd-02/frd.md` REQ-02-009, reconciled 2026-07-05.)*

**Why.** Repeated "it's done" had been false because surfaces were never browser-verified against the
prototype, and the visual gate proves *consistency with its own baseline*, not *fidelity to the
prototype*. This pass verified each surface in the browser against the prototype itself (dark + light,
interacting) and only re-blessed baselines after that confirmation. The decisions above are the
fidelity reconciliation; the tokens were already correct (the defects were in composition).

**Impact / docs touched.** Behaviour contracts → the FRDs (esp. [FRD-02](../frds/frd-02-ideas-board/frd.md)
card-detail amendment + AC-02-010.7 rewrite); implementation → the feature blueprints +
[`components.md`](components.md) (the `PageLayout`, `RoamingCast`, `StoneBridge variant`, `Room
labelNode` inventory rows); history + why → the [decision log](../decision-log.md) (2026-06-22). No
token value changed — `docs/design/design-tokens.json` and root `DESIGN.md` are unchanged (the
2026-06-18 freeze stands).

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
