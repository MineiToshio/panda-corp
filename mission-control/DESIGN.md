# DESIGN — Mission Control · Órbita

> **FROZEN 2026-10-22** (pending the design gate `check-design-gate.mjs`). Frozen FROM the owner-approved prototype `docs/design/prototype/index.html` (Órbita, round 5, iteration 28, approved 2026-10-21). The job was fidelity, not novelty: every rule below is read from the prototype's CSS (`base.css`, `prototype.css`, split by component family in `docs/design/prototype/reference/css/`) and from the owner's recorded decisions; nothing was invented. This contract **replaces** the Atelier / pixel-RPG contract of 2026-06-18 (kept in git history and `docs/design/archive/prototype-v1/`).
>
> Mission Control is the factory's internal tool. Its identity is its own and is **not** a template for product apps.

## Source of truth

- **Tokens (machine):** `docs/design/design-tokens.json`, regenerated from the prototype's CSS by the freeze (history in `design-tokens-history.json`). `src/app/globals.css` `@theme` mirrors it. The tables here are a reader's summary; **the JSON wins**.
- **Visual (binding, DR-080):** the live prototype `docs/design/prototype/index.html` (sources `prototype.template.html`, `base.css`, `prototype.css`, `prototype.js`, `data/*.js`; served at `http://127.0.0.1:1988/index.html?demo=off`). It runs on a fictional, privacy-safe fixture (the repository is public), so no private data appears in it. The portable CSS is in `docs/design/prototype/reference/css/` (load order in its README), the component catalogue in `docs/design/prototype/components.html`, measured styles in `reference/computed-styles.json`, per-FRD slices in `docs/frds/frd-NN-*/mocks/`.
- **Design intent and the rule history:** `docs/design/explorations/visual-refresh-2026/proposal.md` (iterations 1-28). Rationale and the functional reconciliation: `docs/design/design-decisions.md`.
- **Hierarchy:** FRD > FDD > design-tokens > blueprint > work order. Components: `docs/design/components.md`.

## Identity and mood

A calm, contemporary operations workspace with a distinctive guild identity. Neutral graphite and porcelain chrome; colour appears only where it carries meaning. The operator's next decision comes first, progress is shown without a wall of equally important cards, and each kind of content has a presentation suited to it. The guild layer (sprites, ranks, trophies, La Fragua, La Campaña) is kept, as pixel art on dark scenes inside an otherwise quiet interface.

It must **not** feel like the old pixel-RPG skin (embossed panels, Pixelify numerals, warm-dark canvas), like a corporate admin grid, or like a dashboard that is coloured for decoration.

## Tokens

All values come from `design-tokens.json`; the CSS only reads custom properties. Light tokens live at `:root`, dark tokens under `:root[data-theme="dark"]`. Both themes are first-class and must be verified for appearance and AA contrast. The prototype ships `data-theme="dark"` as its initial theme and remembers a choice; the product starts from the system preference (`prefers-color-scheme`) and a small sun/moon theme button (sidebar footer next to «Colapsar», and inside the drawer on phones, M2 owner decision 5) lets the owner switch and remember the choice; the scene and map surfaces stay dark in both themes (below).

| Family | Names | Notes |
|---|---|---|
| Surfaces | `--bg` `--bg-2` `--surface` `--surface-2` `--surface-3` | page, sidebar/command-box ground, card, raised field, neutral selected/plain chip |
| Lines | `--line` `--line-strong` | hairline (1px) and control border |
| Text | `--text` `--text-2` `--text-3` | primary, secondary, muted (all AA on their surfaces) |
| Action | `--primary-bg` `--primary-fg` `--focus` `--backdrop` | the primary button **inverts** (text colour as fill); there is no accent colour token |
| Hues (9) | `--blue` `--teal` `--violet` `--pink` `--amber` `--green` `--coral` `--slate` `--gold` | darker in light, lighter in dark; meaning only |
| Tints | `--tint` (9% light, 13% dark) · `--tint-strong` (16%, 22%) | the two tint strengths of `color-mix(in srgb, var(--tone) …)` |
| Tone | `--tone`, set by `[data-tone="…"]` to the matching hue | every tinted component reads `--tone`; never a literal hue |
| Type scale | `--fs-xs` 12 · `--fs-sm` 13 · `--fs-md` 14 · `--fs-base` 15 · `--fs-lg` 16 · `--fs-xl` 17 · `--fs-h3` 19 · `--fs-h2` 21 · `--fs-h1s` 25 · `--fs-h1m` 28 · `--fs-h1` 32 | nothing renders below 12px |
| Space | `--s1`…`--s12` = 4/8/12/16/20/24/32/40/48 | |
| Radii | `--r-xs` 6 · `--r-sm` 8 · `--r-md` 10 · `--r` 12 · `--r-lg` 16 · `--r-xl` 22 · `--r-2xl` 28 · `--r-pill` | cards 16, buttons/fields/command boxes 12, small buttons 8, dialog 22 |
| Strokes | `--hairline` 1px · `--rule` 3px | `--rule` is the focus/selection halo width, never an edge stripe |
| Elevation | `--shadow` (resting) `--shadow-sm` `--shadow-node` `--shadow-drop` `--shadow-panel` `--shadow-dialog` `--shadow-toast` | soft in light; dark adds an inset hairline to `--shadow` |
| Layout | `--sidebar` 252 · `--rail-c` 64 (collapsed desktop rail) · `--rail` 76 (tablet rail) · `--content` 1180 | page frame = `--content` + 2 × 40px gutters |
| Motion | `--ease` `cubic-bezier(.2,.8,.2,1)` · `--dur` 160ms | see Motion |
| Scene | `--scene-*` (text 1-3, surface 1-2, line 1-2, nine hues) · `--map-*` (bg, room, edge, label bg/fg, hand-off bg/fg) | defined once at `:root`, the dark palette, **not** re-declared per theme |

A value needed twice becomes a token. The only literals allowed outside token blocks are lengths (the preflight acknowledges 881 literal px) and the `color-mix()` percentages that are part of a component's recipe.

## Typography

Three self-hosted families (SIL OFL), served from the app, never a system stack and never a CDN: **Space Grotesk** (variable 300-700) for display, **Inter** (400/500/600/700/800) for body and labels, **JetBrains Mono** (variable 100-800) for ids, code, commands and file paths only. Files and licences: `docs/design/prototype/assets/`. The Manrope files in that folder are from an abandoned comparison and are not staged.

- Headings use `--font-display`: `h1` 750 / 32px (25px under 760px; the project hero's `h1` is 28px, 21px on phones), tracking −.025em; `h2` and card titles 700 / 19px (`--fs-h3`); `h3` 650 / 16px; `h4` 650 / 14px. Body is Inter 15px / 1.55 with `font-feature-settings: "cv11", "ss01"`.
- `code, kbd, pre, .mono` use `--font-mono` at `max(.88em, 12px)`.
- Numbers use `.num` (Space Grotesk 750, `tabular-nums`) or `font-variant-numeric: tabular-nums`. Big display figures use proportional figures: Space Grotesk's tabular "1" clips.
- **Small uppercase labels** (`.eyebrow`, dialog kickers, table heads, nav group labels) are **Inter** 12px / 650, tracking .08em, uppercase. Monospace is never used for labels.
- Hero tags, FRD kind tags, build-mode tags, level chips, document counts and the «copiar» hint are Inter. Monospace appears for work-order and FRD codes (`WO-02-014`, `FRD-02`), ADR ids, environment variable names, commands and paths.

## Brand mark

The brand mark is the raster emblem `docs/design/prototype/assets/pandacorp.png` (sidebar brand, phone top bar, favicon). **Recorded exception to the vector-logo rule (M2 owner decision 4, 2026-10-22):** Mission Control is an internal tool and the emblem is the guild crest, so no redrawn vector replaces it. The build serves the original bytes: no re-encoding, no resizing, no `next/image` optimisation. `docs/design/prototype/logo/` holds the export (`pandacorp-mark.svg`, a wrapper that embeds the PNG losslessly, plus `pandacorp-mark.png` and a README stating the exception).

## Colour rules

The rule of the whole app (iterations 4, 8, 13, 22, 28): **chrome is neutral; hue carries meaning, always together with text or an icon.**

1. **Green, amber and red (coral) mean status or severity only.** Categories use violet, blue, teal, pink, slate and gold. A project's **phase counts as status**, so phase colours (including green Lanzamiento and amber Arquitectura) are the deliberate exception.
2. **No coloured edge stripes** anywhere (no `border-left` / `border-top` accent bars, no inset side shadows). Hue goes in text, chips and tints. Selection indicators (a tab's 2.5px bottom bar in the tab's hue) are the one allowed bar and are not a card edge. The `3px` dashed lines in La Fragua and La Campaña are route drawings, not accents.
3. **Never colour alone.** Every hue ships with a label, an icon or both (the chip, the state icon, the tab icon).
4. Meaning map (what each hue stands for):

| Meaning | Mapping |
|---|---|
| Phase | Investigación teal · Producto blue · Diseño pink · Arquitectura amber · Construcción violet · Lanzamiento green |
| Work-order state | Planificado slate (circle) · En curso blue (loader) · En revisión amber (eye) · Verificado green (check) · Bloqueado coral (alert) |
| Document purpose | Producto blue · Investigación teal · Contrato funcional violet · Diseño pink · Arquitectura amber · Decisión técnica amber · Work order violet · Revisión slate · Regla slate · Referencia slate |
| Catalogs (one hue each) | Habilidades violet · Agentes blue (model tiers are neutral labels) · Reglas de decisión pink (Auto green, Owner amber) · Estándares teal (Obligatorio coral, Recomendado amber) |
| Rarity | Común slate · Poco común teal · Raro blue · Épico violet · Leyenda gold |
| Return type | Monetaria teal · Personal violet · Mixta pink |
| FRD kind tag | UI pink · Infra slate · Tool/CLI teal · API blue · Data gold |
| Backlog priority | P0 coral · P1 amber · P2 slate; type chips Bug (coral outline), Mejora (blue outline) |
| Change state | Listos pink · Borradores slate · En construcción blue · Cerrando amber · Hechos green · Descartados slate |
| Lesson type | Trampa pink · Patrón blue · Veredicto teal · Antipatrón coral · Problema→solución violet |
| Services | Configurado / Activo green · Propuesto / Planificado / Pendiente amber · Candidato / Inactivo slate; environments one teal hue |
| Identity | Guild, progress, trophies and mission progress gold · Memoria teal · reviews and history slate · conversion KPI blue |

Navigation destinations carry an identity hue on their icon (Inicio amber, Tablero teal, Portafolio blue, Propuestas pink, Logros gold, Documentación violet, Configuración slate).

## Shared component rules (iteration 28 — one application, one dialect)

Each rule is a shared primitive in `components.md`; a surface that invents its own variant is a cohesion defect (DR-062).

1. **Card header** (`.card-head`, or `.card-title` when the header holds more): a tinted icon tile `.badge-icon.sm` (26px, radius 8, icon in the card's hue on `--tint-strong`) + a display title of **one size** (19px / 700, whatever the heading level) + the **count pill in the same hue** beside the title (`.card-head :is(h2,h3) > .chip { --tone: inherit }`) + an optional action at the right. Report bands (Spec, Arquitectura, Propuesta) use the same header.
2. **One section heading outside cards** (`.saga-head`): display title in **text colour** (15px / 700), the icon in the section hue, a hairline `.saga-line`, a muted note (and optional link) at the right. Used for the campaign journey, «Tu cartera», sagas, trophy sections and statistics bands.
3. **Small uppercase labels in Inter** (see Typography).
4. **Command boxes** (`.cmd`): terminal icon (violet by default) + mono `code` + 36px copy icon button (`aria-label` «Copiar <comando>»), min-height 44px, wraps only at «:» and spaces. Inside a toned card, notice, banner, next-step or turn row the box takes a **5% tint of that hue** and a coloured prompt; list-row commands (`.ask-cmd`) share the look. Mission Control never runs a command: it shows and copies.
5. **Selected filters are neutral:** `.chipbtn[aria-pressed="true"]` is `--surface-3` with `--text`, never a hue; the same for the board's selected phase and La Fragua's selected mode. Tabs and segmented controls mark the selection by text colour, tinted icon and (tabs) the bottom bar.
6. **«Mostrar más»** (`.morebtn`) is always a full-width dashed bar, 40px, «Mostrar N más · quedan M», at the end of a paged list. Page sizes: rules 30, backlog 15-20, trophies 12, transitions 10, board columns 4 on phones.
7. **One search width:** `.field.search` is 40px high and at most 480px wide (full width on phones).
8. **Equal-height pairs:** two cards side by side end at the same height; columns stretch and the last card of the shorter column fills the gap. Below 1024px a pair becomes one column with the actionable side first (Tu turno first in the Resumen).
9. **Every card intro paragraph** has the same spacing; mini-card titles inside bands are text-coloured.
10. Chips are 24px (`.chip`, 12px / 600, hue on `--tint-strong`; `.plain` neutral; `.outline` hairline); filter chips (`.chipbtn`) are 34px; buttons are 40px (32px `.sm`), the primary inverts, `.toned` uses the hue, `.danger` is outlined coral and never an attractive primary; `.illus` is the dashed uppercase «Ilustrativo» label for illustrative content.
11. **Dialogs:** one `dialog#dlg`, width `min(680px, 100vw − 32px)`, radius 22px, a tinted sticky head with a small uppercase kicker in the dialog's hue above a display title, ✕ at the right, 20px body padding. Reveal-more surfaces open in this dialog, never as an inline expand-that-pushes (owner rule 2026-06-26). Recorded exception: the decision-rule accordion (48 short rows, default text only). The prototype also uses native `details` groups for scannable folds (FRD rows, environment groups, rank eras, the engine log); they hold lists, not detail.

## Layout and breakpoints

| Range | Shell | Page gutters |
|---|---|---|
| Phone < 760px | Off-canvas drawer (`min(300px, 86vw)`), sticky top bar, sticky bottom nav | 16px |
| Tablet 760-1179px | 76px icon rail with a mini label under each icon | 24px |
| Desktop ≥ 1180px | 252px sidebar, collapsible to a 64px icon rail (remembered; floats open on pointer or focus without moving the content) | 40px |

Content frame: `--content` 1180px centred. Other thresholds, all in the CSS: **1279** (Spec table of contents hides, single column); **1023** (two-column card pairs, fixed-column tables → one card per row, wide grids → one column); **899** (dependency maps → ordered list «Paso N · M órdenes»; La Fragua one station per row; document and page indexes fold behind a button («Elegir documento · N» in the project, «Índice · <página>» in Documentación); an idea's documents are chosen from a folded list).

**Patterns that differ on phone and tablet (iteration 26):** the dependency map becomes a build-order list whose FRDs unfold; the data model opens on its schema list; list rows move chips and commands under the title; long lists page (see rule 6); commands and markdown tables never break inside a word (commands wrap at «:» and spaces, tables scroll sideways with a visible hint); the work-order board shows 4 cards per column and collapses empty columns to one line, and on tablet flows as two-column masonry; ranks put the emblem on the left; headings avoid a lone last word and «hace 4 h» never strands its unit; focus is kept clear of the sticky bars (`scroll-padding` 88px, 72px / 80px on phones).

The persistent shell is specified in `components.md` (`AppShell`, nav contract). Page title block: one `h1` equal to the nav label (Inicio, Tablero, Portafolio, Propuestas, Logros, Documentación, Configuración), an optional eyebrow, a subtitle of at most 70ch and actions at the right; drill-ins (idea, project) use the item's own name as the `h1`.

## Motion

Frequency test: the everyday is sober, the expressive is reserved for rare moments.

- **Only transforms animate**, 120-320ms (`--dur` 160ms, drawer slide 220ms, dialog pop and achievement notice on `transform` only). `prototype.css` keeps only `transform` transitions and the keyframes `pop`, `achin` and `tok-in` animate transforms. Text never fades; opacity is allowed only on decorative layers (scrim, tab-overflow fades). The collapsible sidebar does not animate `width`. Hover feedback changes fill or border on hover-capable pointers only and does not animate them.
- Hover effects exist only inside `@media (hover: hover)`; touch devices get none.
- Pixel-art life (idle bob, working jump, the courier's 3s-per-station walk, the pulsing active campaign room) is decorative, uses transforms, runs only while the data says it is live, and is off under reduced motion.
- `prefers-reduced-motion: reduce` turns every animation and transition off (`base.css`).

## Accessibility (WCAG 2.2 AA)

- Contrast AA in both themes; the hue scale was tuned for it. Visible focus everywhere: a 2px `--focus` outline with 2px offset (`:focus-visible`), plus the 3px focus halo on fields.
- **Product text is never below 12px**; the captured Manual's 10-11px inline labels are raised to 12px.
- **Touch targets: 44px is the design target** (24px is the gated floor, axe `target-size`). Controls that must reach 44px on touch: buttons (40px today), filter chips (34px), icon buttons (36-40px), the compact command copy button (30px). See «Where the drawn prototype departs» below. List rows (56px), tabs (46px), the drawer items (44px) and the bottom nav (52px) already comply.
- Landmarks and headings: exactly one `h1` per screen, `main#content` (tabindex −1) as the skip-link target, `aside#sidebar[aria-label="Navegación principal"]`, `nav[aria-label="Secciones"]`, `nav[aria-label="Accesos rápidos"]` for the bottom nav. The skip link («Saltar al contenido») is the first focusable element and only moves focus.
- Dialogs: native `<dialog>`, focus moves in, Escape closes, focus returns to the trigger. Tabs use `role=tablist` with arrow-key movement. Drawer: `inert` when closed on phones, `aria-expanded` and `aria-controls` on the menu button.
- State by icon and shape in addition to colour; `aria-label` on rings, stack bars and counts (for example «109 de 110 work orders verificados»).

## Language and copy

- **The interface is Spanish.** Everything Mission Control itself says (navigation, headings, labels, states, empty states, buttons) is in Spanish and goes through i18n, never hardcoded. Content it only shows keeps its original language (English today): project documents, FRD and work-order titles and bodies, skill and agent descriptions, rules, lessons, backlog items, model notes, and the captured Manual.
- Factory artifact names stay in English inside Spanish sentences: FRD, PRD, ADR, work order, spec, backlog (with feminine agreement: «work orders verificadas»). «Documentación» is the surface name everywhere; its short rail and bottom-nav label is «Docs» (the Configuración rail label is «Ajustes»); «Manual» is not used.
- **No em dash and no en dash used as a sentence separator in UI copy**: use a period, colon, comma or parentheses. A hyphen inside compound words and the middle dot «·» as a structural separator are fine.
- Real text, never lorem ipsum. Absolute dates («19 oct. 2026»), relative ages («hace 4 h») where the FRD asks for them.
- Every empty, loading and error state is designed (`.empty`, `.notice`); a reader that cannot parse its source shows an explicit error, never an empty list.

## Demo-only controls (DR-061)

Anything that exists only to preview states in the prototype carries `data-demo-only` and is hidden by `?demo=off` (`html[data-demo="off"] [data-demo-only] { display: none }`, so controls re-rendered later stay hidden too): the review bar with its own theme button (`#theme`, distinct from the product theme button), and La Fragua's scene control («Demo · Estado real / Apagada / Encendida / Simulación», a dashed block with a `DEMO` tag and a note of how the real thing works). They are **never promoted to requirements**: the real scene is driven by the project's `running` flag and its heartbeat. Any real value the app surfaces appears as read-only data in a real surface. The prototype-only footer text («propuesta de diseño, no es la app real») and the capture stamp («Captura de proyectos · …», «Captura de la fábrica · …») are prototype-only: not product copy and not components; the build omits them.

## Where the drawn prototype departs from these rules

**The DRAWN values bind.** The prototype is the oracle for fidelity and wins for visuals: items 2, 3, 4 and 6 below are frozen as drawn, because the L1/L2 oracle measures exactly what is drawn, and a build that corrects one fails its own oracle. Changing any of them is a later prototype round (the visual punch list), never a build-side decision. Items 1, 5, 7 and 8 are resolved and leave nothing to diverge. Each item is recorded in `design-decisions.md`.

1. **Motion (resolved, FRD-13 wins).** The prototype was aligned in S2.1: it is transform-only (see Motion). Nothing to diverge.
2. **Mono outside code (binds as drawn):** dialog `.eyebrow` labels («Lo que se necesita de ti», «Recomendación del agente») and the `.ears` keyword tags are set in JetBrains Mono, although the general rule says labels are Inter.
3. **Table heads (binds as drawn)** track at .05em, uppercase labels at .08em.
4. **Hue outside its meaning (binds as drawn):** green is also used for the Observabilidad tab and its view switch, the work-order reading tabs and acceptance criteria, «Los más alcanzables», the cost chip and the Propuesta hypothesis band; amber for the Inicio nav icon and the «Tu turno» attention card; coral for the Antipatrón lesson type and the Propuesta problem band; gold for the Data FRD kind.
5. **Em dash in copy (resolved):** no renderer joins title and description with « — ». The «—» that remains is the empty-cell marker in tables and stats, which is not a separator and is allowed.
6. **Touch targets (binds as drawn)** under 44px as listed under Accessibility: the build reproduces the drawn sizes, and reaching 44px is a later prototype round.
7. **English strings in Spanish screens (resolved):** the prototype draws the dialog kickers and chips in Spanish; shown content keeps its original language.
8. **Theme control (resolved by the owner at M2):** a theme button (sun/moon) is drawn in the sidebar footer and in the phone drawer, starting from the system preference and remembering the choice. It is not retired. The demo bar's `#theme` is a separate demo-only control.

## Components

shadcn/ui and Tailwind are the accessible foundation; the identity above is bespoke and comes only from the tokens. The living inventory is `docs/design/components.md` (primitives, modules, framing patterns, the `AppShell` nav contract). **Reuse before creating** (DR-057): reuse, then adapt or extend with a variant, and only then create and append a row.

## Prohibitions

- No hardcoded colours, spacing, radii or shadows; no arbitrary Tailwind values (`text-[#abc]`, `w-[37px]`); no `bg-white` / `text-black`.
- No coloured edge stripes; no green, amber or red for a category; no colour as the only signal.
- No em dash or en dash as a separator in UI copy; no text below 12px; no system-font stack in place of the three families; no CDN fonts.
- No pixel-RPG embossed skin, Pixelify Sans or warm-dark canvas from the Atelier contract.
- No animation of colour, background, border, shadow or width for emphasis; no text fade; no hover effect outside `@media (hover: hover)`.
- No second banner, card, chip, tab bar, search width, section heading or command box next to the shared ones; no demo-only control shipped as a feature.
- No prototype-only chrome (the demo bar, the footer disclaimer, the capture stamp) in the app.
- The implementer never edits the prototype, the references, the fixtures or the tolerances (DR-080).

## Voice

Plain Spanish, direct, no jargon where a plain word exists; explain what a command does and where to run it. Product copy is loaded verbatim from the FRD copy files (`docs/design/freeze/copy/`) and the i18n catalogue.
