# Context pack · FRD-06 · Party · La Fragua (live build view)

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-06 copy, S2.1 builds, S2.2 amendments, S2.3-06 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-06-party/frd.md` (id FRD-06, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/frds/frd-06-party/mocks/la-fragua.html` (stale or missing: S2.2 repoints it to the approved prototype and the FRD's shard in `mocks/`) |
| Config states | 5 under `states["frd-06-party"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 63 AC lines: 5 drawn · 14 partially drawn · 35 not drawn · 9 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-06#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### AC-06-001.1 · partial · `fragua-real`, `fragua-on`

> - AC-06-001.1: WHILE a work order is a **running `implementer`** in the FRD, THE system SHALL render exactly **one sprite** for it in the Sala de Forja (one figure per running WO; role = `implementer`, full-stack).

**Prototype:** There is NO per-work-order sprite. La Fragua is a four-station scene (Cola · Taller · Revisión · Bóveda) whose station crews are fixed decorative sprites (product-manager; frontend-dev + backend-dev; reviewer + test-writer; devops). Each work order is a numbered token (FRD over order, e.g. 01 / 001). In-progress orders sit as tokens in Taller.

### AC-06-001.2 · not drawn · `fragua-real`

> - AC-06-001.2: THE system SHALL cap the number of concurrently-built (sprite-bearing) work orders at the **wave size of the run mode** (pro = 2, balanced = 4, powerful = 8, deep = 6), reading the mode from state.

**Prototype:** No wave-size cap by run mode: a station shows at most 8 tokens and "+N".

### AC-06-001.3 · partial · `fragua-real`

> - AC-06-001.3: WHILE the FRD has additional work orders not yet building (queued, blocked or pending dependencies), THE system SHALL render them as a single **"+N en cola"** count in the forge, NOT as sprites.

**Prototype:** "Cola" holds the orders not started (count + tokens, "Nada por empezar" when empty); overflow reads "+N", not "+N en cola".

### AC-06-001.4 · not drawn · `fragua-real`

> - AC-06-001.4: WHILE the **first wave of the FRD** is the **foundation wave** (the WO(s) marked `foundation`, forging the shared primitives), THE system SHALL mark that WO distinctly (a **"⛏️ Fundación"** tag) and SHALL hold the feature WOs in **"+N en cola"** until the foundation WO closes, conveying foundation-first (DR-057). **(PENDING / not built as of 2026-07-05 — reconciled from code: the "⛏️ Fundación" tag has no field in `FraguaSnapshot` and no rendering in `FraguaScene.tsx`; tracked as a separate iteration in `wo-06-007`. The "+N en cola" hold IS implemented; only the distinct foundation-tag marker is unbuilt.)**

**Prototype:** No "Fundación" tag or hold (the FRD itself marks this AC as pending/not built).

### AC-06-001.5 · behaviour only · `fragua-real`

> - AC-06-001.5: WHERE an event's work-order field (`wo`) carries **the FRD id itself** (`frd-NN-<slug>`) instead of a real work-order id — emitted for **FRD-level activity** (an agent working the feature as a whole, before/between its work orders) — THE system SHALL NOT treat it as a work order: it spawns **no sprite**, is **not** added to the running list, and does **not** inflate the global WO counter (REQ-06-002) or the queue. Only real work-order ids (and `foundation`) are work orders in the scene. **(IMPLEMENTED, 2026-06-30)** — a FRD-level `wo` previously rendered a phantom avatar labelled with the FRD id and counted as an extra WO; `toFraguaSnapshot` now filters `frd-`-prefixed `wo` ids in every event processor and in the cross-FRD WO-id tally.

**Prototype:** FRD-level event ids never become tokens: data rule.

### AC-06-001.6 · drawn · `fragua-real`

> - AC-06-001.6: THE per-work-order **room placement** (forge / Tribunal / Bóveda) SHALL agree with the **authoritative work-order state** the Work Orders board shows — the frontmatter `implementation_status` read by `listWorkOrders` (the SAME source, DR-092 single source for derived state) — NOT a second derivation. WHERE the board shows a work order as `IN_REVIEW`, THE Party SHALL place its sprite in the **Tribunal** (`in_review`); `VERIFIED` → **Bóveda** (`verified`); `BLOCKED`/`fail` → the queue (never a forge sprite, per the edge cases); otherwise → the forge (`building`). The event stream still drives **liveness/animation** (which sprite is alive, the walk), but the **frontmatter decides the structure**. **(REWORKED, 2026-07-01 — supersedes the 2026-06-30 `woStates` map)** — the scene STRUCTURE (sprites, rooms, queue, trophies, global counter, gate) is now derived from `opts.workOrders` (`listWorkOrders`, id + frd + state) in `toFraguaSnapshot`; events contribute only the FRD focus, the mode, liveness and the bitácora. The 2026-06-30 bound ("a transition reflects on the next render") is CLOSED: `PartyLiveShell` triggers a throttled `router.refresh()` when an SSE frame carries a genuinely newer event, so the fresh frontmatter reaches the scene mid-session and the sprite walks to its new room (the engine emits an event at every WO transition — `AgentWorking` at start, `wo_commit` at the green commit, `gate`/`achievement` at the gate — plugin v9.44.0). **(reconciled from code 2026-07-07 — the BACKWARD walk)** — a `wo_reopen` event now drives the backward transition explicitly: when a gate sends a work order back (`IN_REVIEW → PLANNED`), the state-map maps `wo_reopen` to `setWo(wo, 'building')` and `fragua-snapshot`'s `processWoReopen` returns the sprite from the tribunal to the forge — the ↩️ move the owner sees, LIVE, before the frontmatter refresh catches up.

**Prototype:** Station placement comes from the order state (todo→Cola, in_progress/fail→Taller, review→Revisión, done→Bóveda), e.g. Funko Tracker: Revisión 9, Bóveda 39.

### AC-06-002.1 · not drawn · `fragua-real`

> - AC-06-002.1: THE system SHALL set the scene to the **single FRD currently in build** and SHALL display that FRD's **title** (not only its id) in the scene header / FRD tracker.

**Prototype:** The scene is project-wide, not "the FRD in build"; its headline is a project verdict ("Construcción al 81 %: 39 de 48 work orders verificadas. …").

### AC-06-002.2 · partial · `fragua-real`

> - AC-06-002.2: THE system SHALL display a **global project counter** of work orders done over total (e.g. `52 / 109 WO`) in the header, so the view conveys "FRD by FRD". **(REWORKED, 2026-07-01)** — the counter reads the work-order FRONTMATTER (`done` = `VERIFIED`, total = all WOs), never the achievement-event tail: the event-derived count showed `0/1 WO` on a project the header itself reported `11/11` (events rotate; the last build predated the achievement emitters).

**Prototype:** Global counter appears in the headline sentence, in the hero ring "39/48 work orders verificados" and in the stacked forging bar (aria-label "39 verificadas, 9 en revisión, 0 en el taller, 0 en cola"); no literal "52 / 109 WO" header.

### AC-06-002.3 · drawn · `fragua-token-card`

> - AC-06-002.3: WHEN a sprite is hovered, THE system SHALL show a tooltip with that work order's **id and title**.

**Prototype:** Hover or focus on a token opens a card with the order code, state chip, title, a one-line description and "FRD-01 · Recorrer el catálogo".

### AC-06-003.1 · not drawn · `fragua-real`

> - AC-06-003.1: THE system SHALL render three rooms in a linear flow — **Sala de Forja** (left, active WOs), **Tribunal del Juez** (right, the review gate), **Bóveda** (bottom shelf, the FRD's verified trophies) — each with its label, and SHALL NOT render a 3-column kanban.

**Prototype:** The scene is four stations in a row (stacked one per row below 900 px), not Forja → Tribunal → Bóveda rooms; owner-approved replacement (iterations 19, 21, 24, 26).

### AC-06-003.2 · partial · `fragua-on`

> - AC-06-003.2: WHEN a work order transitions between rooms, THE system SHALL animate the move **inside / between rooms along the connecting stone bridges** (forge→tribunal horizontal, tribunal→vault vertical), never leaving a figure stranded mid-path at rest. The bridge connectors are **presentational**. **(IMPLEMENTED, 2026-06-30)** — The moving WO sprites are rendered as a single **stage-level layer** (one wrapper per running WO, in stage coordinates) whose positions are driven **imperatively from `engine.wos()` each animation frame** (`useFraguaSprites`): React owns the sprite list, the RAF loop owns their positions. The engine already computed the forge→tribunal→vault walk; previously `FraguaScene` never read it and placed sprites statically per-room, so they jumped on a state change. Now a WO actually walks. Verified WOs are static trophies in the Bóveda (they do not move); under `prefers-reduced-motion` the sprites are placed once at their target room (no RAF). **(HARDENED, 2026-07-01)** — the engine is now **persistent per scene** (one instance per frd/mode/wave/motion) with a **diff effect** feeding it only CHANGES: previously it was recreated on every `running` identity change — i.e. every SSE frame — so a live build reset any walk in flight every few seconds and in-review sprites teleported back to the forge to re-walk.

**Prototype:** A courier sprite carries orders along a gold route between the first and last station that hold work (3 s per station), only while live; no sprite walks between rooms and there are no stone bridges.

### AC-06-004.1 · not drawn · `fragua-real`

> - AC-06-004.1: THE system SHALL render exactly **one `reviewer`** figure for the FRD, dimmed, WHILE not all of the FRD's work orders are `IN_REVIEW`.

**Prototype:** No single dimmed reviewer figure; the Revisión station shows decorative crew sprites.

### AC-06-004.2 · not drawn · `fragua-real`

> - AC-06-004.2: WHEN **all** of the FRD's work orders reach `IN_REVIEW`, THE system SHALL activate the single `reviewer` (the gate opens) and SHALL indicate it reviews with **four lenses** (correctness, security, quality, **runtime/visual**). **(IMPLEMENTED, 2026-07-01)** — the open state derives from the engine's `gate` event OR from the frontmatter itself (every FRD WO at `review`/`done` with ≥1 still `review`), so the tribunal lights honestly even for a build whose engine predates the `gate` emitter. **(reconciled from code 2026-07-07 — the gate now CLOSES)** — the tribunal has a full open/close lifecycle: a `gate` event opens it, a later `GateVerdict` event closes it (the state-map's new `closeGate` action; `gateSignalForFrd` reads the latest gate-lifecycle signal per FRD, latest-wins/superseding, so a `GateVerdict` arriving after a `gate` event shuts the session LIVE — before the frontmatter refresh moves the sprites). Whatever the verdict, the tribunal session ends; the affected work orders then move on their own signals — a passed WO to the Bóveda via its frontmatter, a **reopened** WO back to the forge via `wo_reopen` (AC-06-001.6), a blocked WO to the enfermería via `fail`.

**Prototype:** No gate-open state and no "four lenses" indication.

### AC-06-004.3 · not drawn · `fragua-real`

> - AC-06-004.3: WHILE the gate is open, THE system SHALL indicate that the reviewer runs a **visual judge** (a screenshot of the rendered route compared against the mock) and **blesses the baseline** for the verified WOs, distinct from the four code lenses.

**Prototype:** No visual judge / baseline blessing indication.

### AC-06-004.4 · not drawn · `fragua-real`

> - AC-06-004.4: THE Tribunal SHALL provide at least **12 non-overlapping slots** (4×3) so up to 11 work orders of a FRD can be judged without sprites overlapping.

**Prototype:** No 12-slot tribunal.

### AC-06-005.1 · drawn · `fragua-real`

> - AC-06-005.1: WHEN a work order reaches `VERIFIED`, THE system SHALL place it as a **trophy** on the Bóveda shelf for the current FRD. **(IMPLEMENTED, 2026-07-01)** — trophies derive from the frontmatter (`done` WOs of the FRD), with achievement events merged on top; ZERO achievement events (the pre-v9.41 engine emitted none in a 5,000-line stream) no longer leaves the shelf empty. Closes the queued change `mc-party-trophies-frontmatter-fallback`.

**Prototype:** Bóveda lists verified orders as tokens (first 8, then "+31").

### AC-06-005.2 · not drawn · `fragua-real`

> - AC-06-005.2 *(superseded 2026-07-02 by AC-06-019.9/.10 — the v2 GLOBAL shelf)*: the Bóveda now
>   GROWS a row per 9 entries and shows everything; a fully-verified FRD collapses into ONE champion
>   entry, so scale comes from grouping, not hiding. A "+N más" indicator appears only past the
>   45-entry (5-row) ceiling and counts shelf ENTRIES.

**Prototype:** Superseded line (vault grows a row per 9 entries, "+N más" only past 45): the Bóveda shows the first 8 verified tokens and "+31"; no growing shelf.

### AC-06-006.1 · not drawn · `fragua-on`

> - AC-06-006.1: WHEN a work order closes and writes its `## Status Note`, THE system SHALL render a **parchment** travelling from that work order to a **dependent** work order's station (the Build Plan dependency), representing the document hand-off — asynchronous, via artifact, **not** a live chat.

**Prototype:** No Status Note parchment travelling to a dependent order (the courier is a generic cue).

### AC-06-006.2 · not drawn · `fragua-on`

> - AC-06-006.2: THE system SHALL drive the parchment from a real hand-off **event** (`HandoffWritten`), and SHALL NOT depict any live peer-to-peer conversation between work orders.

**Prototype:** Idem.

### AC-06-006.3 · not drawn · `fragua-real`

> - AC-06-006.3: THE system SHALL convey that the `## Status Note` carries **published interfaces AND decisions/assumptions** (not only the result), so the dependent WO reads the contract and the rationale.

**Prototype:** The Status Note contents are not conveyed on the scene (the work-order detail "Qué se construyó" holds them; see FRD-05).

### AC-06-007.1 · not drawn · `fragua-real`

> - AC-06-007.1: THE system SHALL convey that work orders writing the **same file artifacts** are **serialized into different waves** (never built in the same wave), so concurrent forge sprites never collide on a file (DR-060).

**Prototype:** Waves serialized by file artifact are not conveyed.

### AC-06-007.2 · not drawn · `fragua-real`

> - AC-06-007.2: THE system SHALL convey that **workers never touch git**: WHEN a wave's work orders close, the **engine commits the wave with a single serialized writer** (Option B) — no worktrees, no merge — and a sprite reaching `IN_REVIEW` SHALL indicate it does **not** commit itself.

**Prototype:** Option-B commit / "workers never touch git" not conveyed.

### AC-06-007.3 · not drawn · `fragua-real`

> - AC-06-007.3: WHEN the **whole project** completes (the global counter reaches its total), THE system SHALL surface a **cross-feature "Gran Integración"** event/state — a reviewer tracing the seams between features (each contract's producer/consumer agree) — in the feed and/or flow strip.

**Prototype:** No "Gran Integración" event (project 100 % shows "Todo forjado" chip instead of "Faltan N").

### AC-06-008.1 · not drawn · `fragua-real`

> - AC-06-008.1: WHILE a UI work order is building, THE system SHALL convey the **fidelity loop** — the WO **renders its route, compares against the mock and self-corrects (up to 3 times)** before reaching `IN_REVIEW` (DR-056) — and SHALL NOT depict fidelity correction as happening only at the gate.

**Prototype:** No fidelity-loop indication.

### AC-06-009.1 · not drawn · `fragua-real`

> - AC-06-009.1: WHILE the run mode is **deep** AND a work order has a frontend, THE system SHALL render that work order as a **sequential 3-step relay** — `test-writer` (RED) → `backend-dev` → `frontend-dev` — with a 3-segment progress indicator and the currently-active sub-step highlighted, and SHALL label the relay **"Opus"**.

**Prototype:** No deep-mode relay.

### AC-06-009.2 · not drawn · `fragua-real`

> - AC-06-009.2: THE system SHALL render the relay steps **sequentially** (the prior step completed before the next becomes active), and SHALL NOT show the three roles working simultaneously.

**Prototype:** Idem.

### AC-06-009.3 · not drawn · `fragua-real`

> - AC-06-009.3: WHEN `backend-dev` publishes the API contract, THE system SHALL render a **contract hand-off** (📄) between the `backend-dev` and `frontend-dev` steps, driven by the `ContractPublished` event, with a matching feed line.

**Prototype:** Idem.

### AC-06-009.4 · not drawn · `fragua-real`

> - AC-06-009.4: IF the run mode is deep AND the work order has **no** frontend, THEN THE system SHALL render it as a **single `implementer`** figure (no relay), matching the non-split modes.

**Prototype:** Idem.

### AC-06-010.1 · not drawn · `fragua-real`

> - AC-06-010.1: THE system SHALL render an **always-visible flow strip** of the whole build pipeline in fixed order — **Fundación → Oleada → Fidelidad → Status Note → Tribunal → Commit → Bóveda → Integración** — so the entire process is visible at a glance even when only part of it is active.

**Prototype:** No flow strip Fundación → … → Integración.

### AC-06-010.2 · not drawn · `fragua-real`

> - AC-06-010.2: WHILE a build is running, THE system SHALL **light the flow-strip beat(s) currently happening** (active styling) and dim the rest, deriving the active beat from the real build state/events.

**Prototype:** Idem.

### AC-06-010.3 · not drawn · `fragua-real`

> - AC-06-010.3: WHEN a flow-strip beat is hovered, THE system SHALL show a **tooltip** with that beat's name and a short description of what it does.

**Prototype:** Idem.

### AC-06-011.1 · behaviour only · `fragua-real`

> - AC-06-011.1: THE system SHALL feed off `AgentWorking` events carrying `{role, wo, frd, phase, activity, mode}` — plus the engine's `gate`/`achievement`/`wo_commit` lines — read from `~/.claude/dashboard-events.ndjson` via `lib/events.ts`, **without calling Claude** (read-only).

**Prototype:** Event feed contract, no visual.

### AC-06-011.2 · behaviour only · `fragua-real`

> - AC-06-011.2: WHEN an event omits the optional enriched fields (`frd`, `phase`, `activity`, `mode`), THE system SHALL still render gracefully (backward compatibility), falling back to defaults rather than throwing. An event whose `frd` is an **empty string** (FRD-less activity, e.g. the visual-qa pass) SHALL never become the scene's FRD. **(IMPLEMENTED, 2026-07-01)**

**Prototype:** Event fallbacks, no visual.

### AC-06-011.3 · behaviour only · `fragua-real`

> - AC-06-011.3: THE event tail SHALL be **scoped to the project** (the emitter's `basename $PWD`) with the filter applied **BEFORE the tail cap** (`readEvents({project})`, same for the SSE `?project=`), so neither another project's build nor any session's hook noise (`SubagentStop`/`SupervisorTick` fire from EVERY Claude conversation) can leak into the scene or crowd this project's events out of the 200-event tail. **(IMPLEMENTED, 2026-07-01)** — previously the Party derived everything from the UNFILTERED global tail: mission-control's Party would show personal-page-v2's FRD, and 182 of the 200 tail events were conversation noise.

**Prototype:** Project-scoped event tail, no visual.

### AC-06-012.1 · partial · `fragua-real`

> - AC-06-012.1: IN production Mission Control, THE system SHALL NOT expose any **effort/mode picker** nor any **power / reset / pause / agent-control** affordance — the build is launched by `/pandacorp:implement` and the effort is fixed there (DR-061); the view is read-only over the factory.

**Prototype:** Production must not expose a mode picker or controls: the scene control "Estado real / Apagada / Encendida / Simulación" is drawn as demo chrome (dashed block, "Demo" tag, note "En la app la escena muestra siempre el estado real del build."). DEFECT: it is re-created on every render and stays visible under `?demo=off` (the hide runs once at load, prototype.js:2285).

### AC-06-012.2 · partial · `fragua-real`

> - AC-06-012.2: THE effort/mode picker and the power / reset controls SHALL exist **only** in the prototype mockup, SHALL be visibly marked **"SOLO DEMO"** with a note that they do not exist in real read-only MC, and SHALL NOT ship in the Mission Control view.

**Prototype:** The demo block is marked "Demo" with a one-line note (DR-061), but not "SOLO DEMO".

### AC-06-012.3 · not drawn · `fragua-real`

> - AC-06-012.3: IN production Mission Control, THE system SHALL display the run **effort level as read-only data in the Misión bar** (next to the project WO progress), reading the mode from state.

**Prototype:** The effort level is NOT shown as read-only data anywhere on the scene or the Resumen.

### AC-06-013.1 · drawn · `fragua-off`

> - AC-06-013.1: WHILE **no build is running** (no active work orders / no agents working, derived from real state), THE system SHALL render a **factory-off state** with the agents **desaturated and tidied into their rooms**, never a blank screen or a crash.

**Prototype:** Factory-off: "El equipo descansa: no hay un build corriendo."; the courier is not drawn and the scene is idle. Station crews drop to saturate(.75) and stop the working jump; there is no tidy-into-rooms movement.

### AC-06-013.2 · partial · `fragua-off`, `fragua-real`

> - AC-06-013.2: THE factory-off state SHALL be **derived from real state**, NOT toggled by any control, and its overlay copy SHALL state that the factory is started by **launching `/pandacorp:implement`** (not "press play").

**Prototype:** Off state is derived from the real `running` flag by default (the control only previews). The copy does NOT say the factory starts with `/pandacorp:implement`; the Resumen's "Siguiente paso" carries the phase command instead.

### AC-06-013.3 · behaviour only · `fragua-on`

> - AC-06-013.3: WHEN a build becomes active again (events resume), THE system SHALL leave the factory-off state and resaturate the scene automatically.

**Prototype:** Resuming on new events is behaviour (live refresh not captured).

### AC-06-013.4 · drawn · `fragua-real`, `fragua-off`

> - AC-06-013.4: THE "is a build running" signal SHALL be the project's **authoritative `running` flag from `status.yaml`**, NOT mere presence of events. The event ndjson retains the LAST build's events indefinitely, so when `running` is `false` THE system SHALL render the powered-off state (no running-WO sprite, no lit flow-strip beat) even though a stale event tail is present — events alone cannot distinguish "building now" from "finished long ago". A build that EXISTS but is off SHALL still render the scene in its powered-off state (the grey factory-off design), NOT the never-built empty state (AC-06-010.1).

**Prototype:** `running` drives the default mode (Funko Tracker running → "El equipo está trabajando"; Mission Control not running → "El equipo descansa"). A build that exists but is off still renders the scene (Bóveda 109 for Mission Control). The never-built empty message is a separate state (fragua-empty).

### AC-06-014.1 · behaviour only · `fragua-on`

> - AC-06-014.1: WHEN `prefers-reduced-motion` is set, THE system SHALL disable ALL Party animation (sprites static, no RAF loop, no judge sprite movement, no parchment travel) while keeping the scene readable.

**Prototype:** Under `prefers-reduced-motion` all scene animation stops (CSS); not a captured state.

### AC-06-014.2 · not drawn · `fragua-real`

> - AC-06-014.2: WHILE events from more than one project are present, THE system SHALL distinguish them with a **project-color (left border) + role-color (second border)**; events with no `project` field render with the role color only (legacy/global).

**Prototype:** No multi-project colour distinction in the (collapsed) engine log.

### AC-06-015.1 · partial · `fragua-real`

> - AC-06-015.1: THE system SHALL show a **bitácora del gremio** — a feed of the real build events (foundation forging, work starting, the `Status Note` hand-off, the deep contract, the gate opening with its 4 lenses + visual judge, the wave commit, the Gran Integración), each row using the fixed bounded iconic vocabulary, the role color, and a `tabular-nums` timestamp, with **failure as a first-class state** (never hidden), auto-scroll to newest + a pin button, and an in-memory cap (≤200, drop oldest).

**Prototype:** "Bitácora técnica del motor 44 / Notas en crudo del build" is a collapsed raw log inside a card, not the iconic event feed with role colour, timestamps and a pin button; failure states are not drawn.

### AC-06-015.2 · not drawn · `fragua-real`

> - AC-06-015.2: THE bitácora SHALL render **BELOW the scene at full width** (owner decision 2026-07-01 — the side-by-side row squeezed it against the fixed 920px stage), its icons SHALL be **emoji glyphs actually rendered** (the previous Lucide identifier strings printed literally — "circle-dashed" — because no consumer resolved them and lucide is not a dependency), its vocabulary SHALL cover the REAL emitted event names (`AgentWorking` refined by phase/activity, `BuildLaunch`/`BuildRelaunch`, `ReviewVerdict`/`GateVerdict` with the verdict, `wo_commit`, `gate`, `achievement`), and session noise (`SupervisorTick`, non-failing hook `SubagentStop`) SHALL be filtered out (`isFeedEvent`) — a failure ALWAYS passes whatever its type. **(IMPLEMENTED, 2026-07-01)** **(reconciled from code 2026-07-07)** — the bounded feed vocabulary grew 16 → 19 icon types to cover the new build-engine events: `wo_reopen` (↩️ WO reabierto), `Hardening` (🛡️ Endurecimiento — the security/telemetry/integration close-out stage), `PatchResult` (🩹 Parche — the reviewer's patch-attempt outcome), plus `BuildComplete` (🏁) and `PreviewSmoke` (which carries no own icon — it resolves into the shared ✅/❌ test glyphs by its `pass` flag, with the real `routes`/`failed` counts). The engine now mixes second- and millisecond-precision timestamps, so feed ordering + `lastEventAt` normalize through `Date.parse` (`isNewerTimestamp`), never a lexicographic compare.

**Prototype:** The log is at the bottom full width, but without emoji icons, event vocabulary or filtering.

### AC-06-016.1 · partial · `guild-achievement-notice`

> - AC-06-016.1: WHEN a work order closes (reaches `VERIFIED`), THE system SHALL fire an **achievement** toast ("¡Logro desbloqueado!") with the work-order id, using transform/opacity motion under 300 ms, with a reduced-motion variant that renders without animation.

**Prototype:** The gold notice "¡Nuevo logro!" (preview: "Vista previa del aviso") with title, description, "Ver" and a close button is drawn on Inicio; it is tied to guild trophies (≤7 days old), not to a work order closing in La Fragua. Copy differs from "¡Logro desbloqueado!".

### AC-06-017.1 · behaviour only · `fragua-on`

> - AC-06-017.1: THE judge sprite movement, the agent **speech bubbles**, and the stone-bridge connectors between rooms SHALL be treated as **presentational** — they decorate the real engine events and SHALL NOT imply any engine behavior (live chat, control, or hand-off) that the engine does not perform.

**Prototype:** Decorative layer principle.

### AC-06-018.1 · partial · `fragua-real`

> - AC-06-018.1: WHILE a work order is building or in review, THE system SHALL animate its sprite with a continuous ambient motion (a gentle bob + a breathing halo) so an actively-working agent reads as alive even when no new event has arrived; verified (`VERIFIED`) trophy sprites and idle sprites SHALL stay still.

**Prototype:** Station crews idle-bob continuously (camp-idle) and jump while a build is live (fr-work); verified tokens stay still. There is no per-order halo.

### AC-06-018.2 · not drawn · `fragua-real`

> - AC-06-018.2: WHILE a work order is in the forge (sprite state `work`), THE system SHALL show a **forge "forging" indicator** on its sprite — a hammer striking above the head plus a warm ember glow (the under-sprite halo tinted `--color-warn`) — as decorative "it's being forged" eye-candy, NOT a progress value (no bar, no percentage, no fabricated fill). The real progress is conveyed by the room/walk (AC-06-003.2 / AC-06-013), not here. The hammer SHALL appear ONLY in the `work` state (hidden in vault/idle/review/etc.); under `prefers-reduced-motion` it SHALL fall back to a static raised hammer (AC-06-018.5).

**Prototype:** No hammer or ember glow.

### AC-06-018.3 · not drawn · `fragua-real`

> - AC-06-018.3 *(superseded 2026-07-02 by AC-06-019.7/.9)*: the bespoke heartbeat chip gave way to
>   the DR-066 **FreshnessBadge** — the single liveness voice, with three graded bands (en vivo /
>   datos de hace N min / sin señal) fed by the freshest of the supervisor heartbeat and the latest
>   event. Text + symbol, never color alone (unchanged principle).

**Prototype:** Superseded line (DR-066 FreshnessBadge is the single liveness voice): no freshness badge is drawn.

### AC-06-018.4 · not drawn · `fragua-real`

> - AC-06-018.4: THE always-visible flow strip SHALL softly pulse its **active** beat(s) so the top pipeline reads as live.

**Prototype:** No flow strip to pulse.

### AC-06-018.5 · behaviour only · `fragua-real`

> - AC-06-018.5: WHEN `prefers-reduced-motion` is set, ALL of the above liveness animations SHALL be disabled (consistent with AC-06-014.1), each falling back to a sensible **static** state that still communicates "active" (a steady halo, a visible band, a solid heartbeat dot) — liveness is softened, never reduced to a dead/blank scene.

**Prototype:** Reduced-motion fallbacks are CSS, not a state.

### AC-06-019.1 · not drawn · `fragua-real`

> - AC-06-019.1: THE forge SHALL show the CURRENT WAVE — one sprite per `in_progress` work order across
>   **all** FRDs (≤ the mode's wave), each carrying its FRD's **stable palette color** (a small banner
>   under the sprite; the frd id also travels in `data-frd` + the tooltip — never color alone).

**Prototype:** The Taller does not draw sprites per FRD with a palette banner; the FRD code is on the token (top line) and in its card.

### AC-06-019.2 · not drawn · `fragua-real`

> - AC-06-019.2: THE tribunal SHALL model the SERIALIZED gate queue: every `review` WO stands in the
>   room (≤12 slots); the FRDs whose WOs are ALL at review/done form the **line** — the head (or the
>   freshest engine `gate` event's FRD) is **"en sesión"**, the rest render as waiting chips.

**Prototype:** No tribunal queue with "en sesión" chips.

### AC-06-019.3 · partial · `fragua-real`

> - AC-06-019.3: THE system SHALL render **La Campaña** above the scene — one chip per FRD with its
>   REAL state from the frontmatter (`pending / building / in_review / verified / blocked`, with
>   done/total), in file order, each with its stable FRD color; the chip under judgment is emphasized.

**Prototype:** Per-FRD state is drawn in "Avance por FRD" (name, stacked bar by state with aria-label, n/m) below the scene, not as chips above it.

### AC-06-019.4 · partial · `fragua-real`

> - AC-06-019.4: Trophies on the Bóveda SHALL be the LATEST `done` WOs across the project (≤9, rest
>   archived), each with its FRD color plaque; the scene focus (`snapshot.frd`, MissionBar) SHALL be
>   the FRD under judgment, else the first one building (campaign file order), else the freshest
>   event FRD, else the frontmatter's in-flight FRD. An event whose `frd` field is **composite**
>   (several ids joined by comma, a run-level event spanning many FRDs, the normal case under
>   parallel FRD gates) belongs to no single FRD: like an empty `frd`, it is never the freshest
>   event FRD and never names the focus (decided 2026-09-30 under owner delegation).

**Prototype:** The Bóveda shows verified tokens (first 8 + "+N"), not the latest ≤9 with FRD plaque; the scene focus FRD does not exist.

### AC-06-019.5 · behaviour only · `fragua-on`

> - AC-06-019.5: THE sprite engine SHALL persist across the whole build (one instance per scene, not
>   per FRD) so a change of the judged/focused FRD never resets in-flight walks.

**Prototype:** Sprite engine persistence: no sprite engine.

### AC-06-019.6 · partial · `fragua-on`

> - AC-06-019.6 (Fase 2 — vida): THE scene SHALL converse with REAL data: one rotating speech bubble
>   (every ~6s, one sprite at a time) showing the WO id + its real elapsed time ("N min al fuego",
>   from track.jsonl `wo_start` — never a fabricated progress value); a BLOCKED (`fail`) work order
>   SHALL rest in the **enfermería** (a visible bed strip, never a hidden "+N en cola" slot); a fresh
>   engine `wo_commit` event SHALL cue the **courier** — the parchment runs forge → tribunal (a
>   decorative cue anchored to the real per-WO green commit); ambient chimney smoke is pure-CSS
>   decoration. All of it disabled/softened under `prefers-reduced-motion`. **(IMPLEMENTED, 2026-07-01
>   — Fase 2. Pixel-art assets delivered by the owner 2026-07-02 (one 2×2 sheet, cropped/keyed in):
>   `zones/infirmary.png` + `zones/camp.png` (627×627, camp staged for Fase 3's worktree tents) and
>   `agents/courier.png` + `agents/panda-mascot.png` (341×341, edge flood-fill transparency). Wired:
>   the courier flight uses the courier sprite, the enfermería strip sits on the dimmed infirmary room
>   art, and the panda mascot strolls the stage bottom on a long pure-CSS loop — hidden under
>   reduced-motion.)**

**Prototype:** The courier cue exists (while live); no rotating speech bubble with "N min al fuego"; blocked (`fail`) orders sit in Taller (no enfermería bed strip).

### AC-06-019.11 · not drawn · `fragua-real`

> - AC-06-019.11 (Fase 3 — pulso y cierre, 2026-07-02): THE **campamento** (owner art
>   `zones/camp.png`) SHALL render as a corner patch in the tribunal, OCCUPIED-ONLY (same doctrine
>   as the enfermería): one ⛺ per pending-merge worktree/branch (≤3 + "+N"), fed by the SAME
>   `readPending` the Summary tab and the "⎇ pendientes" chip use (FRD-21, DR-092) — on a read
>   error the camp simply doesn't render (the Summary tab owns the error surface). THE sprite
>   engine SHALL position sprites via `transform: translate(...)`, never per-frame `left/top`
>   (no layout pass — measured 0.163 ms/frame total main-thread on the idle scene, layout 0.0 ms,
>   against the <2 ms budget). The Fase-3 ticker was consciously DROPPED: it would duplicate the
>   feed's voice (AC-06-019.9 one-voice rule); the walk-into-the-pile animation died with the pile
>   (AC-06-019.10 champion). This closes La Fragua v2 — Fases 1, 2 and 3 delivered.

**Prototype:** No campamento / tents for pending-merge worktrees (the work trees live on Inicio, FRD-21).

### AC-06-019.10 · partial · `guild-achievement-notice`

> - AC-06-019.10 (fit & finish, owner 2026-07-02): THE achievement toast SHALL fire only for an
>   achievement FRESHER than 3 minutes (a stale tail replay is history — the feed shows it) AND
>   SHALL carry a manual ✕ dismiss, so it can never greet a page visit hours later nor get stuck;
>   THE Misión strip SHALL show the campaign summary ("N/M FRDs") where the pips were (the strip
>   read as empty); THE completed-FRD trophy SHALL read BIGGER, not
>   busier: ONE champion sprite (scaled ~1.18, bottom-anchored) with a 🏆 mark over the shoulder and
>   the `FRD-NN` tag — instantly distinguishable at a glance from a loose WO's normal statuette
>   (owner iterated away the stacked-pile idea: three offset sprites read clunky). Vault rows carry
>   78px pitch + bottom clearance so a scaled champion never invades the next row nor clips its tag
>   at the stage edge.

**Prototype:** The toast has a manual close and auto-closes after 9 s; the Misión strip "N/M FRDs" and the champion trophy are NOT drawn.

### AC-06-019.9 · not drawn · `fragua-real`

> - AC-06-019.9 (one voice per datum + growing vault, owner 2026-07-02): EVERY datum SHALL appear
>   ONCE on the Party screen — the Misión strip carries the global WO counter and the effort
>   (now with the wave size, "potente · 8 paralelos") and NO single-FRD chip (a mono-FRD relic);
>   the scene renders NO internal header (the old FRD tracker / duplicate counter / duplicate mode
>   display are removed); the tab header carries NO signal chip and the scene no heartbeat chip —
>   the DR-066 FreshnessBadge is the single liveness voice (supersedes the AC-06-018 heartbeat chip
>   and the header live/no-signal chips). THE Bóveda SHALL grow a row per 9 shelf entries (smooth
>   height/position transitions) instead of hiding finished work behind a counter; its corner count
>   is the TOTAL entries; "+N más" appears only past the 45-entry (5-row) ceiling and counts shelf
>   ENTRIES (a completed FRD = one entry), never the WOs inside groups. THE enfermería — a corner
>   patch inside the forge, not a full room — renders ONLY while a blocked WO occupies a bed
>   (owner reverted the brief permanent-empty variant the same day: an always-there empty hut read
>   stranger than the pop-in; it overlays nothing, so appearing never pushes the vault).

**Prototype:** There is no Misión strip with counter and effort; the freshness badge (DR-066) is NOT drawn (only a "Captura …" stamp).

### AC-06-019.8 · not drawn · `fragua-real`

> - AC-06-019.8 (vault grouping + quiet palette, owner 2026-07-02): WHEN every work order of a FRD
>   is VERIFIED, THE Bóveda SHALL show that FRD as ONE stacked trophy labelled `FRD-NN` (ghost
>   sprites suggest the pile; tooltip carries the WO count) instead of N individual statuettes;
>   loose verified WOs of in-progress FRDs keep their own statuette, and "+N arch." counts the
>   REPRESENTED work orders. AND the Party's chrome SHALL stay aligned with the app palette: the
>   Campaña chips carry neutral borders (FRD identity ONLY as a small dot; "en sesión" = app
>   accent), the feed rows carry a single 3px left stripe (never a full colored outline), the
>   feed's "Ir al último" pin is a neutral readable chip, and the per-sprite FRD marker is a
>   small dot, not a bar (it read as a loader) — removed entirely in the vault. A finished build
>   (all WOs done, no event tail) still renders its scene and shelf.

**Prototype:** No vault grouping per finished FRD.

### AC-06-019.7 · not drawn · `fragua-real`

> - AC-06-019.7 (DR-066 consumer): THE Party surface SHALL declare its own freshness with a graded
>   badge — "en vivo" (signal < 3·T), "datos de hace N min" (< 10-min TTL), "sin señal" (≥ TTL or no
>   signal) — fed by the freshest of the supervisor heartbeat (`status.yaml`) and the latest event;
>   AND the live shell SHALL refresh its RSC-derived structure when the SSE frame's `stateVersion`
>   moves (a build advancing state without emitting an event must not read as dead). The badge is
>   `data-volatile` (DR-088). (Change `mc-observability-consumer-dr066`, 2026-07-02.)

**Prototype:** No graded freshness badge ("en vivo / datos de hace N min / sin señal").

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `fragua-real` | `#portfolio?project=funko-tracker` | (none) | full page | `AC-06-001.1` `AC-06-001.2` `AC-06-001.3` `AC-06-001.4` `AC-06-001.5` `AC-06-001.6` `AC-06-002.1` `AC-06-002.2` `AC-06-003.1` `AC-06-004.1` `AC-06-004.2` `AC-06-004.3` `AC-06-004.4` `AC-06-005.1` `AC-06-006.3` `AC-06-007.1` `AC-06-007.2` `AC-06-007.3` `AC-06-008.1` `AC-06-009.1` `AC-06-009.2` `AC-06-009.3` `AC-06-009.4` `AC-06-010.1` `AC-06-010.2` `AC-06-010.3` `AC-06-011.1` `AC-06-011.2` `AC-06-011.3` `AC-06-012.1` `AC-06-012.2` `AC-06-012.3` `AC-06-013.2` `AC-06-013.4` `AC-06-014.2` `AC-06-015.1` `AC-06-015.2` `AC-06-018.1` `AC-06-018.2` `AC-06-018.4` `AC-06-018.5` `AC-06-019.1` `AC-06-019.2` `AC-06-019.3` `AC-06-019.4` `AC-06-019.11` `AC-06-019.9` `AC-06-019.8` `AC-06-019.7` `AC-06-005.2` `AC-06-018.3` |
| `fragua-on` | `#portfolio?project=funko-tracker&scene=on` | (none) | full page | `AC-06-001.1` `AC-06-003.2` `AC-06-006.1` `AC-06-006.2` `AC-06-013.3` `AC-06-014.1` `AC-06-017.1` `AC-06-019.5` `AC-06-019.6` |
| `fragua-off` | `#portfolio?project=funko-tracker&scene=off` | (none) | full page | `AC-06-013.1` `AC-06-013.2` `AC-06-013.4` |
| `fragua-empty` | `#portfolio?project=pandacast` | (none) | full page | — |
| `fragua-token-card` | `#portfolio?project=funko-tracker` | scroll `.fragua` into view → wait 300 ms → js `document.querySelector('.token[data-wo]').focus({ preventScroll: true })` → wait for `#tok-tip` | capture viewport | `AC-06-002.3` |

States cited above that belong to another FRD folder (captured there, reused here): `guild-achievement-notice`.

**Not drawn (35)**: `AC-06-001.2`, `AC-06-001.4`, `AC-06-002.1`, `AC-06-003.1`, `AC-06-004.1`, `AC-06-004.2`, `AC-06-004.3`, `AC-06-004.4`, `AC-06-005.2`, `AC-06-006.1`, `AC-06-006.2`, `AC-06-006.3`, `AC-06-007.1`, `AC-06-007.2`, `AC-06-007.3`, `AC-06-008.1`, `AC-06-009.1`, `AC-06-009.2`, `AC-06-009.3`, `AC-06-009.4`, `AC-06-010.1`, `AC-06-010.2`, `AC-06-010.3`, `AC-06-012.3`, `AC-06-014.2`, `AC-06-015.2`, `AC-06-018.2`, `AC-06-018.3`, `AC-06-018.4`, `AC-06-019.1`, `AC-06-019.2`, `AC-06-019.11`, `AC-06-019.9`, `AC-06-019.8`, `AC-06-019.7`.

**Partially drawn (14)**: `AC-06-001.1`, `AC-06-001.3`, `AC-06-002.2`, `AC-06-003.2`, `AC-06-012.1`, `AC-06-012.2`, `AC-06-013.2`, `AC-06-015.1`, `AC-06-016.1`, `AC-06-018.1`, `AC-06-019.3`, `AC-06-019.4`, `AC-06-019.6`, `AC-06-019.10`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): `fragua-empty`.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### Shared page chrome (listed once, appears in most states of this FRD)

- Ruta
- FT
- v1
- Construyendo
- Cambiar proyecto
- 81% completado
- work orders verificados
- FRDs
- ADRs
- cambios abiertos
- hoy
- último movimiento
- Fase: Construcción
- Ver secciones anteriores
- Ver más secciones
- Secciones de Funko Tracker
- Spec
- Observabilidad 48
- Cuentas 10
- Cambios 21
- Documentos 82
- Siguiente paso:
- /pandacorp: release
- Copiar /pandacorp:release
- La Fragua · Funko Tracker
- Construcción al 81 %: 39 de 48 work orders verificadas. Las 9 restantes ya están construidas y esperan la revisión de su FRD. 21 cambios abiertos. 1 cosa espera tu decisión.
- Espera tu decisión
- Demo
- Estado de la escena
- Estado real
- Apagada
- Encendida
- Simulación
- En la app la escena muestra siempre el estado real del build.
- 39 verificadas, 9 en revisión, 0 en el taller, 0 en cola
- Cola
- por empezar
- Nada por empezar
- Nadie construyendo ahora
- esperan a su FRD
- WO-01-001: Catalog read model and seed loader
- WO-01-016: Catalog smoke and visual baselines
- WO-03-008: Collection counters per franchise
- WO-05-003: Export modes for all, owned and missing
- WO-05-004: Poster layout for long lists
- WO-05-005: Share link with expiry
- WO-05-006: Export history page
- WO-08-001: Help and FAQ pages
- WO-01-002: Franchise index page
- WO-01-003: Series grid with lazy images
- WO-01-004: Figure card component
- WO-01-005: Search box with debounced query
- WO-01-006: Filter chips by series and year
- WO-01-007: Variant badges for chase and exclusive pieces
- WO-01-008: Empty and error states for the catalog
- WO-01-009: Pagination with stable URLs
- Faltan 9
- 21 cambios abiertos
- Último movimiento hoy
- Cada cuadradito es una work order real: púlsalo para abrirla.
- … 33 more

### `fragua-real`

- [p] El equipo está trabajando: hay un build corriendo.

### `fragua-on`

- [p] El equipo está trabajando: hay un build corriendo.

### `fragua-off`

- [p] El equipo descansa: no hay un build corriendo. (Vista apagada a pedido; en realidad hay un build corriendo.)

### `fragua-empty`

- [span] PC
- [span] Sin construcción activa
- [small] Plan aún sin work orders
- [b] ayer
- [@aria-label] Fase: Arquitectura
- [@aria-label] Secciones de PandaCast
- [button[tab]] Cuentas 7
- [button[tab]] Documentos 11
- [@aria-label] Actualización pendiente
- [b] Este proyecto usa una versión vieja del motor de Pandacorp
- [p] Va con la v8.98.0 y la fábrica ya está en la v8.110.0. Actualízalo para que el próximo build use las reglas y herramientas nuevas.
- [code] /pandacorp: upgrade
- [@aria-label] Copiar /pandacorp:upgrade
- [span] Córrelo en la carpeta de PandaCast
- [code] /pandacorp: implement
- [@aria-label] Copiar /pandacorp:implement
- [span] La Fragua · PandaCast
- [h2] Fase de arquitectura: el plan de construcción todavía no tiene work orders. Nada espera tu decisión.
- [p] El equipo descansa: no hay un build corriendo.
- [span] Avanzando
- [p] Aún no hay work orders: la escena se llena cuando la arquitectura publique el plan.
- [span] Todo forjado
- [span] 0 cambios abiertos
- [span] Último movimiento ayer
- [h2] Avance por FRD 4
- [strong] FRD-01Acceso del creador
- [@aria-label] 0 verificado, 0 en revisión, 0 en curso, 0 bloqueado, 0 planificado
- [strong] FRD-02Conexiones con plataformas
- [strong] FRD-03Panel de videos
- [strong] FRD-04Motor de publicación cruzada
- [p] Sin decisiones tuyas registradas.
- [h2] Tu turno
- [p] Nada espera tu acción en este proyecto.
- [p] Sin avances registrados todavía.

### `fragua-token-card`

- [dlg span] Builds catalog read model and seed loader so the browse the catalog feature has one honest source for this …

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- Rooms "Sala de Forja / Tribunal del Juez / Bóveda" | stations "Cola / Taller / Revisión / Bóveda" (fragua-real).
- AC-06-013.2 "launching /pandacorp:implement (not press play)" | "El equipo descansa: no hay un build corriendo." (fragua-off).
- AC-06-012.2 "SOLO DEMO" | "Demo" (tag) + "En la app la escena muestra siempre el estado real del build.".
- AC-06-016.1 "¡Logro desbloqueado!" | "¡Nuevo logro!" / "Vista previa del aviso" (guild-achievement-notice).
- AC-06-001.3 "+N en cola" | "+N" overflow on a token row and the "Cola" station.
- Empty station messages (not in the FRD): "Nada por empezar", "Nadie construyendo ahora", "Nada esperando revisión", "Aún nada verificado".
- Counter "52 / 109 WO" | "39 de 48 work orders verificadas" (sentence), "Faltan 9" / "Todo forjado" chips.

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- The whole FRD describes a sprite-per-WO scene with rooms, flow strip, tribunal and relays; the approved prototype replaces it with a four-station token board merged into the Resumen (no Party tab). Most of the 61 ACs have no drawn counterpart (see the verdict table): they are Group B (FRD wants, prototype lacks) unless the owner removes them from the FRD at M1.
- AC-06-012.1 conflicts with the prototype's own behaviour: the DEMO scene control leaks under `?demo=off` (defect for S2.1).
- The tab "Party" disappears (FRD-04, FRD-12 and FRD-02 mention it).
- Effort level read-only data (AC-06-012.3) is missing from every surface.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- 2026-10-21 iteration 19 red team: kill criterion for the scene "if a build-day visit does not answer 'how much is left and where' faster than the Resumen, fold it into the Resumen as a strip" — executed in iteration 21: La Fragua is the top of the Resumen, the Party tab is removed.
- Iteration 24: tokens show the order code on two lines (FRD over order), 44×40 px at the 12 px type floor; hover/focus opens a card; eight tokens per station then "+N"; stations of equal height with dashed slots and a short message when empty; the courier walks only between the first and last stations that hold work; the scene keeps the DARK palette in the light theme (scene tokens in base.css).
- Iteration 26: below 900 px one station per row (crew, name and count, then its orders); no tall half-empty boards.
- Iteration 21: the scene control (Estado real / Apagada / Encendida / Simulación) is demo-only and labelled; the real app always shows the real state.
- 2026-10-21 scope: nothing in the FRD-06 list is among the "stay out of v2" features, so the N rows above need an owner decision at M1.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
