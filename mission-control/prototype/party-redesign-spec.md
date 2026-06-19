# Party redesign — final design spec (handoff to production)

> Design reference for taking the Party redesign to production via `/pandacorp:iterate`.
> The **navigable mockups** are the visual source of truth:
> - `prototype/party-proposal.html` — **La Fragua** (the build view, embeddable with `?embed=1&mode=<mode>`)
> - `prototype/party-pipeline.html` — **La Campaña** (the pipeline view, embeddable with `?embed=1&active=<0-5>&slug=<slug>`)
> - `prototype/index.html` — the two embedded **in place** (Party tab + board card detail)
>
> Supersedes the exploratory `prototype/party-redesign-brief.md`. Interaction language: Spanish; committed artifacts: English.

## 1. Why this redesign

The shipped FRD-06 Party shows a **fictitious cast** (researcher / backend / frontend / testing wandering 4 zones, chatting, handing off live) that does **not** reflect how the engine builds. The real engine (`pandacorp-build.js`, Dynamic Workflows, DR-013) is a deterministic script orchestrating subagents; the build agent is a generalist **`implementer`** (one per work order), not a team of specialists talking live. The specialists (researcher, designer, architect, PM, security, copywriter…) live in **other phases** of the pipeline, not in the build.

Two faithful views replace the fiction:
- **La Fragua** — the *build* as a living world (the Construction station, zoomed in).
- **La Campaña** — the *full 6-phase pipeline*, where the whole specialist team is shown working in sequence.

**Hard rule:** invent nothing the engine doesn't do. Beauty comes after truth.

> **Actualización v2 (2026-06-19, DR-054…060).** El motor evolucionó; los HTMLs (la fuente de verdad visual) ya reflejan esto y **La Fragua** se adaptó. Cambios que la vista del build debe mostrar: **(a) fundación primero** — la 1ª oleada forja los primitivos compartidos (`components.md`) y las features los reutilizan; **(b) oleadas disjuntas por `artifacts`** — WOs que escriben los mismos archivos se serializan, nunca chocan; **(c) check de inventario** antes de crear (no duplicar); **(d) bucle de fidelidad** — cada WO de UI hace render→compara mock→corrige (≤3) antes de IN_REVIEW; **(e) Tribunal de 4 lentes** (correctitud·seguridad·calidad·**runtime/visual**) con **juez visual** (captura vs mock) + **bendición de baseline**; **(f) Status Note** carga decisiones/supuestos, no solo el resultado; **(g) commit Opción B** — los workers no tocan git, el motor commitea cada oleada con un escritor serializado (sin worktrees, sin merge); **(h) per-WO contract** `docs/api/<wo>.md`; **(i) Gran Integración cross-feature** al cerrar el proyecto (costuras entre features). **La Campaña** cambia poco: solo fichas (Diseño usa Claude Design + produce `components.md`/mocks; Arquitectura planifica fundación+artifacts).

## 2. The real engine model (what the views must be faithful to)

Source: `mission-control/.claude/workflows/pandacorp-build.js`.

- **Paradigm:** Dynamic Workflows (a deterministic JS script orchestrates subagents). **No live peer chat during the build.**
- Builds **FRD by FRD**. Within an FRD, lifts **N work orders in parallel** (the wave) honoring the Build Plan's intra-FRD dependencies.
- **Modes** (`PROFILES`):

  | Mode | wave (WOs in parallel) | worker model | judge model | split |
  |---|---|---|---|---|
  | pro | 2 | Sonnet | **Sonnet** | no |
  | balanced | 4 | Sonnet | Opus | no |
  | powerful (default) | 8 | Sonnet | Opus | no |
  | deep | 6 | **Opus** | Opus | **yes** |

- **Non-split modes (pro/balanced/powerful):** each WO is built by **ONE full-stack `implementer`** end-to-end with TDD → fast self-test → `IN_REVIEW` + writes its `## Status Note` hand-off. **One figure per WO.**
- **Deep (split), only if the WO has a frontend:** the WO is a **sequential relay** of three specialists (each `await`ed in order):
  1. `test-writer` — acceptance tests (RED) from the EARS criteria.
  2. `backend-dev` — implements the backend, **publishes the API contract in `docs/api.md`**.
  3. `frontend-dev` — implements the UI using **only design tokens** and the `docs/api.md` contract.
  Then the self-test → `IN_REVIEW`. They do **not** work simultaneously; the contract is a real backend→frontend hand-off. If a WO has no frontend, even deep uses a single implementer.
- **WO states:** `PLANNED → IN_PROGRESS → IN_REVIEW → VERIFIED` (+ `BLOCKED`). The FRD status is a **derived rollup** of its WOs.
- **Hand-off between WOs = by DOCUMENT** (the `## Status Note`): a WO writes it on close; the dependent WO reads it. Asynchronous, via artifact — not a chat. This is the only real "communication" in the build.
- **FRD gate:** when all of a FRD's WOs are `IN_REVIEW`, **ONE `reviewer`** (judge) runs the gate — reviews with **3 lenses (correctness / security / quality)**, writes adversarial tests, exercises them in integration, runs the focused `verify.sh --since`, then sets `VERIFIED`. **One judge per FRD**, not per WO. (The 3 lenses are standard for every mode; only the judge *model* changes.)
- **Specialization is per PHASE, not inside the build.** The expert team works in sequence and communicates by documents across time:

  | Phase | Role(s) | Deliverable (the "message" to the next) |
  |---|---|---|
  | Research | `researcher` | research.md |
  | Product | `product-manager` | PRD + FRDs (EARS) |
  | Design | `designer` + `copywriter` | mockups, design tokens, microcopy |
  | Architecture | `architect` | blueprint + ADRs + Build Plan + work orders |
  | **Build** | **`implementer`** (+ `reviewer` at the gate; `analytics` instruments) | the code |
  | Release | `security-auditor` + `devops` | audit + deploy |

## 3. La Fragua — the build view (replaces FRD-06's scene)

A single **living map** (not a 3-column kanban) with rooms connected by a path. The scene is always **the FRD currently being built** (few WOs); the project total goes in the header/KPIs.

- **Sala de Forja** (forge, `assets/zones/backend.png`): the active WOs. 1 sprite = 1 running WO; role = `implementer` (full-stack). Wave size = mode. The rest of the FRD's WOs show as **"+N en cola"** (a number, not sprites). Linear flow.
- **Tribunal del Juez** (`assets/zones/tribunal.png`, **new art**): same size as the forge. The `reviewer` (one per FRD) is dim until the gate opens (all WOs `IN_REVIEW`), then judges each WO. 12 well-spaced slots (4×3) so up to 11 WOs never overlap.
- **Bóveda · trofeos del FRD** (`assets/zones/boveda.png`, **new art**, wide bottom shelf): the FRD's `VERIFIED` WOs as trophies. Compacts at >9 (shows "+N archivados") so it never saturates — even on 100+ WO projects, because the scene is per-FRD.
- **Flujo lineal e inequívoco:** Forja (left) → Tribunal (right) → Bóveda (bottom shelf). Each turn happens *inside* a room, never mid-path.
- **The parchment 📜 = the real `Status Note` hand-off**: when a WO closes it writes the note; a dependent WO reads it (Build Plan dependency), shown as a parchment travelling to the dependent's station.
- **Deep mode = a sequential relay per WO**: `test-writer ✓ → backend-dev ✓ →📄 contrato→ frontend-dev (active)`, 3-segment progress, the active sub-step highlighted, the contract published between backend and frontend (with a feed line). 2×3 wider stations so the relay fits. Label: "Opus".
- **FRD tracker** (with the FRD **title**, not just the number) + **global project counter** (e.g. 52/109 WO) in the header — conveys "FRD by FRD".
- **Hover a sprite → tooltip** with its WO id + title (titles don't fit under the sprite).
- **Bitácora del gremio** (feed): the real hand-off events from the Build Plan, via document.
- The **mode selector + pausar/reiniciar are DEMO-ONLY** (prototype). MC is read-only: in production the **mode is read from state** (the mode the build was launched with), shown as data — no selector, no pause/reset.

## 4. La Campaña — the pipeline view (lives in the board card detail, FRD-02)

A winding **campaign trail** of the 6 phases, each a room with its specialists. The active phase glows and its class(es) **roam the room and collaborate** (intra-phase collaboration is faithful — e.g. designer↔copy); past phases do a small idle bob; locked phases are still. The deliverable **document travels along the connector** to the next phase (`research.md → PRD/FRDs → mockups+tokens → blueprint+Build Plan → código → deploy`): communication by artifact across time.

- The **active phase is derived from the real project state** (`status.yaml` phase): discovered→Research, documented→Product, design→Design, architecture→Architecture, building→Build, shipped→Release.
- Clicking a phase shows its **ficha**: description + LEE/ESCRIBE (what it reads from the previous phase, what it writes for the next) + the **whole team** of that phase (every specialist, role, and what they do — not just the lead).
- The **Construcción** station links to **La Fragua** (the build zoom).

## 5. Placement in Mission Control (navigation)

Three zoom levels, each in the surface whose nature matches:

- **Tablero** (board) → click a card → its detail opens with **horizontal tabs** (same pattern as the Portfolio project pane): **Campaña · Documentos · Comandos**.
  - **Campaña** (default) = La Campaña (the idea's journey through the 6 phases). → **extends FRD-02** (the card detail).
  - Documentos = the existing doc navigator. Comandos = the next-step / iterate commands.
- **Portfolio** → project → tab **Party** = **La Fragua** (the live build, FRD by FRD). → **FRD-06**.
- In La Campaña, the **Construcción** station's "Entrar a La Fragua" button **navigates the host app** to Portfolio → that project → Party (not an inner iframe reload).
- Each embed is wrapped in a **labelled container** (consistent visual standard): "EL VIAJE DE ESTA IDEA POR LAS 6 FASES" / "EL BUILD EN VIVO · UN FRD A LA VEZ".

## 6. FRDs / changes this touches

| Change | Where |
|---|---|
| La Fragua (faithful build view replacing the fictitious cast) | **FRD-06** (rewrite) |
| La Campaña (6-phase pipeline) as the board card detail's first tab | **FRD-02** (extend) |
| Role set aligned to the real engine (`implementer`, `reviewer`, deep split roles) | **FRD-13** (`tokens.ts` / `AGENT_COLOR`) |
| Enrich the engine's emitted events (see §7) — a **prerequisite** for faithful real-data views | **plugin** (`pandacorp-build.js` + `emit-event.sh`), its own decision-log + version bump |

## 7. Engine event enrichment (prerequisite — plugin)

Today `AgentWorking` carries only `{role, wo}`. For the faithful views to run on **real** data (not the demo simulation) the engine must emit richer events. Proposed, **backward-compatible** (new optional fields; current consumers ignore them):

- On `AgentWorking`, add: `frd` (the FRD id), `phase` (`build` | `review`), `mode` (the run's mode), and `activity` — the sub-step, especially for the deep relay (`test` | `backend` | `frontend` | `selftest`) and for non-split (`implement` | `selftest`).
- Emit a **hand-off event** when a WO closes (`HandoffWritten {wo, frd, statusNote:true}`) and when a dependent starts after reading it, and a **contract event** in deep when `docs/api.md` is published (`ContractPublished {wo, frd}`).
- Keep the events read-only and append-only to `~/.claude/dashboard-events.ndjson`; `lib/events.ts` parses the new optional fields.

This is documented as a planned plugin change (its own decision-log entry + version bump); the actual view wiring consumes these fields when FRD-06/02 are built.

## 8. Assets

New room art added under `prototype/assets/zones/`: `tribunal.png`, `boveda.png` (wide), `architecture.png`, `release.png`, `build-hall.png`. Existing reused: `backend.png` (forge), `research.png`, `review.png` (product), `frontend.png` (design). The 4 reused old rooms still carry the green-rug style; a future pass may regenerate them to match the differentiated set. Sprites: `assets/agents/*.png` (the `implementer` reuses `backend-dev.png`).

## 9. Out of scope / deferred

- Regenerating the 4 reused old room arts for full visual consistency.
- A dedicated `implementer` sprite (today reuses `backend-dev`).
- The actual build (`/pandacorp:implement`) — runs after this is documented and approved.
