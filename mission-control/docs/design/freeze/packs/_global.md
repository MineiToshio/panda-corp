# Context pack · global (design system, shell, framing patterns, signature details)

> S0.3 output, 2026-10-21. Source of truth: the approved prototype `docs/design/prototype/index.html` (Órbita, round 5, iteration 28), generated from `prototype.template.html` + `base.css` + `prototype.css` + `prototype.js` + `data/*.js` (fictional fixture, frozen clock 2026-10-21T00:20Z, see `OPEN-MOCKUP.md`), and the design intent in `docs/design/explorations/visual-refresh-2026/proposal.md` (iterations 1-28). Served at `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>`. The per-FRD packs (`packs/frd-NN.md`) carry the ACs, states and strings; this file carries what is shared by all of them. S1.1 (`freeze.mjs split`) regenerates `design-tokens.json` from the CSS: the tables below are for readers, not a second source.

## 1. Token families

Light tokens live at `:root`, dark tokens under `:root[data-theme="dark"]` (the generated HTML ships `data-theme="dark"`; `?theme=light` or the demo button switches). Every colour a component uses is a token; the only literals outside token blocks are lengths (881 literal px, preflight warning `literalLengths`, acknowledged in the tracker) and the few `color-mix()` percentages. A component takes its hue from `--tone`, which `[data-tone="blue|teal|violet|pink|amber|green|coral|slate|gold"]` sets to the matching hue token; tinted surfaces are `color-mix(in srgb, var(--tone) var(--tint) | var(--tint-strong), …)`.

### Typography

Self-hosted `@font-face` in `base.css` (OFL): Space Grotesk variable 300-700 (display), Inter 400/500/600/700/800 (body), JetBrains Mono variable 100-800 (code). The staged `assets/` folder also holds Manrope files and `manrope.css` from the abandoned round-5 font comparison: they are unused and need no staging. Headings use `--font-display`: h1 750 / 32px (25px under 760px), tracking −.025em; h2 700 / 19px; h3 650 / 16px; h4 650 / 14px; body 15px/1.55 Inter with `font-feature-settings: "cv11","ss01"`; `code, kbd, pre, .mono` use `--font-mono` at max(.88em, 12px); numbers use `.num` and `font-variant-numeric: tabular-nums`; big display figures use proportional figures (Space Grotesk's tabular "1" clips). Nothing renders below 12px.

| Token | Light (`:root`) | Dark (`[data-theme="dark"]`) |
|---|---|---|
| `--font-display` | `"Space Grotesk", "Inter", system-ui, sans-serif` | same |
| `--font-body` | `"Inter", system-ui, -apple-system, "Segoe UI", sans-serif` | same |
| `--font-mono` | `"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace` | same |
| `--fs-xs` | `12px` | same |
| `--fs-sm` | `13px` | same |
| `--fs-md` | `14px` | same |
| `--fs-base` | `15px` | same |
| `--fs-lg` | `16px` | same |
| `--fs-xl` | `17px` | same |
| `--fs-h3` | `19px` | same |
| `--fs-h2` | `21px` | same |
| `--fs-h1s` | `25px` | same |
| `--fs-h1m` | `28px` | same |
| `--fs-h1` | `32px` | same |

### Spacing, radii, strokes, layout, motion

Spacing scale 4/8/12/16/20/24/32/40/48; radii 6/8/10/12/16/22/28/pill; a 1px hairline and a 3px focus/selection rule; layout: sidebar 252px, collapsed rail 64px, tablet rail 76px, content frame 1180px (page max-width = content + 2 × 40px gutters). Motion: one duration and one easing; transitions are 120-220ms; the drawer slides with a 220ms transform; dialogs "pop" in 180ms; reduced motion switches every animation and transition off.

| Token | Light (`:root`) | Dark (`[data-theme="dark"]`) |
|---|---|---|
| `--s1` | `4px` | same |
| `--s2` | `8px` | same |
| `--s3` | `12px` | same |
| `--s4` | `16px` | same |
| `--s5` | `20px` | same |
| `--s6` | `24px` | same |
| `--s8` | `32px` | same |
| `--s10` | `40px` | same |
| `--s12` | `48px` | same |
| `--r-sm` | `8px` | same |
| `--r` | `12px` | same |
| `--r-lg` | `16px` | same |
| `--r-xl` | `22px` | same |
| `--ease` | `cubic-bezier(.2, .8, .2, 1)` | same |
| `--dur` | `160ms` | same |
| `--sidebar` | `252px` | same |
| `--rail-c` | `64px` | same |
| `--rail` | `76px` | same |
| `--content` | `1180px` | same |
| `--r-xs` | `6px` | same |
| `--r-md` | `10px` | same |
| `--r-2xl` | `28px` | same |
| `--r-pill` | `999px` | same |
| `--hairline` | `1px` | same |
| `--rule` | `3px` | same |

### Surfaces, text, lines, actions

Neutral graphite/porcelain chrome. The accent is not a colour token: primary buttons invert (`--primary-bg`/`--primary-fg`), links and selection use `--blue`, focus uses `--focus` (2px outline, 2px offset).

| Token | Light (`:root`) | Dark (`[data-theme="dark"]`) |
|---|---|---|
| `--bg` | `#f3f4f7` | `#0c0e13` |
| `--bg-2` | `#eceef3` | `#101319` |
| `--surface` | `#ffffff` | `#151920` |
| `--surface-2` | `#f6f7fa` | `#1b2029` |
| `--surface-3` | `#eceff4` | `#232935` |
| `--line` | `#e2e5ec` | `#252b37` |
| `--line-strong` | `#cfd4de` | `#343c4c` |
| `--text` | `#161922` | `#eef0f6` |
| `--text-2` | `#464d5f` | `#b6bccb` |
| `--text-3` | `#636b7e` | `#8d94a7` |
| `--primary-bg` | `#161922` | `#eef0f6` |
| `--primary-fg` | `#ffffff` | `#0c0e13` |
| `--focus` | `#2f5fd0` | `#8fb3ff` |
| `--backdrop` | `#16192266` | `#05070bcc` |

### Hues (the tone scale)

Nine hues, darker in light, lighter in dark, all AA on the surfaces they sit on. They carry meaning only (see section 3). `--tint` (9% light / 13% dark) and `--tint-strong` (16% / 22%) are the two tint strengths.

| Token | Light (`:root`) | Dark (`[data-theme="dark"]`) |
|---|---|---|
| `--blue` | `#2350b5` | `#8cb4ff` |
| `--teal` | `#0a675d` | `#5fd6c6` |
| `--violet` | `#5939bd` | `#b9a2ff` |
| `--pink` | `#9c275e` | `#f59bc9` |
| `--amber` | `#7a4d04` | `#f2c46d` |
| `--green` | `#17663a` | `#72da9e` |
| `--coral` | `#a03722` | `#ff9580` |
| `--slate` | `#4b5467` | `#a6aec0` |
| `--gold` | `#765300` | `#f5cc5c` |
| `--tint` | `9%` | `13%` |
| `--tint-strong` | `16%` | `22%` |

### Elevation

Shadow tokens (resting, node, drop, side panel, dialog, toast); the light theme keeps them soft, the dark theme adds an inset hairline to `--shadow`.

| Token | Light (`:root`) | Dark (`[data-theme="dark"]`) |
|---|---|---|
| `--shadow` | `0 1px 2px #1619220d, 0 10px 28px #1619220f` | `0 1px 0 #ffffff08 inset, 0 12px 32px #00000040` |
| `--shadow-sm` | `0 1px 2px #1619221f` | `0 1px 2px #00000033` |
| `--shadow-node` | `0 6px 18px #1619221a` | `0 6px 18px #0000002a` |
| `--shadow-drop` | `0 6px 10px #16192233` | `0 6px 10px #00000066` |
| `--shadow-panel` | `20px 0 60px #16192240` | `20px 0 60px #00000070` |
| `--shadow-dialog` | `0 30px 80px #16192240` | `0 30px 80px #00000070` |
| `--shadow-toast` | `0 16px 40px #16192240` | `0 16px 40px #00000066` |

### Scene and map tokens (always dark)

La Fragua and the Campaña map keep the DARK palette in both themes (iteration 24) so tokens and chips keep contrast on the dark art: `--scene-*` for the forge, `--map-*` for the journey map. They are defined once at `:root` and are not re-declared per theme.

| Token | Light (`:root`) | Dark (`[data-theme="dark"]`) |
|---|---|---|
| `--scene-text` | `#eef0f6` | same |
| `--scene-text-2` | `#b6bccb` | same |
| `--scene-text-3` | `#8d94a7` | same |
| `--scene-surface` | `#151920` | same |
| `--scene-surface-2` | `#1b2029` | same |
| `--scene-line` | `#252b37` | same |
| `--scene-line-strong` | `#343c4c` | same |
| `--scene-blue` | `#8cb4ff` | same |
| `--scene-teal` | `#5fd6c6` | same |
| `--scene-violet` | `#b9a2ff` | same |
| `--scene-pink` | `#f59bc9` | same |
| `--scene-amber` | `#f2c46d` | same |
| `--scene-green` | `#72da9e` | same |
| `--scene-coral` | `#ff9580` | same |
| `--scene-slate` | `#a6aec0` | same |
| `--scene-gold` | `#f5cc5c` | same |
| `--map-bg` | `#0d1117` | same |
| `--map-room` | `#161b22` | same |
| `--map-edge` | `#2a3140` | same |
| `--map-label-bg` | `#0d1117e0` | same |
| `--map-label-fg` | `#eef0f6` | same |
| `--map-handoff-bg` | `#eef0f6` | same |
| `--map-handoff-fg` | `#161922` | same |

### Token families the freeze must keep (from `fidelity.config.json` → `tokens.groups`)

space `--s\d+` · layout `--sidebar|rail|rail-c|content` · stroke `--hairline|rule` · color `--focus` · scene `--scene-*` · map `--map-*` · hue (nine) · tint `--tint*`. Radii, type scale, shadows, surfaces and text are picked up by the default families.

## 2. Fonts and assets to stage (the build must serve them)

- Fonts: `assets/SpaceGrotesk.ttf`, `assets/inter-400|500|600|700|800.ttf`, `assets/JetBrainsMono.ttf` (+ licences). Not needed: `manrope-*.ttf`, `manrope.css`, `Manrope-OFL.txt`.
- Brand: `assets/pandacorp.png` (sidebar brand, phone top bar, favicon).
- Agent sprites (Campaña, Configuración, La Fragua crews): `assets/{analytics,architect,backend-dev,copywriter,designer,devops,frontend-dev,product-manager,researcher,reviewer,security-auditor,test-writer}.png`; scene extras `assets/courier.png`, `assets/panda-mascot.png`.
- Rank emblems: `assets/ranks/<family>.png` (18 sprites: human, dawn-seeker, lightbearer, oathkeeper, glyphwarden, aether-warden, shardbearer, knight-radiant, realmcaller, dawn-herald, stormlord, ascendant, phoenix-ascendant, leviathan-lord, crimson-dragonlord, celestial-warden, dawn-sovereign, eternal-oathbearer), shown at 56px with a roman grade badge.
- Campaña room art: `assets/zones/{research,review,frontend,architecture,build-hall,release}.png` (pixelated).
- Data for the fixture app: `data/snapshot.js`, `data/extras.js`, `data/manual-live.js` (fictional, frozen clock) and the fixture factory under `fixtures/`.

## 3. Colour semantics (Órbita colour rules)

Rule of the whole app (iterations 4, 8, 13, 22, 28): **chrome is neutral; hue carries meaning, always together with text or an icon; no coloured edge stripes anywhere (hue goes in text, chips and tints, never in a left/top bar); green, amber and red mean status or severity only.** Categories use blue, teal, violet, pink, slate and gold. A project's phase counts as status, so phase colours (including green Lanzamiento and amber Arquitectura) are a deliberate exception.

| Meaning | Mapping (tone) |
|---|---|
| Phase (stepper, board column, chips) | Investigación teal · Producto blue · Diseño pink · Arquitectura amber · Construcción violet · Lanzamiento green |
| Work-order state | Planificado slate · En curso blue · En revisión amber · Verificado green · Bloqueado coral (icons circle, loader, eye, check, alert) |
| Document purpose | Producto blue · Investigación teal · Contrato funcional violet · Diseño pink · Arquitectura amber · Decisión técnica amber · Work order violet · Revisión slate · Regla slate · Referencia slate |
| Catalog (one hue per catalog) | Habilidades violet · Agentes blue (model tiers are neutral blue labels) · Reglas de decisión pink (approval chips: Auto green, Owner amber) · Estándares teal (severity: Obligatorio coral, Recomendado amber) |
| Rarity / tier | Común slate · Poco común teal · Raro blue · Épico violet · Leyenda gold |
| Return type | Monetaria teal · Personal violet · Mixta pink |
| FRD kind tag | UI pink · Infra slate · Tool/CLI teal · API blue · Data gold |
| Backlog priority | P0 coral · P1 amber · P2 slate; type chips Bug coral outline · Mejora blue outline |
| Change state | Listos pink · Borradores slate · En construcción blue · Cerrando amber · Hechos green · Descartados slate |
| Lesson type | Trampa pink · Patrón blue · Veredicto teal · Antipatrón coral · Problema→solución violet |
| Service status / environments | Configurado/Activo green · Propuesto/Planificado/Pendiente amber · Candidato/Inactivo slate; environments one teal hue (iteration 28) |
| Possible rule exceptions to judge at S3 | Lesson type Antipatrón uses coral for a category (status-only rule); FRD kind tag Data uses gold; standard domains in the dialog kicker are English raw values |
| Identity accents | Guild/progress/trophies gold; Memoria teal; Pulso and data-model sections non-status hues; reviews and history slate; mission progress gold |

## 4. AppShell (foundation component, registered in `components.md`; belongs to no FRD)

Structure (`prototype.template.html`, `renderSidebar`, `renderBottomNav` in `prototype.js`; CSS "App frame" and the responsive blocks):

- Skip link `a.skip` ("Saltar al contenido"), first focusable element, target `main#content.page` (tabindex −1). Prototype defect: its `href="#content"` is read by the hash router as an unknown screen and re-renders Inicio; the app uses a real in-page anchor.
- **Sidebar** `aside#sidebar[aria-label="Navegación principal"]`, 252px, sticky, `--bg-2`: brand link (logo 34px, "Pandacorp" over "MISSION CONTROL" with .14em tracking) → optional coral pill "Plugin desactualizado" (only when the plugin is behind; title "Instalado X · repositorio Y") → `nav.navgroup[aria-label="Secciones"]` with the **seven destinations** (below) → `navgroup.projnav` "Proyectos N" (collapsible, remembered; at most five projects ordered by last commit, "Ver los N" beyond five; each row: avatar tile with initials in the project's phase hue, name, "Fase · pct%", aria-label "<Proyecto>: <Fase>, <pct>% de work orders verificados") → **guild card** (crest with the level, rank name, "175 / 200 XP al nivel 23", gold bar; links to Logros) → **collapse button** "Colapsar" / "Fijar abierta" (desktop only, `aria-pressed`).
- **Destinations (top-level `{label, path}` from the prototype)**, in order: Inicio `#inicio` (amber home icon, count of owner items, 6) · Tablero `#tablero` (teal kanban, idea count 10) · Portafolio `#portfolio` (blue folder) · Propuestas `#propuestas` (pink bulb, count of actions, 4) · Logros `#logros` (gold trophy) · Documentación `#documentacion` (violet book, mini label "Manual") · Configuración `#configuracion` (slate settings, mini label "Ajustes"). The current item has `aria-current="page"`, a raised background and a tinted icon; the idea detail highlights Tablero. The app's real paths (FRD-19: `/`, `/board`, `/portfolio`, `/proposals`, `/achievements`, `/manual`, plus Configuración at `/configuration`) are for `architecture` to map; the prototype has **no route that renders without the shell**.
- **Desktop ≥1180px:** grid `252px | 1fr`; collapsible to a **64px icon rail** (preference remembered per browser); while collapsed, pointing at it or keyboard focus **floats it open over the page** (`data-float`, `--shadow-panel`) without pushing the content; collapsed items show a small amber dot (`.raildot`) when Inicio has owner items.
- **Tablet 760-1179px:** grid `76px | 1fr` icon rail with the mini label under each icon; brand text, counts, project names and guild text are hidden; page gutters 24px.
- **Phone <760px:** sidebar becomes an off-canvas **drawer** (`min(300px, 86vw)`, `translateX(-105%)` → none in 220ms, `inert` when closed, scrim `#scrim`, closes on route change); sticky **top bar** (menu button "Abrir menú" with `aria-expanded/controls`, logo 30px, `#where`: small caps "MISSION CONTROL" over the page name); sticky **bottom nav** (5 columns, 52px items: Inicio · Tablero · Portafolio · Manual · Más (opens the drawer)); page gutters 16px; focus is kept clear of the sticky bars (scroll-margin, WCAG 2.4.11).
- Page frame: `.page` max-width 1180 + 2 × 40px gutters, `.foot` below ("Mission Control · Órbita, ronda 5 · propuesta de diseño, no es la app real." and the capture stamp: prototype-only text; the app needs its own footer or none).
- Config components that cover it: Sidebar, NavItem, ProjectNavItem, GuildCard, TopBar, BottomNav, SkipLink, Footer. Captured shell states: FRD-19's `shell-expanded`, `shell-rail-collapsed`, `shell-rail-float`, `shell-projects-folded`, `shell-drawer-open` (widths 375/768/1280). **Nav contract for the Shell-Presence Gate** (`e2e/shell.ts`): landmark `aside#sidebar`, destinations as listed with their labels, no exempt routes, mobile drawer present (`#menu` toggles it).

## 5. Framing patterns of iteration 28 (the shared component rules)

One application, one dialect. Each pattern below is a shared primitive in `components.md`; a surface that invents its own variant is a cohesion defect (DR-062).

| Pattern | Rule (and where it lives) |
|---|---|
| **Page title block** | `.pagehead`: optional crumbs, eyebrow = capture stamp ("Captura de proyectos · 20 oct. 2026, 7:20 p. m." / "Captura de la fábrica · …" with a teal dot), ONE `h1` (32px display), subtitle ≤70ch, actions on the right (flex-wrap). The H1 equals the nav label for Tablero, Portafolio, Propuestas, Logros, Documentación and Configuración. Deviation to justify or fix: Inicio's H1 is "Centro de mando" (nav label "Inicio"); drill-ins (idea detail, project workspace) use the item's own name as H1 with the compact/full hero. |
| **Card header** | `.card-head` (or `.card-title` when the header holds more): a tinted icon tile `.badge-icon.sm` (26px, hue of the card) + display title of ONE size (19px / 700, any heading level) + count pill beside the title in the same hue (`.chip` inherits `--tone`) + optional action at the right. Report bands (Spec, Arquitectura, Propuesta) use the same header. |
| **Section heading outside cards** | `.saga-head`: display title in TEXT colour (15px/700), icon in the section hue, a hairline `.saga-line`, a muted note at the right (`.xs.faint`, optional link). One form everywhere (campaign journey, "Tu cartera", sagas, trophy sections, statistics bands). |
| **Tabs** | `.tabs-wrap > .tabs[role=tablist]`: 46px buttons with a 15px icon and optional count badge; selected = text colour, tinted icon, 2.5px bottom bar in the tab's hue; overflow arrows overlay the ends with 28px fades; arrow keys move between tabs; the selected tab is scrolled into view on phones. `.seg` segmented control for view switches (aria-pressed buttons, neutral selected state). |
| **Chips and count pills** | `.chip` 24px, 12px/600, text in the hue on a `--tint-strong` tint; `.chip.plain` (neutral), `.chip.outline`; `.chipbtn` filter chips (34px, selected = neutral `--surface-3`, never coloured); `.illus` dashed uppercase "Ilustrativo/Habilidad propuesta" label for illustrative content. |
| **Command boxes** | `.cmd`: terminal icon (violet by default) + mono `code` + 36px copy icon button (aria-label "Copiar <comando>"), wraps only at ":" and spaces. Inside a card/notice/banner with a tone it takes a 5% tint of that hue and a coloured prompt. Compact variant `.ask-cmd` in list rows. Mission Control never runs a command. |
| **List rows** | `.lrow` min 56px (icon tile + title + small muted line + chips + chevron), `.divided` hairlines; on phones chips and commands move under the title. Tables with fixed columns become one card per row below 1024px. |
| **Empty states and notices** | `.empty` dashed box with a 22px icon and one sentence (e.g. "Sin ideas en esta fase", "Nada espera tu acción ahora mismo."); `.notice` tinted by tone with an icon (upgrade, error, unavailable source); coral `alert-banner` only for the plugin warning. |
| **"Mostrar más"** | `.morebtn`: full-width dashed bar, 40px, "Mostrar N más · quedan M", always at the end of a paged list (rules 30, backlog 15-20, trophies 12, transitions 10, board columns 4 on phones). |
| **Search and controls** | `.field.search` one height (40px) and max width 480px; selects are `.field` with a chevron; `.switch` for "Ocultar columnas vacías"; buttons 40px (32px small), primary inverts, toned uses the hue, danger is outlined coral, never an attractive primary. |
| **Dialogs** | One `dialog#dlg`: `min(680px, 100vw − 32px)`, radius 22px, tinted sticky head with a small uppercase kicker in the dialog's hue ("FRD-02 · Spec", "ADR-0001", "Decisión · Funko Tracker", "Confirmar") above a display title, ✕ at the right, body 20px padding; label | content rows (128px labels) for FRD details; confirm dialogs have Cancelar / verb. Native Escape and focus return. Nearly full width on phones. |
| **Cards that sit side by side** | End at the same height: columns stretch and the last card of the shorter column fills the gap; below 1024px they become one column with the actionable side first. |
| **Toasts** | `#toast` (inverted pill, bottom centre, 2.6s) for simulated writes/copy; `.ach-toast` gold achievement notice with "Ver" and "Cerrar aviso", auto-close 9s. |

Small uppercase labels (`.eyebrow`, kickers, table heads) use Inter 12px/650 with .08em tracking; monospace is kept for ids, code, commands and paths only. No component animates colour for emphasis beyond 160ms hover feedback on hover-capable pointers.

## 6. Signature details (the fidelity checklist must name them)

1. **La Fragua scene** (`section.fragua`, the top of the project Resumen; FRD-06 states `fragua-real|on|off|empty|token-card`). A project verdict as headline (`h2`, e.g. "Construcción al 81 %: 39 de 48 work orders verificadas…"), a health chip (Espera tu decisión / Construyendo ahora / En pausa / Listo para lanzar / Avanzando), a stacked forging bar (`.fr-quest`, role=img with counts), **four stations** in a row (`.fr-station[data-station]`: Cola slate, Taller blue, Revisión amber, Bóveda green; stacked one per row below 900px) each with a decorative pixel crew (`.fr-cast img`, 72px, idle-bob, working jump when live, `saturate(.75)` when idle) and a plate (name, count, sub-label, up to 8 tokens then "+N", or three dashed ghost slots with a message when empty), **tokens** (44×40px tinted tiles, FRD number over order number, hover/focus opens `#tok-tip` with code, state chip, title, one sentence, FRD), a **courier** sprite and a gold dashed route only between the first and last station that hold work (3s per station), foot chips ("Faltan N" amber / "Todo forjado" green, "N cambios abiertos" pink, "Último movimiento hace …"). The scene is dark in both themes. A demo-only dashed block "Demo · Estado real / Apagada / Encendida / Simulación" is marked `data-demo-only`.
2. **Dependency graph** (Observabilidad → Dependencias; FRD-12): two levels — "Por FRD" compound boxes (`.fdag-box`: title button, state stack bar, work orders in chain order, 3 columns inside, 2 boxes per row, violet-tinted hairline) with cross-FRD lines aggregated per pair labelled with the count and "⇄" for the minority direction; "Por work order" columns by depth (`.dag-node` 176×46px tinted by state, curved edges, click lights the upstream/downstream chain and dims the rest, side card "Orden en foco" with "Depende de · N" / "Desbloquea · N" and "Abrir orden"). Below 900px both become ordered lists ("Paso N · M órdenes"). No zoom toolbar (the data-model diagram has one).
3. **Data-model diagram** (Arquitectura → Modelo de datos; FRD-02 REQ-02-015): teal "Modelo diseñado, no verificado contra una base viva" chip, search, Diagrama/Esquema segmented control, top-right toolbar (− % + fit reset fullscreen), 268px entity cards with PK/FK badges and types, selected entity lights its relations and dims the rest; Esquema = collapsed Prisma-like accordions; phones open on Esquema.
4. **Campaña journey map** (Idea → Campaña; FRD-02): dark map (`--map-*`) with six pixel-art rooms in a 5-column snake, corridors carrying the hand-off artifact (dashed, solid green once delivered), cast sprites idling/roaming/static, active room pulsing, progress strip "N/6 entregadas", and the phase sheet below (tinted head with number, state chip and prev/next; Descripción; Entra y sale Lee → Escribe; Equipo with stage sprites; Qué puedes correr with "Siguiente paso · avanza a …" highlighted).
5. **Órbita colour rules** (section 3): neutral chrome, semantic hue, no edge stripes, status-only green/amber/red, command boxes inheriting the container tint, phase colours as the deliberate exception.
6. **Guild identity**: gold crest with the level, rank emblem sprites with roman grade badges, trophy/seal/rarity tiles, radar of guild attributes, "Nv N" level chips; gold notice on new achievements.
7. **Plugin warning**: the only coral alert banner (first element of Inicio) mirrored by the sidebar pill.
8. **Document paper**: typed reader (`.paper` with a type chip, path and copy button) whose markdown takes the document type's hue (h1 tinted underline, h2 tinted, h4-h6 as small labels, tinted table heads and zebra rows, tinted code), index on the RIGHT.

## 7. Demo-only chrome and prototype findings (S2.1 / S3 inputs)

Preflight (`freeze/preflight.json`, generated 2026-10-22T01:43Z): 0 fail, 1 warn (`literalLengths`: 881 literal px lengths outside token blocks, acknowledged in the tracker). Findings from this pass, verified in the live prototype:

1. **Demo leak under `?demo=off`.** `[data-demo-only]` elements are hidden once at load (`prototype.js:2285`), but the La Fragua scene control (`.demo-inline[data-demo-only]`: "Demo · Estado real / Apagada / Encendida / Simulación") is re-created by every render of a project Resumen and stays visible (verified: `getClientRects().length = 1` on `#portfolio?project=mission-control` with `demo=off`). It leaks into 12 config states (verified by text capture): `project-summary`, `project-summary-funko`, `project-summary-decisions`, `project-decision-dialog`, `fragua-real`, `fragua-on`, `fragua-off`, `fragua-empty`, `fragua-token-card`, `overlay-behind`, `portfolio-project-picker`, `portfolio-project-picker-search` (the dialogs sit over a Resumen), and into the `proyecto` identity screen. The preflight's `demoLeaks` check passed because it did not load that route. A capture with the leak is an S3 BLOCKER ("invalid capture: demo leak"); fix in S2.1 by hiding at render time (or CSS `[data-demo-only]` under `html[data-demo="off"]`).
2. **Skip link navigates to `#content`** and the hash router renders Inicio (verified from #tablero). Either use `href="#content"` with a router that ignores it or an in-page handler.
3. **Inicio H1 "Centro de mando" ≠ nav label "Inicio"** (rule 4d: H1 equals the nav label). Justify as a deliberate deviation or rename.
4. **Transitions beyond transform/opacity**: color, background, border-color and box-shadow (160ms), the collapsible sidebar's `width`, and the dialog "pop" animates `opacity` on the whole dialog including its text. The DR-129 contract says only transforms animate and text never fades; the preflight `textFades` check passed. Decide at S3.
5. **Prototype-only strings in the shell**: footer text "Mission Control · Órbita, ronda 5 · propuesta de diseño, no es la app real." and the review-frame wording; the real app must not ship them.
6. **FRD links to a removed tab**: the Campaña ficha's "Entrar a La Fragua" targets `tab=Party`; the guide page "Elegir modo de construcción" still says "Portfolio → Party" (captured Manual content).
7. **Unused assets**: Manrope files and `manrope.css`.
8. **Interface strings left in English** inside Spanish screens: dialog kickers "Skill" / "Estándar · Programming", scope chip "project", model chips "opus/sonnet", "esfuerzo high". The FRD artifact names (FRD, ADR, work order, spec, backlog, PRD) are English by decision.

## 8. Config check against the packs (S0.3)

Validated with `loadConfig` from `plugin/skills/design/scripts/fidelity/config.mjs` after the edit: **OK, 128 states under 20 UI FRD folders (110 before, 18 added), 137 components (125 before, 12 added).** The config was edited only in `states` and `components`; nothing else moved. The file is tracked: `git diff` against HEAD shows only the 367 added lines.

### States added (each renders with the fixture; route and actions verified in the live prototype)

| Folder | State id | Route / action | Why (the AC that names it) |
|---|---|---|---|
| frd-02 | `idea-discarded` | `#idea?idea=client-report-builder` | FRD-02#U5: discarded idea detail with "Descartada" stage and the "Restaurar" button |
| frd-02 | `idea-restore-dialog` | same route, click `[data-action="restore-idea"]` | FRD-02#U5: restore confirmation |
| frd-02 | `idea-campaign-research` | `#idea?idea=market-stall-ledger&tab=Campaña` | AC-02-010.10: research ficha offers `/pandacorp:explore <idea>`; AC-02-010.4 phase sheet; AC-02-011.1 idea without Spec tab |
| frd-02 | `idea-campaign-design` | `#idea?idea=book-memory-without-spoilers&tab=Campaña&phase=2` | AC-02-010.8: Design ficha (Claude Design, components.md) |
| frd-02 | `idea-campaign-build` | `#idea?idea=funko-tracker&tab=Campaña` | AC-02-010.5 / .8: Build ficha and "Entrar a La Fragua" |
| frd-02 | `idea-campaign-release` | `#idea?idea=book-memory-without-spoilers&tab=Campaña&phase=5` | AC-02-010.7: locked future phase keeps its full ficha |
| frd-02 | `idea-architecture-frd-dialog` | `#idea?idea=funko-tracker&tab=Arquitectura`, click `.frd-cards .frdc-open` | AC-02-013.5 / .6: per-FRD plan dialog (blueprint line, no scoped DAG) |
| frd-02 | `idea-architecture-missing` | `#idea?idea=tiktok-crossposter&tab=Arquitectura` | AC-02-013.1: architecture not published |
| frd-02 | `model-none` | `#portfolio?project=personal-page-v2&tab=Arquitectura` | AC-02-015.7: explicit "no database" state |
| frd-04 | `project-summary-decisions` | `#portfolio?project=personal-page-v2` | REQ-04-004 / FRD-04#U1: pending decisions in Tu turno with age and scoped command, plus the upgrade notice |
| frd-04 | `project-spec-empty` | `#portfolio?project=mission-control&tab=Spec` | AC-04-013.4: Spec without a published digest |
| frd-05 | `wo-empty` | `#portfolio?project=pandacast&tab=Observabilidad` | FRD-05 edge case: project without work orders |
| frd-06 | `fragua-empty` | `#portfolio?project=pandacast` | AC-06-013.4: the never-built empty state of the scene |
| frd-07 | `config-rule-detail` | `#configuracion?tab=Reglas+de+decisión`, click `#rule-list details summary` | FRD-07#U3 / #U9: decision rule detail (default text) |
| frd-08 | `docs-page-tutorial` | `#documentacion?page=como-empezar` | FRD-08#U3: tutorial bucket with "Paso 2 de 2" |
| frd-08 | `docs-page-guide` | `#documentacion?page=g-modo` | FRD-08#U3: how-to guide bucket |
| frd-08 | `docs-page-team` | `#documentacion?page=el-equipo` | FRD-08#U19: "El equipo" concept with the agent cards |
| frd-08 | `docs-page-multi-runtime` | `#documentacion?page=multi-runtime` | FRD-08#U14-U16: multi-runtime concept |

### Components added (selector verified against the live prototype at 1280 px)

BuildModeCard (`.mode`, FRD-11 REQ-11-001) · PlanMosaic (`.mosaic`, FRD-02 AC-02-013.3) · PluginPill (`#sidebar .plugin-pill`, FRD-15) · LastAchievement (`.last-ach`, FRD-09/18) · NextRankCard (`.nr`, FRD-10) · SecretTile (`.secret`, FRD-10 U19) · SignalGroup (`.sig-group`, FRD-17) · StatKpi (`.kpi`), RecordTile (`.hstat`) and LedgerCard (`.ledger`) (FRD-10 AC-10-020.2, -027.1, -026.1) · TeamMember (`.tmember`, FRD-02 AC-02-010.4) · TransitionRow (`.trans li`, FRD-10 AC-10-023.2).

Still uncovered by a component (styled and drawn, left for S2.4 `components.md` to fold into a parent): the Propuesta renderers (`.feat`, `.risk`, `.pquote`, `.checks`, `.score-bar`, `.pbox`, `.gcard`, `.legal`), `.rel-row` (relations list inside a collapsed `details`), `.feed .entry` (collapsed engine log), the Logros trophy progress card (`.tprog`) and the documentation home pair (`.docs-pair`, `.docs-sub`). None is named by an AC as a component of its own.

### AC coverage by FRD (verdict table; the per-AC reasons are in each pack, section 1)

| FRD | ACs | Drawn | Partial | Not drawn | Behaviour only | States |
|---|---|---|---|---|---|---|
| FRD-02 | 59 | 26 | 19 | 3 | 11 | 32 |
| FRD-03 | 9 | 1 | 3 | 4 | 1 | 5 |
| FRD-04 | 23 | 6 | 12 | 2 | 3 | 14 |
| FRD-05 | 8 | 4 | 1 | 1 | 2 | 9 |
| FRD-06 | 63 | 5 | 14 | 35 | 9 | 5 |
| FRD-07 | 12 | 5 | 7 | 0 | 0 | 12 |
| FRD-08 | 19 | 2 | 7 | 3 | 7 | 9 |
| FRD-09 | 19 | 0 | 4 | 2 | 13 | 2 |
| FRD-10 | 39 | 20 | 14 | 2 | 3 | 7 |
| FRD-11 | 4 | 1 | 1 | 0 | 2 | 3 |
| FRD-12 | 21 | 2 | 5 | 10 | 4 | 6 |
| FRD-13 | 9 | 2 | 3 | 2 | 2 | 2 |
| FRD-15 | 8 | 2 | 0 | 2 | 4 | 1 |
| FRD-17 | 22 | 7 | 10 | 0 | 5 | 3 |
| FRD-18 | 24 | 4 | 7 | 11 | 2 | 3 |
| FRD-19 | 14 | 3 | 6 | 4 | 1 | 5 |
| FRD-20 | 6 | 1 | 1 | 1 | 3 | 1 |
| FRD-21 | 6 | 0 | 3 | 3 | 0 | 2 |
| FRD-22 | 23 | 5 | 10 | 4 | 4 | 6 |
| FRD-26 | 10 | 2 | 1 | 5 | 2 | 1 |
| **Total** | **398** | **98** | **128** | **94** | **78** | **128** |

### Not drawn on purpose (no state was added; these become Group B in S1.3 or leave the FRD)

Owner-decided out of v2: Inicio digest with mark-seen (FRD-18 REQ-18-005..009), board "recommended" badge (FRD-02 U1), Campaña per-phase checklists, deploy target and objectives in the Resumen, skill workflow diagram (FRD-07 U7, FRD-08 U9-U10), creation affordances (FRD-07 U9/U10 buttons).

Not owner-decided, not drawn, not drawable with the fixture: failed work-order treatment and "Bloqueado" column (FRD-05 REQ-05-002; the fixture has no failing order), project "al día / calm" and "no active projects" states (FRD-18), the quiet overlay ok badge (FRD-20 AC-20-001.2), pending-merge block in the Resumen and the shell chip (FRD-21 REQ-21-001, -004), backlog error banner (FRD-22 AC-22-004.2), fail-loud model errors (FRD-02 AC-02-015.7 malformed/oversized/unreadable), the global Accounts directory (FRD-26 AC-26-001..005, -007), the Obsoleta decision tag and the snapshot panel (FRD-04), the timeline view (FRD-12, removed by the owner in iteration 22), most of FRD-06's sprite/room/relay/flow-strip requirements, the celebration and level-up moments (FRD-09), the dismiss ✕ of proposal cards (FRD-17), and the agent level/XP/title (FRD-07).

