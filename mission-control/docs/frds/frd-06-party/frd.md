---
id: FRD-06
type: frd
title: FRD-06 — Party · La Fragua (live build view)
parent: product/prd.md
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/frds/frd-06-party/mocks/la-fragua.html
last_updated: '2026-07-01'
---
# FRD-06 — Party · La Fragua (live build view)

A faithful, living-world view of the **build** as the v2 engine runs it, surfaced in **Portfolio →
project → Party tab**. The build agent is a generalist **`implementer`** — one running figure per work
order — orchestrated FRD by FRD by a deterministic script (Dynamic Workflows, DR-013), **not** a team
of specialists chatting live. The engine builds **foundation-first** (the first wave forges the shared
primitives, later features reuse them), in **disjoint waves serialized by file artifact** (work orders
that write the same files never collide), with **per-WO in-loop fidelity** (a UI WO renders its route,
compares it to the mock and self-corrects ≤3 before review). The review gate is **one `reviewer` per
FRD** judging with **4 lenses + a visual judge + baseline blessing**; the engine commits each wave with
a **single serialized writer (Option B)** — workers never touch git. At project close a **cross-feature
"Gran Integración"** traces the seams between features. The scene is always **the FRD currently in
build**; rooms (Forja → Tribunal → Bóveda) replace the old 4-zone kanban, and all communication is by
document (the `## Status Note`), never live peer chat.

> Supersedes the previous fictitious model (researcher/backend/frontend/testing wandering 4 fixed
> zones with live handoffs) and the earlier v1 build model (3-lens gate, per-WO commits). Source of
> truth: `prototype/party-redesign-spec.md` §2–3 (with the **v2 update**, §1) and the visual contract
> `prototype/party-proposal.html` (La Fragua; the prototype `index.html` embeds it in place). The
> companion pipeline view (La Campaña) lives in FRD-02; the role/color set in FRD-13; the engine event
> enrichment in the plugin. Demo-only controls follow factory standard **DR-061** (`factory/standards/design.md` §6).

## Requirements & acceptance criteria (EARS)

Stable IDs (DR-049): `REQ-06-MMM` → `AC-06-MMM.K`. The EARS text is copied verbatim into the work
orders. The blueprint maps each REQ to a component/interface.

### REQ-06-001 — One sprite per running work order; the wave is the mode
- AC-06-001.1: WHILE a work order is a **running `implementer`** in the FRD, THE system SHALL render exactly **one sprite** for it in the Sala de Forja (one figure per running WO; role = `implementer`, full-stack).
- AC-06-001.2: THE system SHALL cap the number of concurrently-built (sprite-bearing) work orders at the **wave size of the run mode** (pro = 2, balanced = 4, powerful = 8, deep = 6), reading the mode from state.
- AC-06-001.3: WHILE the FRD has additional work orders not yet building (queued, blocked or pending dependencies), THE system SHALL render them as a single **"+N en cola"** count in the forge, NOT as sprites.
- AC-06-001.4: WHILE the **first wave of the FRD** is the **foundation wave** (the WO(s) marked `foundation`, forging the shared primitives), THE system SHALL mark that WO distinctly (a **"⛏️ Fundación"** tag) and SHALL hold the feature WOs in **"+N en cola"** until the foundation WO closes, conveying foundation-first (DR-057). **(PENDING / not built as of 2026-07-05 — reconciled from code: the "⛏️ Fundación" tag has no field in `FraguaSnapshot` and no rendering in `FraguaScene.tsx`; tracked as a separate iteration in `wo-06-007`. The "+N en cola" hold IS implemented; only the distinct foundation-tag marker is unbuilt.)**
- AC-06-001.5: WHERE an event's work-order field (`wo`) carries **the FRD id itself** (`frd-NN-<slug>`) instead of a real work-order id — emitted for **FRD-level activity** (an agent working the feature as a whole, before/between its work orders) — THE system SHALL NOT treat it as a work order: it spawns **no sprite**, is **not** added to the running list, and does **not** inflate the global WO counter (REQ-06-002) or the queue. Only real work-order ids (and `foundation`) are work orders in the scene. **(IMPLEMENTED, 2026-06-30)** — a FRD-level `wo` previously rendered a phantom avatar labelled with the FRD id and counted as an extra WO; `toFraguaSnapshot` now filters `frd-`-prefixed `wo` ids in every event processor and in the cross-FRD WO-id tally.
- AC-06-001.6: THE per-work-order **room placement** (forge / Tribunal / Bóveda) SHALL agree with the **authoritative work-order state** the Work Orders board shows — the frontmatter `implementation_status` read by `listWorkOrders` (the SAME source, DR-092 single source for derived state) — NOT a second derivation. WHERE the board shows a work order as `IN_REVIEW`, THE Party SHALL place its sprite in the **Tribunal** (`in_review`); `VERIFIED` → **Bóveda** (`verified`); `BLOCKED`/`fail` → the queue (never a forge sprite, per the edge cases); otherwise → the forge (`building`). The event stream still drives **liveness/animation** (which sprite is alive, the walk), but the **frontmatter decides the structure**. **(REWORKED, 2026-07-01 — supersedes the 2026-06-30 `woStates` map)** — the scene STRUCTURE (sprites, rooms, queue, trophies, global counter, gate) is now derived from `opts.workOrders` (`listWorkOrders`, id + frd + state) in `toFraguaSnapshot`; events contribute only the FRD focus, the mode, liveness and the bitácora. The 2026-06-30 bound ("a transition reflects on the next render") is CLOSED: `PartyLiveShell` triggers a throttled `router.refresh()` when an SSE frame carries a genuinely newer event, so the fresh frontmatter reaches the scene mid-session and the sprite walks to its new room (the engine emits an event at every WO transition — `AgentWorking` at start, `wo_commit` at the green commit, `gate`/`achievement` at the gate — plugin v9.44.0).

### REQ-06-002 — Per-FRD scene with a global project counter
- AC-06-002.1: THE system SHALL set the scene to the **single FRD currently in build** and SHALL display that FRD's **title** (not only its id) in the scene header / FRD tracker.
- AC-06-002.2: THE system SHALL display a **global project counter** of work orders done over total (e.g. `52 / 109 WO`) in the header, so the view conveys "FRD by FRD". **(REWORKED, 2026-07-01)** — the counter reads the work-order FRONTMATTER (`done` = `VERIFIED`, total = all WOs), never the achievement-event tail: the event-derived count showed `0/1 WO` on a project the header itself reported `11/11` (events rotate; the last build predated the achievement emitters).
- AC-06-002.3: WHEN a sprite is hovered, THE system SHALL show a tooltip with that work order's **id and title**.

### REQ-06-003 — Linear rooms Forja → Tribunal → Bóveda, joined by stone bridges
- AC-06-003.1: THE system SHALL render three rooms in a linear flow — **Sala de Forja** (left, active WOs), **Tribunal del Juez** (right, the review gate), **Bóveda** (bottom shelf, the FRD's verified trophies) — each with its label, and SHALL NOT render a 3-column kanban.
- AC-06-003.2: WHEN a work order transitions between rooms, THE system SHALL animate the move **inside / between rooms along the connecting stone bridges** (forge→tribunal horizontal, tribunal→vault vertical), never leaving a figure stranded mid-path at rest. The bridge connectors are **presentational**. **(IMPLEMENTED, 2026-06-30)** — The moving WO sprites are rendered as a single **stage-level layer** (one wrapper per running WO, in stage coordinates) whose positions are driven **imperatively from `engine.wos()` each animation frame** (`useFraguaSprites`): React owns the sprite list, the RAF loop owns their positions. The engine already computed the forge→tribunal→vault walk; previously `FraguaScene` never read it and placed sprites statically per-room, so they jumped on a state change. Now a WO actually walks. Verified WOs are static trophies in the Bóveda (they do not move); under `prefers-reduced-motion` the sprites are placed once at their target room (no RAF). **(HARDENED, 2026-07-01)** — the engine is now **persistent per scene** (one instance per frd/mode/wave/motion) with a **diff effect** feeding it only CHANGES: previously it was recreated on every `running` identity change — i.e. every SSE frame — so a live build reset any walk in flight every few seconds and in-review sprites teleported back to the forge to re-walk.

### REQ-06-004 — The reviewer gate is one per FRD, four lenses + visual judge + baseline blessing
- AC-06-004.1: THE system SHALL render exactly **one `reviewer`** figure for the FRD, dimmed, WHILE not all of the FRD's work orders are `IN_REVIEW`.
- AC-06-004.2: WHEN **all** of the FRD's work orders reach `IN_REVIEW`, THE system SHALL activate the single `reviewer` (the gate opens) and SHALL indicate it reviews with **four lenses** (correctness, security, quality, **runtime/visual**). **(IMPLEMENTED, 2026-07-01)** — the open state derives from the engine's `gate` event OR from the frontmatter itself (every FRD WO at `review`/`done` with ≥1 still `review`), so the tribunal lights honestly even for a build whose engine predates the `gate` emitter.
- AC-06-004.3: WHILE the gate is open, THE system SHALL indicate that the reviewer runs a **visual judge** (a screenshot of the rendered route compared against the mock) and **blesses the baseline** for the verified WOs, distinct from the four code lenses.
- AC-06-004.4: THE Tribunal SHALL provide at least **12 non-overlapping slots** (4×3) so up to 11 work orders of a FRD can be judged without sprites overlapping.

### REQ-06-005 — The Bóveda compacts so it never saturates
- AC-06-005.1: WHEN a work order reaches `VERIFIED`, THE system SHALL place it as a **trophy** on the Bóveda shelf for the current FRD. **(IMPLEMENTED, 2026-07-01)** — trophies derive from the frontmatter (`done` WOs of the FRD), with achievement events merged on top; ZERO achievement events (the pre-v9.41 engine emitted none in a 5,000-line stream) no longer leaves the shelf empty. Closes the queued change `mc-party-trophies-frontmatter-fallback`.
- AC-06-005.2 *(superseded 2026-07-02 by AC-06-019.9/.10 — the v2 GLOBAL shelf)*: the Bóveda now
  GROWS a row per 9 entries and shows everything; a fully-verified FRD collapses into ONE champion
  entry, so scale comes from grouping, not hiding. A "+N más" indicator appears only past the
  45-entry (5-row) ceiling and counts shelf ENTRIES.

### REQ-06-006 — The parchment is the real Status Note hand-off (interfaces + decisions)
- AC-06-006.1: WHEN a work order closes and writes its `## Status Note`, THE system SHALL render a **parchment** travelling from that work order to a **dependent** work order's station (the Build Plan dependency), representing the document hand-off — asynchronous, via artifact, **not** a live chat.
- AC-06-006.2: THE system SHALL drive the parchment from a real hand-off **event** (`HandoffWritten`), and SHALL NOT depict any live peer-to-peer conversation between work orders.
- AC-06-006.3: THE system SHALL convey that the `## Status Note` carries **published interfaces AND decisions/assumptions** (not only the result), so the dependent WO reads the contract and the rationale.

### REQ-06-007 — Disjoint waves serialized by file artifact; Option-B commit
- AC-06-007.1: THE system SHALL convey that work orders writing the **same file artifacts** are **serialized into different waves** (never built in the same wave), so concurrent forge sprites never collide on a file (DR-060).
- AC-06-007.2: THE system SHALL convey that **workers never touch git**: WHEN a wave's work orders close, the **engine commits the wave with a single serialized writer** (Option B) — no worktrees, no merge — and a sprite reaching `IN_REVIEW` SHALL indicate it does **not** commit itself.
- AC-06-007.3: WHEN the **whole project** completes (the global counter reaches its total), THE system SHALL surface a **cross-feature "Gran Integración"** event/state — a reviewer tracing the seams between features (each contract's producer/consumer agree) — in the feed and/or flow strip.

### REQ-06-008 — Per-WO in-loop fidelity before review
- AC-06-008.1: WHILE a UI work order is building, THE system SHALL convey the **fidelity loop** — the WO **renders its route, compares against the mock and self-corrects (up to 3 times)** before reaching `IN_REVIEW` (DR-056) — and SHALL NOT depict fidelity correction as happening only at the gate.

### REQ-06-009 — Deep mode is a sequential relay within a work order
- AC-06-009.1: WHILE the run mode is **deep** AND a work order has a frontend, THE system SHALL render that work order as a **sequential 3-step relay** — `test-writer` (RED) → `backend-dev` → `frontend-dev` — with a 3-segment progress indicator and the currently-active sub-step highlighted, and SHALL label the relay **"Opus"**.
- AC-06-009.2: THE system SHALL render the relay steps **sequentially** (the prior step completed before the next becomes active), and SHALL NOT show the three roles working simultaneously.
- AC-06-009.3: WHEN `backend-dev` publishes the API contract, THE system SHALL render a **contract hand-off** (📄) between the `backend-dev` and `frontend-dev` steps, driven by the `ContractPublished` event, with a matching feed line.
- AC-06-009.4: IF the run mode is deep AND the work order has **no** frontend, THEN THE system SHALL render it as a **single `implementer`** figure (no relay), matching the non-split modes.

### REQ-06-010 — Always-visible flow strip lighting the active beat
- AC-06-010.1: THE system SHALL render an **always-visible flow strip** of the whole build pipeline in fixed order — **Fundación → Oleada → Fidelidad → Status Note → Tribunal → Commit → Bóveda → Integración** — so the entire process is visible at a glance even when only part of it is active.
- AC-06-010.2: WHILE a build is running, THE system SHALL **light the flow-strip beat(s) currently happening** (active styling) and dim the rest, deriving the active beat from the real build state/events.
- AC-06-010.3: WHEN a flow-strip beat is hovered, THE system SHALL show a **tooltip** with that beat's name and a short description of what it does.

### REQ-06-011 — Feeds off enriched real events, read-only, no Claude
- AC-06-011.1: THE system SHALL feed off `AgentWorking` events carrying `{role, wo, frd, phase, activity, mode}` — plus the engine's `gate`/`achievement`/`wo_commit` lines — read from `~/.claude/dashboard-events.ndjson` via `lib/events.ts`, **without calling Claude** (read-only).
- AC-06-011.2: WHEN an event omits the optional enriched fields (`frd`, `phase`, `activity`, `mode`), THE system SHALL still render gracefully (backward compatibility), falling back to defaults rather than throwing. An event whose `frd` is an **empty string** (FRD-less activity, e.g. the visual-qa pass) SHALL never become the scene's FRD. **(IMPLEMENTED, 2026-07-01)**
- AC-06-011.3: THE event tail SHALL be **scoped to the project** (the emitter's `basename $PWD`) with the filter applied **BEFORE the tail cap** (`readEvents({project})`, same for the SSE `?project=`), so neither another project's build nor any session's hook noise (`SubagentStop`/`SupervisorTick` fire from EVERY Claude conversation) can leak into the scene or crowd this project's events out of the 200-event tail. **(IMPLEMENTED, 2026-07-01)** — previously the Party derived everything from the UNFILTERED global tail: mission-control's Party would show personal-page-v2's FRD, and 182 of the 200 tail events were conversation noise.

### REQ-06-012 — Read-only in production; controls are demo-only (DR-061)
- AC-06-012.1: IN production Mission Control, THE system SHALL NOT expose any **effort/mode picker** nor any **power / reset / pause / agent-control** affordance — the build is launched by `/pandacorp:implement` and the effort is fixed there (DR-061); the view is read-only over the factory.
- AC-06-012.2: THE effort/mode picker and the power / reset controls SHALL exist **only** in the prototype mockup, SHALL be visibly marked **"SOLO DEMO"** with a note that they do not exist in real read-only MC, and SHALL NOT ship in the Mission Control view.
- AC-06-012.3: IN production Mission Control, THE system SHALL display the run **effort level as read-only data in the Misión bar** (next to the project WO progress), reading the mode from state.

### REQ-06-013 — Factory-off state, derived from real state
- AC-06-013.1: WHILE **no build is running** (no active work orders / no agents working, derived from real state), THE system SHALL render a **factory-off state** with the agents **desaturated and tidied into their rooms**, never a blank screen or a crash.
- AC-06-013.2: THE factory-off state SHALL be **derived from real state**, NOT toggled by any control, and its overlay copy SHALL state that the factory is started by **launching `/pandacorp:implement`** (not "press play").
- AC-06-013.3: WHEN a build becomes active again (events resume), THE system SHALL leave the factory-off state and resaturate the scene automatically.
- AC-06-013.4: THE "is a build running" signal SHALL be the project's **authoritative `running` flag from `status.yaml`**, NOT mere presence of events. The event ndjson retains the LAST build's events indefinitely, so when `running` is `false` THE system SHALL render the powered-off state (no running-WO sprite, no lit flow-strip beat) even though a stale event tail is present — events alone cannot distinguish "building now" from "finished long ago". A build that EXISTS but is off SHALL still render the scene in its powered-off state (the grey factory-off design), NOT the never-built empty state (AC-06-010.1).

### REQ-06-014 — Reduced motion & multi-project color
- AC-06-014.1: WHEN `prefers-reduced-motion` is set, THE system SHALL disable ALL Party animation (sprites static, no RAF loop, no judge sprite movement, no parchment travel) while keeping the scene readable.
- AC-06-014.2: WHILE events from more than one project are present, THE system SHALL distinguish them with a **project-color (left border) + role-color (second border)**; events with no `project` field render with the role color only (legacy/global).

### REQ-06-015 — The bitácora (event feed)
- AC-06-015.1: THE system SHALL show a **bitácora del gremio** — a feed of the real build events (foundation forging, work starting, the `Status Note` hand-off, the deep contract, the gate opening with its 4 lenses + visual judge, the wave commit, the Gran Integración), each row using the fixed bounded iconic vocabulary, the role color, and a `tabular-nums` timestamp, with **failure as a first-class state** (never hidden), auto-scroll to newest + a pin button, and an in-memory cap (≤200, drop oldest).
- AC-06-015.2: THE bitácora SHALL render **BELOW the scene at full width** (owner decision 2026-07-01 — the side-by-side row squeezed it against the fixed 920px stage), its icons SHALL be **emoji glyphs actually rendered** (the previous Lucide identifier strings printed literally — "circle-dashed" — because no consumer resolved them and lucide is not a dependency), its vocabulary SHALL cover the REAL emitted event names (`AgentWorking` refined by phase/activity, `BuildLaunch`/`BuildRelaunch`, `ReviewVerdict`/`GateVerdict` with the verdict, `wo_commit`, `gate`, `achievement`), and session noise (`SupervisorTick`, non-failing hook `SubagentStop`) SHALL be filtered out (`isFeedEvent`) — a failure ALWAYS passes whatever its type. **(IMPLEMENTED, 2026-07-01)**

### REQ-06-016 — Achievement on work-order close
- AC-06-016.1: WHEN a work order closes (reaches `VERIFIED`), THE system SHALL fire an **achievement** toast ("¡Logro desbloqueado!") with the work-order id, using transform/opacity motion under 300 ms, with a reduced-motion variant that renders without animation.

### REQ-06-017 — Presentational layer (sprite movement, speech bubbles)
- AC-06-017.1: THE judge sprite movement, the agent **speech bubbles**, and the stone-bridge connectors between rooms SHALL be treated as **presentational** — they decorate the real engine events and SHALL NOT imply any engine behavior (live chat, control, or hand-off) that the engine does not perform.

### REQ-06-018 — Continuous liveness (the scene reads as alive between events)
The event stream only moves on transitions; a single agent grinding one work order legitimately emits nothing for minutes, which previously left the scene frozen (static sprite, empty bar). The scene SHALL convey ongoing activity from **time**, not only from discrete events.
- AC-06-018.1: WHILE a work order is building or in review, THE system SHALL animate its sprite with a continuous ambient motion (a gentle bob + a breathing halo) so an actively-working agent reads as alive even when no new event has arrived; verified (`VERIFIED`) trophy sprites and idle sprites SHALL stay still.
- AC-06-018.2: WHILE a work order is in the forge (sprite state `work`), THE system SHALL show a **forge "forging" indicator** on its sprite — a hammer striking above the head plus a warm ember glow (the under-sprite halo tinted `--color-warn`) — as decorative "it's being forged" eye-candy, NOT a progress value (no bar, no percentage, no fabricated fill). The real progress is conveyed by the room/walk (AC-06-003.2 / AC-06-013), not here. The hammer SHALL appear ONLY in the `work` state (hidden in vault/idle/review/etc.); under `prefers-reduced-motion` it SHALL fall back to a static raised hammer (AC-06-018.5).
- AC-06-018.3 *(superseded 2026-07-02 by AC-06-019.7/.9)*: the bespoke heartbeat chip gave way to
  the DR-066 **FreshnessBadge** — the single liveness voice, with three graded bands (en vivo /
  datos de hace N min / sin señal) fed by the freshest of the supervisor heartbeat and the latest
  event. Text + symbol, never color alone (unchanged principle).
- AC-06-018.4: THE always-visible flow strip SHALL softly pulse its **active** beat(s) so the top pipeline reads as live.
- AC-06-018.5: WHEN `prefers-reduced-motion` is set, ALL of the above liveness animations SHALL be disabled (consistent with AC-06-014.1), each falling back to a sensible **static** state that still communicates "active" (a steady halo, a visible band, a solid heartbeat dot) — liveness is softened, never reduced to a dead/blank scene.

### REQ-06-019 — v2 GLOBAL scene: the wave, the tribunal queue and the Campaña (BL-0021)
With the global-wave engine (BL-0021) several FRDs genuinely build at once, so the scene is no longer
"the single FRD in build" (AC-06-002.1 superseded) — it is the WHOLE factory. **(IMPLEMENTED, 2026-07-01 — Fase 1)**
- AC-06-019.1: THE forge SHALL show the CURRENT WAVE — one sprite per `in_progress` work order across
  **all** FRDs (≤ the mode's wave), each carrying its FRD's **stable palette color** (a small banner
  under the sprite; the frd id also travels in `data-frd` + the tooltip — never color alone).
- AC-06-019.2: THE tribunal SHALL model the SERIALIZED gate queue: every `review` WO stands in the
  room (≤12 slots); the FRDs whose WOs are ALL at review/done form the **line** — the head (or the
  freshest engine `gate` event's FRD) is **"en sesión"**, the rest render as waiting chips.
- AC-06-019.3: THE system SHALL render **La Campaña** above the scene — one chip per FRD with its
  REAL state from the frontmatter (`pending / building / in_review / verified / blocked`, with
  done/total), in file order, each with its stable FRD color; the chip under judgment is emphasized.
- AC-06-019.4: Trophies on the Bóveda SHALL be the LATEST `done` WOs across the project (≤9, rest
  archived), each with its FRD color plaque; the scene focus (`snapshot.frd`, MissionBar) SHALL be
  the FRD under judgment, else the first one building, else the freshest event FRD.
- AC-06-019.5: THE sprite engine SHALL persist across the whole build (one instance per scene, not
  per FRD) so a change of the judged/focused FRD never resets in-flight walks.
- AC-06-019.6 (Fase 2 — vida): THE scene SHALL converse with REAL data: one rotating speech bubble
  (every ~6s, one sprite at a time) showing the WO id + its real elapsed time ("N min al fuego",
  from track.jsonl `wo_start` — never a fabricated progress value); a BLOCKED (`fail`) work order
  SHALL rest in the **enfermería** (a visible bed strip, never a hidden "+N en cola" slot); a fresh
  engine `wo_commit` event SHALL cue the **courier** — the parchment runs forge → tribunal (a
  decorative cue anchored to the real per-WO green commit); ambient chimney smoke is pure-CSS
  decoration. All of it disabled/softened under `prefers-reduced-motion`. **(IMPLEMENTED, 2026-07-01
  — Fase 2. Pixel-art assets delivered by the owner 2026-07-02 (one 2×2 sheet, cropped/keyed in):
  `zones/infirmary.png` + `zones/camp.png` (627×627, camp staged for Fase 3's worktree tents) and
  `agents/courier.png` + `agents/panda-mascot.png` (341×341, edge flood-fill transparency). Wired:
  the courier flight uses the courier sprite, the enfermería strip sits on the dimmed infirmary room
  art, and the panda mascot strolls the stage bottom on a long pure-CSS loop — hidden under
  reduced-motion.)**
- AC-06-019.11 (Fase 3 — pulso y cierre, 2026-07-02): THE **campamento** (owner art
  `zones/camp.png`) SHALL render as a corner patch in the tribunal, OCCUPIED-ONLY (same doctrine
  as the enfermería): one ⛺ per pending-merge worktree/branch (≤3 + "+N"), fed by the SAME
  `readPending` the Summary tab and the "⎇ pendientes" chip use (FRD-21, DR-092) — on a read
  error the camp simply doesn't render (the Summary tab owns the error surface). THE sprite
  engine SHALL position sprites via `transform: translate(...)`, never per-frame `left/top`
  (no layout pass — measured 0.163 ms/frame total main-thread on the idle scene, layout 0.0 ms,
  against the <2 ms budget). The Fase-3 ticker was consciously DROPPED: it would duplicate the
  feed's voice (AC-06-019.9 one-voice rule); the walk-into-the-pile animation died with the pile
  (AC-06-019.10 champion). This closes La Fragua v2 — Fases 1, 2 and 3 delivered.
- AC-06-019.10 (fit & finish, owner 2026-07-02): THE achievement toast SHALL fire only for an
  achievement FRESHER than 3 minutes (a stale tail replay is history — the feed shows it) AND
  SHALL carry a manual ✕ dismiss, so it can never greet a page visit hours later nor get stuck;
  THE Misión strip SHALL show the campaign summary ("N/M FRDs") where the pips were (the strip
  read as empty); THE completed-FRD trophy SHALL read BIGGER, not
  busier: ONE champion sprite (scaled ~1.18, bottom-anchored) with a 🏆 mark over the shoulder and
  the `FRD-NN` tag — instantly distinguishable at a glance from a loose WO's normal statuette
  (owner iterated away the stacked-pile idea: three offset sprites read clunky). Vault rows carry
  78px pitch + bottom clearance so a scaled champion never invades the next row nor clips its tag
  at the stage edge.
- AC-06-019.9 (one voice per datum + growing vault, owner 2026-07-02): EVERY datum SHALL appear
  ONCE on the Party screen — the Misión strip carries the global WO counter and the effort
  (now with the wave size, "potente · 8 paralelos") and NO single-FRD chip (a mono-FRD relic);
  the scene renders NO internal header (the old FRD tracker / duplicate counter / duplicate mode
  display are removed); the tab header carries NO signal chip and the scene no heartbeat chip —
  the DR-066 FreshnessBadge is the single liveness voice (supersedes the AC-06-018 heartbeat chip
  and the header live/no-signal chips). THE Bóveda SHALL grow a row per 9 shelf entries (smooth
  height/position transitions) instead of hiding finished work behind a counter; its corner count
  is the TOTAL entries; "+N más" appears only past the 45-entry (5-row) ceiling and counts shelf
  ENTRIES (a completed FRD = one entry), never the WOs inside groups. THE enfermería — a corner
  patch inside the forge, not a full room — renders ONLY while a blocked WO occupies a bed
  (owner reverted the brief permanent-empty variant the same day: an always-there empty hut read
  stranger than the pop-in; it overlays nothing, so appearing never pushes the vault).
- AC-06-019.8 (vault grouping + quiet palette, owner 2026-07-02): WHEN every work order of a FRD
  is VERIFIED, THE Bóveda SHALL show that FRD as ONE stacked trophy labelled `FRD-NN` (ghost
  sprites suggest the pile; tooltip carries the WO count) instead of N individual statuettes;
  loose verified WOs of in-progress FRDs keep their own statuette, and "+N arch." counts the
  REPRESENTED work orders. AND the Party's chrome SHALL stay aligned with the app palette: the
  Campaña chips carry neutral borders (FRD identity ONLY as a small dot; "en sesión" = app
  accent), the feed rows carry a single 3px left stripe (never a full colored outline), the
  feed's "Ir al último" pin is a neutral readable chip, and the per-sprite FRD marker is a
  small dot, not a bar (it read as a loader) — removed entirely in the vault. A finished build
  (all WOs done, no event tail) still renders its scene and shelf.
- AC-06-019.7 (DR-066 consumer): THE Party surface SHALL declare its own freshness with a graded
  badge — "en vivo" (signal < 3·T), "datos de hace N min" (< 10-min TTL), "sin señal" (≥ TTL or no
  signal) — fed by the freshest of the supervisor heartbeat (`status.yaml`) and the latest event;
  AND the live shell SHALL refresh its RSC-derived structure when the SSE frame's `stateVersion`
  moves (a build advancing state without emitting an event must not read as dead). The badge is
  `data-volatile` (DR-088). (Change `mc-observability-consumer-dr066`, 2026-07-02.)

## Edge cases
- A FRD with a single work order: forge shows 1 sprite, `+0 en cola`; the gate opens as soon as that one WO is `IN_REVIEW`.
- The foundation WO of an FRD: it forges the shared primitives **alone** while the feature WOs wait in "+N en cola" until it closes (AC-06-001.4).
- More running WOs than wave size cannot occur (the engine caps at the wave); the view must never render more sprites than the mode's wave even if the event stream is noisy/duplicated.
- Deep mode where **no** WO in the FRD has a frontend: every WO is a single `implementer`, no relays appear at all.
- A WO blocked (`BLOCKED`) mid-build: it is counted in "+N en cola" (not a forge sprite) and its failure surfaces in the feed as a first-class state.
- 100+ WO project: grouping keeps the shelf small (a finished FRD = one champion however many WOs it had); the multi-row growth + the 45-entry ceiling cover the extreme tail.
- Events arriving out of order or with a stale/empty latest bucket: the view degrades to the **factory-off state** (REQ-06-013) rather than mis-rendering.
- A hand-off event whose dependent WO is not currently in the scene (already verified, or in a later FRD): the parchment animates to the forge edge / queue without targeting a missing sprite.
- Mode field absent from state: fall back to the default mode (`powerful`) for the wave/relay rendering and the Misión-bar effort label without crashing.
- Project just completed: the Gran Integración event surfaces (REQ-06-007.3) before the project leaves the build phase.

## Out of scope (this FRD does NOT include)
- **La Campaña** (the 6-phase pipeline with the full specialist team) — that is FRD-02 (the board card detail).
- Any **fixed 4-zone** layout (library/forge/workshop/lab), the researcher/backend/frontend/testing **cast wandering** zones, **live handoffs** between specialists, or a **"researcher on demand"** — all removed (they do not reflect the engine).
- Any **effort/mode picker** or **power/reset/pause** control in the shipped view — these are **demo-only** in the prototype (DR-061) and never ship; MC is read-only and the effort is fixed by `/pandacorp:implement`.
- Defining the **role color tokens** themselves (owned by FRD-13) and the **events-per-minute / timeline-DAG** shared selectors (owned by FRD-12; consumed here).
- The **engine event enrichment** itself (the plugin change that emits `frd`/`phase`/`activity`/`mode`, `HandoffWritten`, `ContractPublished`) — a documented prerequisite owned by the plugin; this FRD only **consumes** those fields.
- Any **write / control** of the build: redirecting, pausing or commanding agents happens in the Claude Code app, never here (read-only invariant).
- Regenerating the reused old room art, or a dedicated `implementer` sprite (reuses `backend-dev.png`).
