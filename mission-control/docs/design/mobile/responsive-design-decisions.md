# Mobile / responsive design — decisions (PROPOSAL · pending owner gate)

> **Status: PROPOSAL — not frozen, not built.** This documents the **mobile (~375px) layout decisions** for Mission Control so the owner can approve them *before* any code is written. It does **not** modify the frozen design contract (`DESIGN.md` / `design-tokens.json` / `docs/design/design-decisions.md`), introduces **no new visual system**, and changes **no app code**. The responsive build (Phase B) and the `target_platforms: desktop → responsive` flip happen later, in the build — not here.
>
> **Navigable mockup:** [`mission-control-mobile.html`](./mission-control-mobile.html) — a self-contained, mobile-first prototype that reuses the **frozen** tokens + RPG/pixel-art skin verbatim (copied from `prototype/index.html` lines 11–158). It is the visual artifact for the gate. Screenshots at 375px live alongside this file / were shared in the approval thread.

## Context & constraints

- Mission Control today is **desktop-only** (zero layout breakpoints — the prototype has no `@media` rules except theme + reduced-motion). Phase A (a parallel thread) is building the **global app shell**: a top bar on desktop, a **hamburger drawer on mobile**. This step does **not** design or touch that shell — it assumes it and focuses on the **content surfaces**.
- The bespoke system is **frozen** (DR-054/056): pixel-RPG skin, the `@theme` tokens, the three Party pixel-art sub-views. The mobile work **extends** that prototype with breakpoints **in the same frozen style** — it does not modernize or replace anything.
- Everything in the mockup uses existing primitives (`.panel`/`.rpgpanel`/`.card`/`.col`/`.rail`/`.navitem`/`.tab`/`.stab`/`.shield`/`.xpbar`/`.itemslot`/`.secthead`) and the frozen token vars. The only additions are a thin **mobile CSS layer** (the `CAPA MÓVIL` block) — nothing the design contract doesn't already imply.

## Two reusable mobile patterns (the whole design reduces to these)

The desktop layouts fall into two shapes, each with one mobile answer:

1. **Sidebar layouts (`Npx 1fr`) → top selector + full-width content.** Any fixed left sidebar (Portfolio rail `240px 1fr`, project Documentos `200px 1fr`, Manual nav `236px 1fr`) collapses to a **selector at the top** — a horizontal scroll-strip of chips for short lists (project rail, doc chips) or a **`<details>` disclosure dropdown** for long ones (Manual sections) — with the content stacked full-width below.
2. **Horizontal kanbans (`display:flex; overflow-x:auto`, fixed-width `.col`) → keep the scroll, add snap + a phase indicator.** The board and the work-orders board are *already* horizontal-scroll on desktop; on mobile we widen each column to `~84vw` (so one fills the viewport with the next peeking), add `scroll-snap-type: x mandatory` + `scroll-snap-align`, and add a **scrollable pill row** above that both labels the phases and lets you jump to one.

Everything else is **fluid/stack by default** (the prototype already uses `auto-fit minmax(...)` grids that collapse to one column under ~300px) — no dedicated decision needed.

---

## Surface-by-surface

### 1. Tablero (kanban) — **scroll-x with snap + phase pills**
- **Decision:** keep the existing horizontal-scroll container; on mobile each `.col` becomes `84vw` (max 300px) with **scroll-snap**, so swiping moves one phase at a time and the next column always peeks (affordance that there's more). A **scrollable pill row** (`1 Descubierta · 2 Documentada · …`) sits above as both a phase legend and a jump-to control; an explicit "desliza para recorrer las fases" hint.
- **Why:** the "idea travels the **6 phases**" metaphor is horizontal by nature; preserving the swipe keeps that mental model and reuses the exact desktop pattern. The pills + peeking column solve the only real mobile risk (not knowing more columns exist).
- **Rejected:** *vertical stack of columns* (turns a 6-phase pipeline into a very long single scroll, loses the journey metaphor); *one-column-per-tab* (extra chrome, hides the pipeline shape).

### 2. Project workspace + Party canvas — **subtab strip + the Party decision**
- **Subtabs (6: Resumen · Work orders · Party · Observabilidad · Documentos · Comandos):** become a **single horizontal scroll-strip** (no wrapping into 2–3 ragged rows), each `.stab` `white-space:nowrap; flex:0 0 auto`. Compact header (title · phase · version · progress bar) wraps fluidly above it.
- **Work orders subtab:** same kanban pattern as the Tablero (pattern #2) — reused verbatim.
- **Documentos subtab:** the `200px 1fr` doc nav becomes a **horizontal chip strip** of documents; the selected doc renders full-width below.
- **Party canvas (the hard one) — DECIDED: overview + drill-down (overview+detail).** The scene is a **920×560 fixed pixel-art stage** with absolutely-positioned rooms — it **cannot reflow**. Two naive options were prototyped and **both rejected by the owner** (and independently validated as dead ends by deep research, 2026-06-22):
  - **A — Fit-to-width** (the current embed behaviour, `fitEmbed`/`reportHeight`): scales the whole stage to ~0.38× at 375px → sprites unreadably tiny. *Rejected.* NN/g: "complex visualizations are often difficult to rescale well on small mobile screens"; MDN: non-integer scaling of pixel-art blurs with no clean CSS fix.
  - **B — Native scale + pan:** keeps pixel fidelity but **linearizes** the scene — only one region visible at a time, losing the at-a-glance overview. *Rejected.* NN/g: reflow/pan "requires users to go through the content sequentially."
  - **Chosen — Overview + drill-down (Shneiderman overview+detail / progressive disclosure / semantic zoom):** on mobile the Party becomes a **glanceable list of the rooms/phases** (each row = a room with a pixel zone-thumbnail, status chip, live count, and — for the active room — the running work-orders as small live sprite avatars + "corriendo: WO-…"). **Tapping a room opens THAT room at native pixel scale** (one room ≈ 250–340px fits 375px crisply), showing its sprites/halos/labels, with a "‹ Volver al mapa" back. The overview layer doubles as a position/length **phase encoding** (the most legible on a small screen — Cleveland-McGill), so the dashboard's *job* (which phase is active + what's running now) is preserved without the shrunken scene.
  - **Why this wins:** it resolves the A↔B tension directly — the overview keeps the **glanceable view of all phases** (what B lost) while the drill-down keeps the **pixel-art at native, crisp scale** (what A destroyed). It preserves the frozen RPG identity *on demand*, where it's legible. Backed by Shneiderman's Visual Information-Seeking Mantra ("overview first … details-on-demand"), NN/g progressive disclosure ("deferring secondary material is a key guideline for mobile"), and semantic-zoom LOD.
  - **Fidelity to the desktop scene (REQUIRED).** The mobile representation mirrors the **same three rooms** as desktop La Fragua — **Sala de Forja → Tribunal del Juez → Bóveda** (NOT four; "Fundación" is a *beat*, not a room) — with the same flow (1 sprite = 1 active work-order, role implementer; the wave = the build mode; foundation-first per DR-057; WOs cross Forja→Tribunal→Bóveda), the real FRD-14 work-order ids, and the real `Status Note`/says. An early mock invented a fourth "Fundación" room and was corrected. Zone art per desktop: forge=`backend.png`, tribunal=`tribunal.png`, vault=`boveda.png`.
  - **Live "see it in motion" demo (matches desktop).** Because the desktop scene shows the build *moving* (sprites flowing between rooms, counts growing), the mobile mock carries a compact **"SOLO DEMO"** control bar replicating the desktop harness: **play/pause · mode (Pro/Equilibrado/Potente/Profundo → the wave size) · reset**, plus a live KPI (FRD · oleada · project done/total) and a running **Bitácora**. A small simulation advances WOs queue→Forja→Tribunal→Bóveda over time so the owner can preview the motion; the overview counts/sprites and the open room update live. The bar is **demo-only** (labelled as not existing in the read-only real app), faithful to the desktop's own `controls.demo` note.
  - **Open / to refine in build:** the live-animation treatment on the overview uses **live pulse dots + a "running now" line + the Bitácora**, NOT a fisheye/focus+context (deep research *refuted* that focus+context is faster for dynamic views). La Fragua's individual room widths must be measured (La Campaña pipeline rooms are 250px and confirmed to fit; a wider Fragua room may need a contained down-scale or a short pan *within the single room*, far less costly than panning the whole stage).

### 3. Portfolio (rail + table) — **rail → top project selector, pane below**
- **Decision:** the `240px 1fr` project rail collapses to a **horizontal scroll-strip of project chips** at the top (each chip keeps its running/paused icon + the pending-decision/bug count badges); selecting one renders its workspace pane full-width below. The pane's internal "tables" (work orders, docs) follow patterns #1/#2.
- **Why:** pattern #1 (sidebar → top selector). A horizontal rail keeps all projects glanceable and the selected project's badges visible, without a permanent left column eating mobile width.
- **Rejected:** *dropdown `<select>` of projects* (hides the per-project status badges that make the rail useful); *stacking the full rail above the pane* (pushes the pane far down on first load).

### 4. Inicio / Propuestas / Logros / Documentación — **light responsive**
- **Inicio:** stat tiles → 2-col grid (`minmax` already collapses there); "Desde tu última visita" event cards and command rows stack full-width. **Fluid/stack, no special decision.**
- **Propuestas:** count tiles → 2-col; proposal cards stack one per row. **Fluid/stack.**
- **Logros:** the guild hero (`.shield` + `.xpbar` + `.rpggrid`) keeps its horizontal shield+bar layout (fits 375px); badges → **2-col grid**; locked badges keep the saturate/lock treatment. **Fluid/stack.**
- **Documentación (Manual):** the `236px 1fr` section nav becomes a **`<details>` "Secciones" disclosure** at the top (the index, grouped, with the active item highlighted), content full-width below; Reference grids (`minmax(290px,1fr)`) collapse to 1 column. **Pattern #1 (disclosure variant, for the long grouped index).**

---

## Notes for the build (Phase B — NOT done here)
- `target_platforms` stays **`desktop`** until the build flips it to `responsive` (DR-074). This step does not touch `.pandacorp/status.yaml`, work orders, `src/`, `layout.tsx`, `e2e/`, or `components.md`.
- The mobile patterns are **token-only / primitive-only** — no new components are required beyond responsive variants of existing ones (a real implementation would add the breakpoints to `globals.css` `@layer components` + the relevant feature CSS, per `styling-and-ui.md`).
- The mockup's Party iframe injects a tiny style to hide the standalone prototype's *"SOLO DEMO"* harness so the **scene reads clean for the screenshots** — that harness does not exist in the real app's Party tab; it is a mockup-only convenience and changes nothing about the decision.
