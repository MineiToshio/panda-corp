# Context pack · FRD-13 · Visual system and accessibility

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-13 copy, S2.1 builds, S2.2 amendments, S2.3-13 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-13-visual-system-accessibility/frd.md` (id FRD-13, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/design/prototype/index.html` |
| Config states | 2 under `states["frd-13-visual-system-accessibility"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 9 AC lines: 2 drawn · 3 partially drawn · 2 not drawn · 2 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-13#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### FRD-13#U1 · partial · `a11y-skip-link-focus`

> - The theme SHALL be derived from **few tokens** — a small, structured set of surface / text / border / accent / status tokens per theme — instead of dozens of loose, unrelated values, so that touching the accent doesn't throw off the text contrast and a **high-contrast mode** can be enabled without a redesign. **(DR-054)** The tokens are authored in **hex**, frozen from the prototype (the earlier OKLCH/perceptual-space mandate is superseded by the approved visual); the only OKLCH set retained is the per-agent role-identity palette. There are exactly **two committed themes** (dark default + light); high-contrast is a var-override layer over the dark theme (pure black/white extreme inversion), not a third token theme.

**Prototype:** Tokens are few and structured (base.css): neutral surfaces/text/lines per theme, nine tone hues, tint, shadow and scene tokens; light at `:root`, dark under `[data-theme="dark"]`; authored in hex (the FRD text calls for hex after DR-054). A high-contrast layer is NOT drawn. The FRD's "exactly two themes: dark default + light" holds (the file ships `data-theme="dark"`).

### FRD-13#U2 · not drawn · `home`

> - The UI SHALL use **a single rationed accent** (punctuation, not paint): accent only on what matters (active tab, working agent, XP bar); the rest, warm neutrals.

**Prototype:** The single rationed accent was replaced by neutral graphite/porcelain chrome with a semantic multi-hue palette (phase, state, document purpose, rarity); lilac remains an identity accent only.

### FRD-13#U3 · behaviour only · `home`

> - EVERY number (XP, levels, per-column counts, stats, timestamps) SHALL use **`font-variant-numeric: tabular-nums`**.

**Prototype:** `tabular-nums` is applied to numbers (rings, scores, counts) in CSS; not visible in text capture.

### FRD-13#U4 · partial · `home`

> - Elevation SHALL have **3 levels** (canvas → resting → pop) with a tokenized shadow/radius scale (radius 8px, base 16px, hairline 1px). **(DR-054)** The prototype's elevation is a two-layer box-shadow scale wired as `--shadow-0` (none), `--shadow-1` (resting) and `--shadow-2` (pop); the light theme re-declares `--shadow-1/2` with softer values. The earlier "spacing in 0.25rem multiples" per-elevation-level spacing token is superseded — the prototype carries a compact spacing scale separately, not a per-level spacing field.

**Prototype:** Elevation is tokenized (shadow, shadow-sm, node, drop, panel, dialog, toast) and radii are tokenized (6, 8, 10, 12, 16, 22, 28, pill) with a hairline; more than three levels and a different scale than "radius 8px, base 16px".

### FRD-13#U5 · partial · `home`

> - Animation SHALL use **only `transform` and `opacity`**, duration **<300ms**, and apply the *frequency test*: what is seen dozens of times a day (tabs, hover) is restrained; the expressive is reserved for rare and satisfying events (achievement, level-up, completed work order). 2–3 easing tokens, not per-component curves.

**Prototype:** Transitions run 120-220 ms on transform, opacity, color, background, border-color, box-shadow and the collapsible sidebar's width; `prefers-reduced-motion` disables everything. The FRD allows transform and opacity only.

### FRD-13#U6 · behaviour only · `fragua-on`

> - The UI SHALL honor **`prefers-reduced-motion`**: it disables all Party animation (long sessions → avoid fatigue).

**Prototype:** Reduced motion disables animation (CSS rule in base.css); La Fragua, Campaña and sprites obey it.

### FRD-13#U7 · drawn · `home`, `achievements-ranks`, `wo-by-frd`

> - NO state SHALL depend on color alone: each state (working / idle / failed / completed) is paired with an **icon or shape + label** (critical with a warm palette, where reds/oranges/amber are close together).

**Prototype:** States pair colour with text or an icon: state chips ("En revisión" with eye icon), "Conseguido" check, "Bloqueado" lock, "Reapertura" chip, phase labels in the stepper ("Construcción: fase actual").

### FRD-13#U8 · not drawn · `config-agents`

> - The canonical **agent-role set** (`AGENT_ROLES` / `AGENT_COLOR` in `app/_design/tokens.ts` — the single source for FRD-06 La Fragua + FRD-12) SHALL match the **real engine and pipeline roles** and carry a fixed color token each: the build/review roles `implementer`, `reviewer`, and the deep-split `test-writer` / `backend-dev` / `frontend-dev`; and the per-phase specialists `researcher` / `product-manager` / `designer` / `copywriter` / `architect` / `analytics` / `security-auditor` / `devops`. It SHALL NOT include the fictitious `guild` aggregate (realigned 2026-06-18 with the Party redesign — see `docs/decision-log.md` and `prototype/party-redesign-spec.md` §2).

**Prototype:** No canonical agent-role colour set is drawn; agent cards are tinted by model tier, sprites carry the identity.

### FRD-13#U9 · drawn · `a11y-skip-link-focus`, `a11y-ring-tooltip-focus`, `home`

> - The accessibility SHALL comply: `aria-label` in Spanish on icons, `aria-live="polite"` to announce events without stealing focus, a visible focus ring that respects the `border-radius`, keyboard list navigation, **contrast ≥4.5:1** (a real risk with light warms).

**Prototype:** "Saltar al contenido" skip link first in the tab order (prototype defect: it navigates to #content, see FRD-19 AC-19-001.5); `aria-label`s in Spanish on icon buttons ("Copiar …", "Cerrar", "Abrir menú"); `role="status"` on the achievement notice and `aria-live="polite"` on the board's result count; visible 2 px focus ring; arrow-key navigation on tab strips; progress ring explains itself on focus ("39 de 48 work orders verificados"). Contrast is not a state (preflight + axe).

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `a11y-skip-link-focus` | `#inicio` | js `document.querySelector('.skip').focus()` | capture viewport | `FRD-13#U1` `FRD-13#U9` |
| `a11y-ring-tooltip-focus` | `#inicio` | scroll `.proj-card .ring[data-tip]` into view → wait 300 ms → js `document.querySelector('.proj-card .ring[data-tip]').focus({ preventScroll: true })` | capture viewport | `FRD-13#U9` |

States cited above that belong to another FRD folder (captured there, reused here): `home`, `fragua-on`, `achievements-ranks`, `wo-by-frd`, `config-agents`.

**Not drawn (2)**: `FRD-13#U2`, `FRD-13#U8`.

**Partially drawn (3)**: `FRD-13#U1`, `FRD-13#U4`, `FRD-13#U5`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `a11y-skip-link-focus`

- [a.skip] Saltar al contenido (outside #content; first focusable element, shown on focus)

### `a11y-ring-tooltip-focus`

- [@data-tip / @aria-label] 39 de 48 work orders verificados (the progress ring of the Funko Tracker card; the tooltip text equals the accessible name)

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- "Spanish aria-label on icons" | many accessible names are in Spanish; a few interface strings stay English (dialog kicker "Skill").
- Palette names: FRD "warm pixel-RPG palette, dark default" | graphite/porcelain Órbita palette; fonts Space Grotesk + Inter + JetBrains Mono.

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- The whole "warm pixel-RPG / guild palette" description of FRD-13 is stale after the Órbita approval (2026-10-21): the ACs on a single accent (U2), a high-contrast layer (U1), three elevation levels with the 8/16/1 px scale (U4), transform/opacity-only motion (U5) and the role-colour set (U8) do not match the approved CSS.
- Transitions on width, color, background and border-color (prototype.css:1236, 1299, 697 and base.css:220) go beyond the DR-129 contract "only transforms animate": decide at S3 whether it is a blocker.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 28 (owner): one set of component rules (card header with tinted icon tile, section heading, small uppercase labels in Inter, green/amber/red only for status, selected filter chips neutral, one "Mostrar más" bar, one search width).
- Round 5 visual system: neutral chrome, hue only carries meaning with text or an icon; type scale with nothing below 12 px; hover effects only on hover-capable pointers; light and dark first-class.
- Iteration 21: typography decided — Space Grotesk (display) + Inter (body); monospace (JetBrains Mono, self-hosted in base.css) only for ids, code, commands and paths.
- 2026-10-21 scope: targets desktop, tablet and phone, so the responsive gates apply from the v2 build.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
