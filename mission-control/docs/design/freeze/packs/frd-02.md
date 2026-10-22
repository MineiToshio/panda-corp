# Context pack · FRD-02 · Ideas board

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-02 copy, S2.1 builds, S2.2 amendments, S2.3-02 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-02-ideas-board/frd.md` (id FRD-02, status ACTIVE, `ui: true`) |
| `visual_source` today | `docs/frds/frd-02-ideas-board/mocks/la-campana.html` (stale or missing: S2.2 repoints it to the approved prototype and the FRD's shard in `mocks/`) |
| Config states | 32 under `states["frd-02-ideas-board"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 59 AC lines: 26 drawn · 19 partially drawn · 3 not drawn · 11 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-02#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### FRD-02#U1 · partial · `board`

> - The board SHALL place each idea into one of the columns `discovered → documented → design → architecture → building → shipped` (plus a `discarded` column) by **deriving the column from two axes** (the card `status` and, once handed off, the project `phase` — see FRD-01), NOT from the card `status` alone:
>   - card `status: discovered` or `recommended` (not handed off yet) → **discovered** column (a `recommended` card SHALL show a "recommended" badge).
>   - card `status: in-pipeline` → the column comes from the linked project's `.pandacorp/status.yaml` **phase**: `product`→documented, `design`→design, `architecture`→architecture, `implementation`→building, `release`→shipped.
>   - card `status: shipped` → **shipped** column; card `status: discarded` → **discarded** column.
>   - The board SHALL NOT expect `design`/`architecture`/`building` to ever appear as a card `status` (those columns only come from the project phase). IF an `in-pipeline` card's project or `status.yaml` is missing, THEN it SHALL fall back to the **documented** column without breaking.

**Prototype:** Six phase columns Investigación · Producto · Diseño · Arquitectura · Construcción · Lanzamiento, no Descartada column; each card sits in its derived phase. "recommended" badge NOT drawn (owner decision 2026-10-21: out of v2). Fallback to documented when status.yaml is missing is data behaviour (no state).

### REQ-02-002 · drawn · `board`, `board-phase-jump`

> - **REQ-02-002** — The board SHALL NOT allow moving cards by hand (drag or arrows): the transitions are written by the skills. The columns SHALL have the same width, be **wide** (not tiny) and have **horizontal scroll** when they don't fit; the text SHALL wrap onto several lines if it doesn't fit.

**Prototype:** Equal-width 280 px columns, horizontal scroll with snap, phase selector chips with counts; no drag, no arrows; titles wrap.

### REQ-02-003 · drawn · `board-capture-dialog`

> - **REQ-02-003** — WHEN the owner clicks "Capture ideas / oportunidades", the system SHALL open a **modal overlay** (dark backdrop + blur) with the four intake commands — `/pandacorp:explore`, `:new-idea`, `:discover` and `:recommend` — each with an icon, title, description and copy-command row. Clicking the backdrop or the ✕ button SHALL close the modal. The board SHALL remain visible behind the modal as context.

**Prototype:** Dialog "Capturar ideas" with the four commands (explore, new-idea, discover, recommend), each with description and copy button; ✕ closes. Backdrop blur not visible in the static capture.

### FRD-02#U2 · drawn · `idea-pitch`, `idea-documents`, `idea-campaign`

> - WHEN the owner clicks a card, the system SHALL show the card: summary, key points, a navigator of the idea's documents, and the next-step command (with a copy button).

**Prototype:** Clicking a card opens the idea page (hero, tabs). Summary and key points live in Propuesta, the document navigator in Documentos, the next-step command with copy in the Campaña ficha.

### REQ-02-005 · drawn · `board`, `board-category-filter`

> - **REQ-02-005** — EACH card SHALL show two labels besides the score: **category** (`project_type`: web, mobile, desktop, ai, claude-code, prompt-system, automation, cli, rework…) and **return** (`return_type`: monetary, opportunity, personal or mixed). The board SHALL allow **filtering by category**.

**Prototype:** Card shows category chip, return chip (Monetaria/Personal/Mixta) and Score; category filter chips with counts and a live "N ideas coinciden". The legend mentioned in Edge cases is not drawn.

### REQ-02-006 · drawn · `board`

> - **REQ-02-006** — WHILE an idea's project has `running: true` (build in progress, phase `implementation` → "building" column), the system SHALL show an indicator on its card that it is being built.

**Prototype:** "Construyendo" violet chip on the running Funko Tracker card.

### FRD-02#U3 · behaviour only · `idea-discard-dialog`

> - WHEN the owner presses "Discard idea", the system SHALL rewrite `status: discarded` in the `.md` frontmatter, preserving the rest of the file (one of the app's small, bounded set of human-triggered writes — see REQ-02-012 and architecture §7).

**Prototype:** Write is simulated ("Simulado: la maqueta no descarta ideas").

### REQ-02-008 · partial · `idea-discard-dialog`

> - **REQ-02-008** — WHEN the owner presses "Discard idea", the system SHALL open a confirmation **modal** (the shared `Modal` core, DR-057) that captures an **optional reason** (quick-tags — *saturado/competencia · no me interesa el tema · no apalanca mi canal · muy complejo · no monetiza en Perú · otro* — plus free text) and SHALL write it to the `discard_reason` frontmatter field alongside `status`. The reason is optional (confirming without one writes only `status`), and the capture is part of the same write. (Owner rule: reveal-more is a modal, never an inline expand-that-pushes-content — the reason capture does **not** expand inline below the trigger. While the write is in flight the modal stays open with a disabled "Descartando…" state; backdrop/✕/Escape are inert until it settles.) This feeds `/pandacorp:discover`'s rejection-pattern learning so it stops proposing ideas the owner keeps rejecting (factory v9.8.0). On discard the system SHALL also record `status_before_discard` (the prior status) so a restore is exact.

**Prototype:** Confirmation dialog with optional "Motivo (opcional)" text area and Cancelar/Descartar. Quick-tags (saturado/competencia, no me interesa el tema, no apalanca mi canal, muy complejo, no monetiza en Perú, otro) NOT drawn. In-flight "Descartando…" disabled state NOT drawn.

### FRD-02#U4 · partial · `board-discarded-dialog`

> - The board SHALL NOT render a "Descartado" column. Discarded ideas are reached via a **"Ver descartadas" button** (beside "Capturar ideas", shown only when discarded ideas exist) that opens a **modal** listing them (title + discard reason); selecting one opens its detail. (Owner rule: no inline expand-that-pushes-content — reveal-more is a modal. The shared `Modal` core, DR-057, powers this and the intake modal.)

**Prototype:** "Descartadas · 12" button beside "Capturar ideas" opens a dialog list (title, category, "leer propuesta y restaurar"). The discard reason is NOT listed (no reason in the fixture). The button is always rendered (the AC says only when discarded ideas exist).

### FRD-02#U5 · partial · `idea-discarded`, `idea-restore-dialog`

> - WHEN the owner opens a discarded idea's detail, the system SHALL show its **full documentation** (in the Documentos tab) and a banner with the **discard reason**, and SHALL offer **"Volver a agregar"** — which restores the idea to the status it had **before** being discarded (`status_before_discard`, fallback `discovered`) and clears `discard_reason` + `status_before_discard`. Restore is the board's second write (ADR-0002).

**Prototype:** Discarded detail shows "Descartada" stage, "Restaurar" button and a restore dialog. Discard-reason banner NOT drawn; the "Documentos" tab is absent because the fixture's discarded ideas have no project; label is "Restaurar", not "Volver a agregar". The restore dialog also shows a "Motivo (opcional)" field (prototype quirk).

### REQ-02-014 · drawn · `board`

> - **REQ-02-014** — WHEN a board column has no cards, it SHALL show an accessible empty-state marker: an element with role `status` whose text is "Sin ideas en esta columna" (visually hidden), with the visual dash kept as `aria-hidden` decoration, so the empty state is not conveyed by shape alone (WO-02-014).

**Prototype:** Empty columns show "Sin ideas en esta fase" (visible text, a `p`, no role=status).

### AC-02-009.1 · drawn · `idea-pitch`, `idea-spec`, `idea-architecture`, `idea-documents`, `idea-campaign`

> - AC-02-009.1 — WHEN the owner opens a card, THE system SHALL render the card detail with **three
>   horizontal tabs** — **Propuesta · Documentos · Campaña** (in that order) — using the **same tab
>   pattern** as the Portfolio project pane (the `stab` selector row), and SHALL default the active tab
>   **by the project's stage** (campaign phase): research → **Propuesta**; product or design → **Spec**;
>   architecture, implementation or release (incl. shipped) → **Arquitectura**. When the stage's tab is
>   not rendered (the corresponding artifacts are absent), the default falls back to the previous available stage tab
>   (Arquitectura → Spec → Propuesta); Documentos and Campaña are never the default. Only the initial tab
>   is derived: the owner's later pick persists (AC-02-009.4). (Owner decision, discover redesign 2026-06-26; the Comandos tab was folded into the
>   campaign ficha earlier.) A **Spec** tab is inserted **between Propuesta and Documentos** when the
>   project has a spec digest (REQ-02-011), and an **Arquitectura** tab **after Spec** when it has an
>   architecture digest or a present structured model artifact (REQ-02-013) — absent the corresponding source artifacts, that tab is not rendered. Full order when both exist: Propuesta · Spec · Arquitectura · Documentos · Campaña.

**Prototype:** Tabs Propuesta · Spec · Arquitectura · Documentos (with doc count) · Campaña, each with an icon; the board link picks the default tab by stage. Spec appears when the project has a spec digest and Arquitectura whenever the idea has a project (also for a project with no architecture digest: see idea-architecture-missing); ideas without a project show Propuesta · Campaña only.

### AC-02-009.5 · partial · `idea-pitch`

> - AC-02-009.5 — WHEN the **Propuesta** tab is active, THE system SHALL render the idea's **memo-pitch**
>   (the card's hot→cold body produced by `/discover`/`/new-idea`, plugin v9.9.0) natively via the
>   `IdeaPitch` component (CMP-02-idea-pitch) using the design tokens — the on-brand pitch that makes the
>   owner decide. The card `.md` is the source of truth; this is its native rendering inside the board.
>   The hero badges SHALL include **"qué es" chips** — the app type (`project_type`: web / mobile / api …)
>   and, when an in-pipeline project declares it, the web target platform (`target_platforms`: desktop /
>   mobile / responsive) — and SHALL **omit the opaque verdict ("build") badge** (it conveys the kill/build
>   decision, not what the product is). The same chips appear in the Spec hero (AC-02-011.2); both reuse a
>   single `projectMetaChips` helper so they never drift.

**Prototype:** Memo-pitch hero (eyebrow "MEMO-PITCH DE IDEA", chips type/platform and cubeta/vitamin/retorno) then "De un vistazo", "Profundizar", "El tablero de decisión". The hero ALSO shows the verdict chip "🧪 validate", which the AC says to omit: conflict for S1.3.

### AC-02-009.2 · drawn · `idea-pitch`, `idea-spec`, `idea-architecture`, `idea-documents`, `idea-campaign`

> - AC-02-009.2 — WHEN the owner clicks a tab, THE system SHALL show that tab's body and mark only that
>   tab active; **Propuesta** SHALL render the idea's memo-pitch (AC-02-009.5), **Documentos** SHALL
>   render the existing document navigator (summary + key points + the idea's docs, unchanged behavior of
>   REQ-02-004), and **Campaña** SHALL render La Campaña (REQ-02-010).

**Prototype:** Only the active tab is marked (aria-selected, tone underline).

### AC-02-009.3 · behaviour only · `idea-documents`

> - AC-02-009.3 — WHEN the owner clicks a document entry (in any tab context that exposes a document),
>   THE system SHALL switch the active tab to **Documentos** and show that document, so a document
>   click always lands the owner on **Documentos**.

**Prototype:** Document buttons route to the Documentos tab; the click flow is not a captured state.

### AC-02-009.4 · behaviour only · `idea-spec`

> - AC-02-009.4 — THE system SHALL **persist the active tab choice** for the open card across
>   re-renders of the card detail (the tab selection survives interactions that re-render the detail
>   without navigating away from the card).

**Prototype:** Active tab is URL-owned (`tab=`), survives reload (FRD-25).

### AC-02-010.1 · drawn · `idea-campaign`

> - AC-02-010.1 — WHEN the **Campaña** tab is active, THE system SHALL render **La Campaña**: the
>   **6-phase pipeline** in fixed order `research → product → design → architecture → build → release`,
>   each phase shown as a room, wrapped in a labelled container ("EL VIAJE DE ESTA IDEA POR LAS 6
>   FASES").

**Prototype:** Heading "El viaje de esta idea por las 6 fases" (sentence case, not uppercase) over six rooms in a 5-column snake.

### AC-02-010.2 · behaviour only · `idea-campaign`, `idea-campaign-research`, `idea-campaign-build`

> - AC-02-010.2 — THE system SHALL **derive the ACTIVE phase from the project's real status** (the card
>   `status` / linked project `status.yaml` phase) with the mapping `discovered→research`,
>   `documented→product`, `design→design`, `architecture→architecture`, `building→build`,
>   `shipped→release`; IF the status is absent or unrecognized THEN the active phase SHALL default to
>   **research** (index 0) without breaking.

**Prototype:** Derived active phase is visible as "en curso"; the mapping is data logic.

### AC-02-010.3 · drawn · `idea-campaign`

> - AC-02-010.3 — THE system SHALL render each phase by its position relative to the active phase:
>   phases **before** the active one as **done** (showing their delivered deliverable), the active one
>   as **current** (glowing), and phases **after** it as **locked**.

**Prototype:** Rooms read entregado / en curso / en espera; the hand-off artifact travels in the corridors ("research.md →", "PRD + FRDs →", "sistema + mocks ↓"), a progress strip and "3/6 entregadas".

### AC-02-010.4 · drawn · `idea-campaign`, `idea-campaign-phase`, `idea-campaign-research`, `idea-campaign-design`, `idea-campaign-build`, `idea-campaign-release`

> - AC-02-010.4 — WHEN the owner clicks a phase, THE system SHALL show that phase's **ficha**: a
>   description, what it **reads** (LEE — the deliverable from the previous phase) and **writes**
>   (ESCRIBE — the deliverable for the next phase), and the **whole team** of that phase — every
>   specialist with its role and what it does (not only the lead). The teams SHALL be: research =
>   `researcher`; product = `product-manager`; design = `designer` + `copywriter`; architecture =
>   `architect`; build = `implementer` + `reviewer` + `analytics` + `security-auditor`; release =
>   `devops` (**reconciled-from-code, DR-085, 2026-09-25**: the security audit is the LAST STEP of
>   construction, not a separate release activity — `security-auditor` sits on the build team, and
>   release keeps only `devops`; see `factory/decisions/registry.yaml` DR-085 and
>   `CampaignPipeline/phases.ts`). The deliverable chain (LEE→ESCRIBE) SHALL be `research.md →
>   PRD/FRDs (EARS) → mockups + design tokens + components.md (microcopy) → blueprint + ADRs +
>   Build Plan + work orders → código verificado y endurecido (auditado, GREEN) → app lanzada
>   (interna o externa) + plan de lanzamiento`.

**Prototype:** Phase sheet: "Fase N de 6", name, state chip, Descripción, Entra y sale (Lee / Escribe), Equipo with sprites. The active phase is open by default; prev/next arrows. Product ficha uses the same component (no own state).

### AC-02-010.8 · drawn · `idea-campaign-design`, `idea-campaign-phase`, `idea-campaign-build`

> - AC-02-010.8 — THE fichas SHALL reflect the **current factory**: the **Design** ficha SHALL state
>   that design uses **Claude Design** and produces **`components.md`** + **mocks** + design tokens (and
>   microcopy via `copywriter`); the **Architecture** ficha SHALL state that it **plans the foundation
>   (shared primitives) and the file artifacts** of each work order (plus the blueprint, ADRs and Build
>   Plan); and the **Build** ficha SHALL reflect the **v2 build flow** — foundation-first, disjoint
>   waves serialized by file artifact, per-WO fidelity loop, the 4-lens + visual-judge gate and the
>   Option-B wave commit (consistent with FRD-06 / La Fragua).

**Prototype:** Design ficha names Claude Design, components.md and microcopia; Architecture ficha names foundation and file artifacts; Build ficha describes foundation-first waves, fidelity loop, 4-lens gate and Option-B commit.

### AC-02-010.9 · partial · `idea-campaign-research`, `idea-campaign-build`, `idea-campaign-phase`

> - AC-02-010.9 — Each phase's ficha SHALL carry a **"Qué puedes correr"** section listing that phase's
>   **runnable commands** (the first is the advance/recommended step; the rest are the phase's other
>   options), each as a **copyable** `CmdRow`. The command text SHALL **substitute the project slug**
>   into the `<idea>` token (e.g. `/pandacorp:spec <idea>` renders `/pandacorp:spec <slug>`) so it
>   copy-pastes directly — never a literal `<idea>` placeholder. The factory-run commands (`spec`,
>   `explore`) carry the project name; the in-project commands (`design`, `blueprint`, `implement`,
>   `release`, `iterate`, `bug`, `change`, `review-launch`, `new-version`, `sync`) do not. A command
>   that has **modes** SHALL render an inline **`<select>`** (same height as the copy button, pinned to
>   its left) whose first option is **`default`** — a neutral word meaning "no flag, the skill decides"
>   (NOT the field name, which would read as if that value were chosen). What the field controls is
>   carried by a **custom hover/focus tooltip** — a styled bubble that appears **above** the select
>   **immediately** (no native-`title` delay), **bounded to a max width** (~240px, wrapping to 2–3
>   lines), with a descriptive sentence (e.g. "Cuántas preguntas te hago antes de generar la
>   documentación" / "Modo de construcción — con cuánta potencia se construye el proyecto"; wired as
>   `aria-describedby` for assistive tech) — plus the one-line hint below — keeping the option text
>   (and so the control) narrow. The remaining options
>   each fold their flag into the displayed AND copied command (`/pandacorp:spec <slug>` →
>   `/pandacorp:spec <slug> --ask`). Choosing `default` again clears the flag. A
>   `<select>` (not a row of pills) keeps the control compact no matter how many modes a command has. A
>   one-line hint SHALL describe the selected mode (or the default behaviour). Today two commands carry modes: **`spec`** (clarification modes
>   `--ask` / `--auto` / `--infer`, DR-095) and **`implement`** (the build modes Pro / Potente /
>   Profundo, derived from the canonical `BUILD_MODES`; balanced = no flag). Commands without modes
>   render as a plain row. Read-only (AC-02-010.6): showing the command is not running it.

**Prototype:** "Qué puedes correr": first command as "Siguiente paso · avanza a …", others under "Otras opciones de esta fase", each a copyable command with `<idea>` replaced by the slug. Modes are NOT an inline `<select>` with "default": spec modes sit in a disclosure (summary "Cuántas preguntas te hago antes de generar la documentación") listing each mode with its command; implement shows "Elegir modo de construcción" with the four-mode picker.

### AC-02-010.5 · partial · `idea-campaign-build`

> - AC-02-010.5 — WHEN the owner activates the **Construcción** (build) phase's "Entrar a La Fragua"
>   action, THE system SHALL **navigate the host app** to Portfolio → that project → the **Party** tab
>   (FRD-06 / La Fragua) for that project, WITHOUT an inner iframe reload of the card detail.

**Prototype:** "Entrar a La Fragua" button is drawn on the Construcción ficha, but its link targets the Party tab, which no longer exists (La Fragua is the top of Resumen); the button is also shown for locked build phases.

### AC-02-010.6 · behaviour only · `idea-campaign`

> - AC-02-010.6 — THE Campaña view SHALL be **read-only**: it SHALL NOT call Claude, write any file, or
>   trigger any build; the only "communication" it depicts between phases is the deliverable document
>   travelling to the next phase (artifact across time).

**Prototype:** Read-only: commands only copy.

### AC-02-010.7 · drawn · `idea-campaign-release`, `idea-campaign-design`

> - AC-02-010.7 — A **locked** (future, not-yet-reached) phase's ficha SHALL still render its **full
>   information** (description, LEE/ESCRIBE, the whole team) — the ficha is information *about* the phase,
>   readable regardless of progress (owner, 2026-06-22); the header label ("en espera") signals it is a
>   future phase. Only the build phase's "Entrar a La Fragua" **action** is withheld until the build is
>   reached. (Superseded the earlier locked/empty placeholder, which hid the phase info.)

**Prototype:** Locked future phase (Lanzamiento "en espera") shows the full ficha.

### AC-02-010.10 · drawn · `idea-campaign-research`

> - AC-02-010.10 — WHILE the idea is still under investigation (a pre-pipeline `discovered` /
>   `recommended` card → the **research** ficha), THE "Qué puedes correr" section SHALL offer
>   **`/pandacorp:explore <idea>`** (slug interpolated) as the optional refine step alongside `spec` —
>   the visible path to evolve the idea conversationally BEFORE documenting the MVP. Explore is an
>   option, never the advance step (spec remains first). No later (in-pipeline / shipped) phase's ficha
>   SHALL offer explore. (Change `mc-nextstep-offer-explore`, 2026-07-02.)

**Prototype:** Research ficha offers "/pandacorp:explore market-stall-ledger" under "Otras opciones"; spec stays the first step; later fichas do not offer it.

### AC-02-010.4-b · partial · `idea-campaign`, `idea-campaign-phase`

> - **AC-02-010.4 amended** — the **active** phase's ficha is shown **by default** (the prototype opens
>   the active phase) and **stays pinned**: clicking another phase switches it; clicking the open one
>   keeps it open (the detail below the map is always visible, never toggled closed). The ficha gains a
>   header "`{n} · {name}` — {state}" (e.g. "Investigación — EN CURSO"). The active room's cast **roams**
>   — sprites wander and collaborate (lead halo, speech on meet); `prefers-reduced-motion` renders them
>   static. The campaign body is one bordered panel below the (bare, icon-bearing) tab pills; the header
>   caption is left-aligned; the stage is full-width with the rooms centred; the road connectors sit
>   **under** the rooms.

**Prototype:** Amendment "active phase ficha open by default and pinned; header '{n} · {name} — {state}'; the active cast roams": the active ficha is open by default (prev/next arrows move between phases); the header reads kicker "Fase 4 de 6", name "Arquitectura" and a chip "en curso"; the cast roams in the active room (animation not visible in the static capture). Locked/done/active states per room: D.

### AC-02-010.3-b · partial · `idea-campaign`

> - **AC-02-010.3 deliverable** — each non-locked room shows the short artifact with its icon only
>   (`🔍 research.md`, `📋 PRD + FRDs`, …); the "entrega ▸" label + arrow were dropped. The inter-phase
>   connectors render as the prototype's striped **road** (done ✓ / flowing → / locked), not the Fragua
>   stone PNG.

**Prototype:** Amendment "each non-locked room shows the short artifact with its icon; connectors render as the striped road": rooms show the cast and the room name; the artifact is written on the corridor ("research.md →", "PRD + FRDs →", "sistema + mocks ↓", "← blueprint + Build Plan", "← el código"), which turns solid green once delivered. There is no striped road and no icon+artifact pill inside the room.

### AC-02-009.1-b · drawn · `idea-pitch`, `idea-spec`, `idea-architecture`, `idea-documents`, `idea-campaign`

> - **AC-02-009.1** — every rendered tab carries its icon (Propuesta `ti-sparkles`, Spec `ti-list-details`, Arquitectura `ti-affiliate`, Documentos `ti-files`, Campaña `ti-map-2`).

**Prototype:** Amendment "every rendered tab carries its icon": Propuesta (bulb), Spec (layers), Arquitectura (cube), Documentos (file) and Campaña (flag) each carry an inline-SVG icon; the Tabler names in the AC (ti-sparkles, ti-list-details, ti-affiliate, ti-files, ti-map-2) are not used.

### AC-02-009.2-b · partial · `idea-documents`

> - **AC-02-009.2/.3 Documentos** is a **rail (210px) + reader**: the rail always lists **Resumen** (the
>   summary reader) plus one item per project document; selecting an item shows it in the reader (a board
>   card defers the full document read to the project workspace). **Comandos** uses the shared `CmdRow`,
>   and building/release cards add a project-command box (`workspaceCommands`).

**Prototype:** Amendment "Documentos is a rail + reader": the rail is the app's curated list (Tarjeta de la idea, Producto: PRD and Research, per FRD "FRD-01 · title": Contrato / Diseño / Implementación) and sits on the RIGHT of the reader (owner rule, iteration 12), not 210 px on the left; below 900 px it is a folded list. The "Comandos" tab no longer exists: commands live in the Campaña ficha.

### AC-02-009.4-b · behaviour only · `idea-documents`

> - **AC-02-009.4 In-document links open in the reader** — a relative link inside a document to another
>   document the reader surfaces (e.g. the PRD linking an FRD) SHALL open that document in the SAME
>   card-detail reader (it selects it in the rail — client-state navigation, not a page nav); an off-app
>   URL SHALL open in a new tab; any other relative link SHALL render as plain text (never a broken link).

**Prototype:** Link resolution inside the reader is behaviour; no state captures a clicked link.

### AC-02-011.1 · drawn · `idea-spec`, `idea-campaign-research`

> - AC-02-011.1 — WHEN the open card's linked project has a spec digest (`.pandacorp/comms/spec-resumen.md`
>   present and non-empty), THE system SHALL render a **Spec** tab **between Propuesta and Documentos**;
>   WHEN no digest exists, THE system SHALL NOT render the Spec tab (the project hasn't reached that
>   stage). The reader is fail-loud (DR-078): a missing digest is the deliberate absent state, never a crash.
>   The digest (and the project's docs and status) SHALL be read for **any card linked to a project**
>   (`project` set): in-pipeline, shipped (launched) or discarded, not only in-pipeline, so a launched
>   or discarded project keeps its Spec, Arquitectura and Documentos tabs.

**Prototype:** Spec tab present when the project has a digest; absent for ideas without a project (tabs Propuesta · Campaña only).

### AC-02-011.2 · drawn · `idea-spec`

> - AC-02-011.2 — WHEN the **Spec** tab is active, THE system SHALL render the digest natively in three
>   sections — **📋 PRD**, **🔬 Research**, **🧩 FRDs** — reusing the Propuesta tab's visual language
>   (full-bleed tinted blocks, label rows, role/stat/reference cards, an amber callout for the open
>   decisions) for cross-surface coherence (DR-062). PRD/Research subsections are classified by label and
>   rendered to be **scannable at a glance** (owner rule): **El problema** → a bullet list (not a prose
>   wall); **Hipótesis de valor** → a single short highlighted callout; **Usuarios** → title+description
>   role cards; **Métricas** → title+description stat cards; **Alcance v1** → a roomy checklist (not
>   cramped pills); **Fuera del v1** → muted chips **without a strike-through** (legibility); **Decisiones
>   abiertas** → an amber callout; **Referentes** → reference cards; else prose. Title+description cards
>   parse a `- **Title** — desc` bullet (the parser tolerates a parenthetical between the bold and the
>   dash, so a mis-authored bullet still yields a title + a description rather than a title-only card).

**Prototype:** Bands "PRD · qué y por qué", "Research · la evidencia", "FRDs · las piezas del v1" (no emoji): El problema as bullets, Hipótesis de valor callout, Usuarios and Métricas cards, Alcance v1 checklist, Fuera del v1 chips, Decisiones abiertas callout, Referentes cards.

### AC-02-011.3 · drawn · `idea-spec`, `idea-frd-dialog`

> - AC-02-011.3 — THE FRDs section SHALL render **one compact card per v1 FRD** (id · title · type tag ·
>   one-line summary). WHEN the owner clicks an FRD card, THE system SHALL open a **modal** (not an inline
>   expand — owner rule, reusing the core `Modal` with its focus-trap/Escape/return-focus a11y contract)
>   showing that FRD's detail — Overview, User stories, Reglas de negocio, Fuera de alcance and Open
>   questions — colour-coded per section, consistent with the Spec page.

**Prototype:** One compact card per FRD (code, tag UI/Infra/…, title, summary); click opens a dialog with Visión · Historias de usuario · Reglas de negocio · Fuera de alcance · Preguntas abiertas · Work orders, plus Contrato / Blueprint / Ver work orders buttons.

### AC-02-011.4 · drawn · `project-spec`

> - AC-02-011.4 — WHEN Spec is opened from the Portfolio workspace or a direct project page, THE system SHALL reuse this complete Spec component and digest/count readers under FRD-04 REQ-04-013. The board's conditional-tab behavior remains unchanged; the workspace retains an honest empty state when its digest is absent.

**Prototype:** The workspace reuses the same Spec component.

### AC-02-012.1 · behaviour only · `board-favorite`

> - AC-02-012.1 — WHEN the owner marks a card as favourite, THE system SHALL write `favorite: true`
>   in that card's `.md` frontmatter, preserving the body and all other fields verbatim.

**Prototype:** Write simulated ("Marcada como favorita en esta maqueta").

### AC-02-012.2 · behaviour only · `board-favorite`

> - AC-02-012.2 — WHEN the owner unmarks a favourite, THE system SHALL **remove** the `favorite`
>   field (a non-favourite card carries no `favorite` key — same discipline as the optional
>   `discard_reason`). The write SHALL never touch `status` or any other field.

**Prototype:** Write simulated.

### AC-02-012.3 · drawn · `board`, `board-favorite`, `idea-pitch`

> - AC-02-012.3 — THE system SHALL render a **star toggle** in the top-right corner of **every** board
>   card (in any column) and in the card-detail header; clicking it SHALL toggle the favourite flag
>   via a Server Action with **optimistic UI** (the star flips immediately and auto-reverts on
>   failure). The star SHALL be `ti-star` (outline) when not a favourite and `ti-star-filled` (gold)
>   when it is, with a Spanish `aria-label` ("Marcar como favorita" / "Quitar de favoritas") and
>   `aria-pressed` reflecting the state.

**Prototype:** Star toggle top-right of every board card and in the idea header; filled gold when pressed; aria-pressed; aria-label "Marcar como favorita: <título>" / "Quitar de favoritas: <título>". Optimistic/auto-revert is behaviour.

### AC-02-012.4 · partial · `board-favorite`

> - AC-02-012.4 — WHEN a card is a favourite, THE system SHALL highlight it with a distinct **gold
>   card background + border** (the `--color-warn` token, distinct from the teal accent used by
>   "recomendada"/"en construcción"). The highlight SHALL **not** be conveyed by colour alone — the
>   card's `aria-label` SHALL include "favorita" and carry the filled-star control (accessibility.md).

**Prototype:** Pressed star turns gold and fills. The gold card background + border highlight is NOT drawn.

### AC-02-013.1 · partial · `idea-architecture`, `idea-architecture-missing`

> - AC-02-013.1 — WHEN the open card's linked project has a non-empty architecture digest OR a present structured model artifact (including explicit none or invalid input), THE system SHALL render an **Arquitectura** tab after Spec when available, otherwise after Propuesta. WHEN both artifacts are absent, THE system SHALL omit the tab. Availability SHALL NOT depend on the digest when the model artifact is present. This applies to every project-linked card, including shipped and discarded cards.

**Prototype:** Tab present for project-linked ideas. A project without architecture draws the empty message "La arquitectura todavía no está publicada." inside the tab instead of omitting the tab.

### AC-02-013.2 · drawn · `idea-architecture`, `model-none`, `project-architecture`

> - AC-02-013.2 — WHEN **Arquitectura** is active, THE system SHALL reuse the complete `ArchitectureDigest`: hero, **Stack & tecnologías**, **Integraciones y operación**, **Modelo de datos**, **Variables de entorno**, **Decisiones (ADRs)**, **Plan de implementación**, and per-FRD cards. The **Modelo de datos** heading SHALL remain present and host the shared logical-model viewer (REQ-02-015); existing narrative/content-entity context SHALL remain readable. Stack SHALL describe technology/provider choices and their rationale; Integraciones y operación SHALL preserve all authored service flows, responsibilities and operational tasks without deduplicating away facts merely because a vendor also appears in Stack. Missing narrative SHALL NOT suppress an available model or its error/none state.

**Prototype:** Hero (stack line, host, cost, phase chip), Stack y tecnologías, Integraciones y operación, Modelo de datos, Variables de entorno, Decisiones, Plan de implementación and per-FRD cards, in that order.

### AC-02-013.3 · partial · `idea-architecture`, `observability-deps-wo`

> - AC-02-013.3 — THE **Plan de implementación** SHALL render the implementation-plan **DAG** by reusing
>   the work-order dependency graph component (`WoDag`/`DagCanvas`, dagre + SVG — no new graph library):
>   nodes = work orders grouped by FRD, edges = `dependsOn`, node state = `implementation_status`, so the
>   parallelism and the critical path are visible. The DAG is computed from the LIVE work-order frontmatter
>   (`docs/frds/*/work-orders/*.md`, DR-049), not from the digest.

**Prototype:** The Plan de implementación is a state MOSAIC (one tile per work order by FRD; hidden before Construcción, replaced by a "N work orders planificadas" line); the prototype says "en la app real este bloque es el grafo interactivo de dependencias". The real DAG is drawn only in Observabilidad → Dependencias.

### AC-02-013.4 · drawn · `idea-architecture`, `idea-adr-dialog`

> - AC-02-013.4 — THE **Decisiones (ADRs)** and **Variables de entorno** blocks SHALL be read **live** from
>   the real artifacts (`docs/adr/*` and `.env.example`), not duplicated in the digest, so they never drift.
>   An ADR row SHALL be clickable and open a **modal** (the core `Modal` a11y contract) with the ADR body.

**Prototype:** ADR rows open a dialog with the ADR body (kicker ADR-0001); variables as name | purpose rows grouped by .env.example section, with a "N de M sin descripción" chip.

### AC-02-013.5 · drawn · `idea-architecture`, `idea-architecture-frd-dialog`

> - AC-02-013.5 — THE **per-FRD** cards SHALL render one card per FRD (id · title · WO count · blueprint
>   one-liner); clicking a card SHALL open a **modal** with that FRD's blueprint summary + its work-orders
>   list — consistent with the Spec tab's FRD-card→modal pattern (owner rule: heavy detail in a modal).

**Prototype:** Per-FRD cards (code, kind tag, title, summary, WO bar and n/m once the build started) open a dialog "FRD-NN · PLAN DE IMPLEMENTACIÓN" with Visión, Implementación (blueprint one-liner), stories, rules, Work orders.

### AC-02-013.6 · not drawn · `idea-architecture-frd-dialog`

> - AC-02-013.6 — WHEN an FRD's modal is open AND that FRD has **more than one** live work order, THE
>   system SHALL render, at the end of the modal, a **scoped dependency DAG** (the same `WoDag` reused by
>   the main Plan de implementación) showing ONLY that FRD's work orders and their intra-FRD dependencies
>   /parallelism. WHEN the FRD has a single work order, THE system SHALL NOT render the DAG (there is no
>   dependency/parallelism to show).

**Prototype:** The FRD dialog ends with the buttons Contrato / Diseño / Blueprint / Ver work orders; NO scoped dependency graph is drawn in it.

### AC-02-015.1 · partial · `model-diagram`, `model-schema`

> - AC-02-015.1 — WHEN a valid version-1 relational or document model is available, THE viewer SHALL display every declared entity, ordered attribute, logical type, optionality, PK/FK/UQ membership and composite-key group, preserving isolated entities, self-relations, parallel edges and declared association entities without inventing joins.

**Prototype:** Entities with ordered attributes, logical types (`?` for optional) and PK/FK/UQ badges; composite key groups, isolated entities and self-relations are not distinguishable in the capture.

### AC-02-015.2 · partial · `model-entity-selected`

> - AC-02-015.2 — WHEN a relationship is displayed or selected, THE viewer SHALL preserve attribute mappings and both endpoint cardinalities, explicitly labelled `1`, `0..1`, `0..*` or `1..*`, with independently selectable graph connectors; it SHALL NOT render a lower relationship inspector or duplicate relationship-button list.

**Prototype:** "Relaciones N" list shows `from min..max → to min..max` (e.g. 1..1, 0..*); attribute mappings and per-connector selection are NOT drawn; links are simple curves.

### AC-02-015.3 · drawn · `model-diagram`

> - AC-02-015.3 — WHEN the viewer opens at any viewport width, THE default SHALL be **Diagrama**, using content-sized entity cards that show full names, attribute names and types without ellipsis, 24px attribute rows and 12px field text; THE viewer SHALL offer native pointer-drag panning of the canvas background, zoom, fit/reset, keyboard arrows and labelled directional buttons without requiring scrollbars to navigate the diagram.

**Prototype:** Default Diagrama (phones open on Esquema), content-sized entity cards, pan by dragging, zoom −/+/percent, fit (target icon), reset, fullscreen; keyboard arrows and labelled directional buttons are not drawn.

### AC-02-015.4 · drawn · `model-schema`

> - AC-02-015.4 — WHEN the owner chooses **Esquema**, THE viewer SHALL display a single column of compact, initially collapsed entity accordions; activating an entity SHALL expand its natural-height, selectable Prisma-like text, attributes, keys and explicit relationship/cardinality text from the same artifact, close any other open entity in that viewer, and permit collapsing it again; this SHALL be a viewing representation, not an executable Prisma schema or an HTML attribute table.

**Prototype:** Single column of collapsed `details` entities, first open by default; Prisma-like text per entity; one open at a time is behaviour.

### AC-02-015.5 · partial · `model-entity-selected`

> - AC-02-015.5 — WHEN the owner searches an entity/attribute or selects an entity/relation, THE viewer SHALL reveal matching entities, center diagram search results and highlight matching/connected graph elements without editing or dropping model data or adding a lower detail panel. Activating the same explicitly selected relationship again SHALL clear selection; activating a connector highlighted only by entity-neighborhood selection SHALL select that relationship first. Selected and keyboard-focused relationship connectors SHALL use the routed line/cardinality strokes as their visual indicator, without an outline around the SVG group bounds; other controls SHALL retain their existing focus indicators. Active expanded search SHALL announce matches or no matches inside its dialog.

**Prototype:** Search field "Buscar entidad o atributo…" and entity selection that lights relations and dims the rest; the active-search announcement is not captured.

### AC-02-015.6 · partial · `model-diagram`

> - AC-02-015.6 — WHEN the owner expands the model, THE viewer SHALL request native browser fullscreen on a model-only host within the activating gesture, falling back to a viewport-filling diagram dialog when unavailable or rejected; it SHALL reuse the dependency map’s compact top-right icon toolbar for zoom, percentage/reset, fit and fullscreen/minimize, with search and click-pan alternatives and no source bands, tabs, visible instructions, legend or lower details; it SHALL preserve its model and selection, provide modal keyboard navigation/Escape, restore the actual activating text/icon trigger focus on close or native fullscreen exit, and prevent another selected project's model from leaking into the view.

**Prototype:** Fullscreen button "Pantalla completa" exists; the fullscreen host/dialog fallback is not captured as a state.

### AC-02-015.7 · partial · `model-none`, `idea-architecture-missing`

> - AC-02-015.7 — WHEN the source is absent, explicitly `persistence: none`, valid with no entities, malformed, oversized, unreadable or unsupported, THE viewer SHALL show the corresponding missing/none/empty/error state and keep the rest of Architecture usable; invalid input SHALL never appear as a valid empty diagram.

**Prototype:** Drawn: "Este proyecto declara explícitamente que no usa base de datos." (model-none) and the missing/not-published state. NOT drawn (no fixture): malformed, oversized, unreadable, unsupported, valid-with-no-entities.

### AC-02-015.8 · partial · `model-diagram`

> - AC-02-015.8 — WHEN a usable designed model is displayed without independent schema verification, THE inline viewer SHALL state **Modelo diseñado. Implementación sin verificar.**; phase, timestamps and work-order state SHALL NOT imply operational-schema verification.

**Prototype:** Chip "Modelo diseñado, no verificado contra una base viva" (copy differs from the FRD sentence).

### AC-02-015.9 · behaviour only · `model-diagram`, `project-architecture`

> - AC-02-015.9 — WHEN identical project artifacts are opened from the board, portfolio workspace or direct project page, THE system SHALL use the same reader and viewer and SHALL retain all other Architecture sections (REQ-02-013).

**Prototype:** Same viewer from board and workspace.

### AC-02-015.10 · not drawn · `model-diagram`

> - AC-02-015.10 — WHEN arranging a valid model, THE viewer SHALL use deterministic orthogonal field-port routing, keep every entity nonoverlapping and every connector outside card interiors, retain distinct self/parallel links and center an initially readable, complete connected entity rather than clipping the first table. Ajustar SHALL fit the complete graph; Restablecer SHALL restore the readable starting view.

**Prototype:** Layout is a simple 5-column masonry with curved links, not orthogonal field-port routing; the proposal says the real engine must keep or replace this deliberately.

### AC-02-015.11 · not drawn · `model-diagram`

> - AC-02-015.11 — WHEN asynchronous layout is pending, fails or belongs to a previous project, THE viewer SHALL show an explicit bounded loading/error state, isolate responses by model identity and cancel old/overdue worker tasks, without blocking browser interaction.

**Prototype:** No loading/error state of the layout worker is drawn.

### AC-02-015.12 · behaviour only · `model-zoomed-out`

> - AC-02-015.12 — WHEN the owner zooms or pans, THE model viewer SHALL use 15% button steps and delta-mode-normalized proportional wheel scaling, batch wheel/pointer updates once per animation frame, retain unchanged entity/edge content and cancel queued frames on direct reset/fit or unmount.

**Prototype:** Zoom steps are behaviour; the zoomed-out result is captured.

### AC-02-015.13 · behaviour only · `model-diagram`

> - AC-02-015.13 — WHEN interacting with inline or expanded diagram entity cards, THE viewer SHALL prevent text selection inside those cards and clear any existing browser selection on canvas pointer-down; expanded schema text SHALL remain selectable.

**Prototype:** Text selection inside cards is behaviour.

### AC-02-015.14 · drawn · `idea-spec`, `idea-architecture`

> - AC-02-015.14 — WHEN Propuesta, Spec or Arquitectura is displayed, THE content panels SHALL use the available host width without a fixed inner panel-width cap; long introductory prose MAY retain its readable line-length limit.

**Prototype:** Bands fill the host width (content frame 1180 px); intro prose keeps a readable cap.

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `board` | `#tablero` | (none) | full page | `FRD-02#U1` `REQ-02-002` `REQ-02-005` `REQ-02-006` `REQ-02-014` `AC-02-012.3` |
| `board-hide-empty` | `#tablero` | click `[data-action="toggle-empty"]` | full page | — |
| `board-search` | `#tablero` | fill `#idea-search` = "panda" | full page | — |
| `board-category-filter` | `#tablero` | click `[data-cat-filter="web"]` | full page | `REQ-02-005` |
| `board-favorite` | `#tablero` | click `.kcard [data-star]` | full page | `AC-02-012.1` `AC-02-012.2` `AC-02-012.3` `AC-02-012.4` |
| `board-phase-jump` | `#tablero` | click `[data-phase-jump="architecture"]` | full page; settle 800 ms | `REQ-02-002` |
| `board-capture-dialog` | `#tablero` | click `[data-action="capture"]` → wait for `dialog[open]` | capture viewport | `REQ-02-003` |
| `board-discarded-dialog` | `#tablero` | click `[data-action="discarded"]` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `FRD-02#U4` |
| `idea-pitch` | `#idea?idea=book-memory-without-spoilers&tab=Propuesta` | (none) | full page | `FRD-02#U2` `AC-02-009.1` `AC-02-009.5` `AC-02-009.2` `AC-02-012.3` `AC-02-009.1-b` |
| `idea-spec` | `#idea?idea=book-memory-without-spoilers&tab=Spec` | (none) | full page | `AC-02-009.1` `AC-02-009.2` `AC-02-009.4` `AC-02-011.1` `AC-02-011.2` `AC-02-011.3` `AC-02-015.14` `AC-02-009.1-b` |
| `idea-architecture` | `#idea?idea=funko-tracker&tab=Arquitectura` | (none) | full page | `AC-02-009.1` `AC-02-009.2` `AC-02-013.1` `AC-02-013.2` `AC-02-013.3` `AC-02-013.4` `AC-02-013.5` `AC-02-015.14` `AC-02-009.1-b` |
| `idea-documents` | `#idea?idea=funko-tracker&tab=Documentos` | (none) | full page | `FRD-02#U2` `AC-02-009.1` `AC-02-009.2` `AC-02-009.3` `AC-02-009.4-b` `AC-02-009.1-b` `AC-02-009.2-b` |
| `idea-campaign` | `#idea?idea=book-memory-without-spoilers&tab=Campa%C3%B1a` | (none) | full page | `FRD-02#U2` `AC-02-009.1` `AC-02-009.2` `AC-02-010.1` `AC-02-010.2` `AC-02-010.3` `AC-02-010.4` `AC-02-010.6` `AC-02-009.1-b` `AC-02-010.3-b` `AC-02-010.4-b` |
| `idea-campaign-phase` | `#idea?idea=book-memory-without-spoilers&tab=Campa%C3%B1a&phase=3` | (none) | full page | `AC-02-010.4` `AC-02-010.8` `AC-02-010.9` `AC-02-010.4-b` |
| `idea-campaign-research` | `#idea?idea=market-stall-ledger&tab=Campa%C3%B1a` | (none) | full page | `AC-02-010.2` `AC-02-010.4` `AC-02-010.9` `AC-02-010.10` `AC-02-011.1` |
| `idea-campaign-design` | `#idea?idea=book-memory-without-spoilers&tab=Campa%C3%B1a&phase=2` | (none) | full page | `AC-02-010.4` `AC-02-010.8` `AC-02-010.7` |
| `idea-campaign-build` | `#idea?idea=funko-tracker&tab=Campa%C3%B1a` | (none) | full page | `AC-02-010.2` `AC-02-010.4` `AC-02-010.8` `AC-02-010.9` `AC-02-010.5` |
| `idea-campaign-release` | `#idea?idea=book-memory-without-spoilers&tab=Campa%C3%B1a&phase=5` | (none) | full page | `AC-02-010.4` `AC-02-010.7` |
| `idea-frd-dialog` | `#idea?idea=funko-tracker&tab=Spec` | click `.frd-cards .frdc-open` → wait for `dialog[open]` | capture viewport | `AC-02-011.3` |
| `idea-adr-dialog` | `#idea?idea=funko-tracker&tab=Arquitectura` | click `#g-adrs [data-modal]` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `AC-02-013.4` |
| `idea-architecture-frd-dialog` | `#idea?idea=funko-tracker&tab=Arquitectura` | click `.frd-cards .frdc-open` → wait for `dialog[open]` | capture viewport; widths 375/1280 | `AC-02-013.5` `AC-02-013.6` |
| `idea-architecture-missing` | `#idea?idea=tiktok-crossposter&tab=Arquitectura` | (none) | full page | `AC-02-013.1` `AC-02-015.7` |
| `idea-discard-dialog` | `#idea?idea=book-memory-without-spoilers&tab=Propuesta` | click `[data-action="discard-idea"]` → wait for `dialog[open]` | capture viewport | `FRD-02#U3` `REQ-02-008` |
| `idea-shipped` | `#idea?idea=personal-page-v2` | (none) | full page | — |
| `idea-not-found` | `#idea?idea=does-not-exist` | (none) | full page | — |
| `idea-discarded` | `#idea?idea=client-report-builder` | (none) | full page | `FRD-02#U5` |
| `idea-restore-dialog` | `#idea?idea=client-report-builder` | click `[data-action="restore-idea"]` → wait for `dialog[open]` | capture viewport | `FRD-02#U5` |
| `model-diagram` | `#portfolio?project=pandasaga&tab=Arquitectura&model=Diagrama` | wait for `[data-select-entity]` | full page | `AC-02-015.1` `AC-02-015.3` `AC-02-015.6` `AC-02-015.8` `AC-02-015.9` `AC-02-015.10` `AC-02-015.11` `AC-02-015.13` |
| `model-entity-selected` | `#portfolio?project=pandasaga&tab=Arquitectura&model=Diagrama` | wait for `[data-select-entity]` → click `[data-select-entity]` | full page | `AC-02-015.2` `AC-02-015.5` |
| `model-zoomed-out` | `#portfolio?project=pandasaga&tab=Arquitectura&model=Diagrama` | wait for `[data-graph="out"]` → click `[data-graph="out"]` | full page | `AC-02-015.12` |
| `model-schema` | `#portfolio?project=pandasaga&tab=Arquitectura&model=Esquema` | (none) | full page | `AC-02-015.1` `AC-02-015.4` |
| `model-none` | `#portfolio?project=personal-page-v2&tab=Arquitectura` | (none) | full page | `AC-02-013.2` `AC-02-015.7` |

States cited above that belong to another FRD folder (captured there, reused here): `project-spec`, `project-architecture`, `observability-deps-wo`.

**Not drawn (3)**: `AC-02-013.6`, `AC-02-015.10`, `AC-02-015.11`.

**Partially drawn (19)**: `FRD-02#U1`, `REQ-02-008`, `FRD-02#U4`, `FRD-02#U5`, `AC-02-009.5`, `AC-02-010.9`, `AC-02-010.5`, `AC-02-010.4-b`, `AC-02-010.3-b`, `AC-02-009.2-b`, `AC-02-012.4`, `AC-02-013.1`, `AC-02-013.3`, `AC-02-015.1`, `AC-02-015.2`, `AC-02-015.5`, `AC-02-015.6`, `AC-02-015.7`, `AC-02-015.8`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): `idea-discarded`, `idea-restore-dialog`, `idea-campaign-research`, `idea-campaign-design`, `idea-campaign-build`, `idea-campaign-release`, `idea-architecture-frd-dialog`, `idea-architecture-missing`, `model-none`.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### Shared page chrome (listed once, appears in most states of this FRD)

- Volver al tablero
- Abrir en Portafolio
- Descartar idea
- Ver secciones anteriores
- Ver más secciones
- Secciones de la idea
- Spec

### `board`

- [span] Captura de proyectos · 20 oct. 2026, 7:20 p. m.
- [p] Todas tus ideas por fase. Cada tarjeta abre su propuesta y, si ya es proyecto, su documentación completa.
- [button] Descartadas · 12
- [button] Capturar ideas
- [@placeholder] Buscar por nombre o contenido…
- [@aria-label] Filtrar por categoría
- [button] Todas 10
- [button] ai 2
- [button] automation 1
- [button] claude-code 1
- [button] web 6
- [button] Limpiar
- [@aria-label] Ir a una fase
- [button] Investigación 5
- [button] Producto 0
- [button] Diseño 0
- [button] Arquitectura 2
- [button] Construcción 2
- [button] Lanzamiento 1
- [@aria-label] Tablero por fases. Desliza o usa las flechas para ver más columnas.
- [@aria-label] Investigación: 5 ideas
- [@aria-label] Marcar como favorita: Cuaderno de Feria — inventario y ventas para puestos de mercado (×6 of the same pattern)
- [span] Score 74 (×8 of the same pattern)
- [span] Mixta
- [@aria-label] Quitar de favoritas: PandaLearn — tarjetas de estudio que se adaptan a tu ritmo (×4 of the same pattern)
- [div] Sin coincidencias
- [@aria-label] Producto: 0 ideas
- [p] Sin ideas en esta fase
- [@aria-label] Diseño: 0 ideas
- [@aria-label] Arquitectura: 2 ideas
- [span] 0/35 WO (×4 of the same pattern)
- [span] Proyecto creado
- [@aria-label] Construcción: 2 ideas
- [span] Construyendo
- [span] Sin score
- [@aria-label] Lanzamiento: 1 idea

### `board-hide-empty`

- (no strings beyond the shared chrome and the first state of the same route)

### `board-search`

- [span] 5 ideas coinciden

### `board-category-filter`

- [span] 6 ideas coinciden

### `board-favorite`

- [@aria-label] Quitar de favoritas: Cuaderno de Feria — inventario y ventas para puestos de mercado

### `board-phase-jump`

- (no strings beyond the shared chrome and the first state of the same route)

### `board-capture-dialog`

- [dlg p] Ideas
- [dlg p] Copia el comando según lo que quieras hacer y pégalo en Claude Code.
- [dlg span] Explorar una idea difusa conversando
- [dlg code] /pandacorp: explore
- [dlg @aria-label] Copiar /pandacorp:explore
- [dlg span] Capturar una idea que ya tienes clara
- [dlg code] /pandacorp: new-idea
- [dlg @aria-label] Copiar /pandacorp:new-idea
- [dlg span] Que la fábrica busque oportunidades
- [dlg code] /pandacorp: discover
- [dlg @aria-label] Copiar /pandacorp:discover
- [dlg span] Pedir una recomendación de cartera
- [dlg code] /pandacorp: recommend
- [dlg @aria-label] Copiar /pandacorp:recommend

### `board-discarded-dialog`

- [dlg p] Ideas
- [dlg h2] Ideas descartadas · 12
- [dlg small] web · leer propuesta y restaurar

### `idea-pitch`

- [span] ai
- [span] Score 72/100
- [p] Etapa: Arquitectura
- [@aria-label] Quitar de favoritas
- [button[tab]] Documentos 66
- [span] Memo-pitch de idea
- [h2] De un vistazo · el sueño
- [h2] Profundizar · el criterio
- [h2] El tablero de decisión
- [h3] Scorecard
- [span] Alto
- [span] wedge
- [span] large
- [span] Media
- [h3] Esfuerzo vs. valor
- [text] ★ zona ideal
- [text] esta idea
- [text] MICRO
- [text] ← más fácil · esfuerzo · más complejo →
- [text] valor →
- [summary] Evidencia y fuentes (lo que sostiene este memo)

### `idea-spec`

- [span] ai
- [span] Score 72/100
- [p] Etapa: Arquitectura
- [@aria-label] Quitar de favoritas
- [button[tab]] Documentos 66
- [span] Resumen del spec
- [span] fase · producto
- [h2] PRD · qué y por qué
- [button] PRD completo
- [h2] Research · la evidencia
- [button] Research completo
- [h2] FRDs · las piezas del v1 (7)
- [span] UI
- [span] 13 work orders planificadas (×6 of the same pattern)
- [span] Infra
- [@title] Tomado del frd.md (ui:); el spec todavía no lista este FRD

### `idea-architecture`

- [span] web
- [span] Mixta
- [span] Score 77/100
- [p] Etapa: Construcción
- [@aria-label] Quitar de favoritas
- [button[tab]] Documentos 82
- [span] fase · Construcción
- [h2] Stack y tecnologías
- [p] Qué tecnologías se usarán para construir la aplicación y por qué se eligieron.
- [th] Capa
- [td] Datos
- [td] ORM
- [h2] Integraciones y operación
- [p] Cómo se conectan y operan las piezas del sistema: flujos, responsabilidades y límites.
- [span] Modelo diseñado, no verificado contra una base viva
- [span] 40 entidades · 43 relaciones · docs/product/data-model.json
- [@aria-label] Buscar entidad o atributo
- [@placeholder] Buscar entidad o atributo…
- [@aria-label] Vista del modelo
- [button] Diagrama
- [@aria-label] Controles del diagrama
- [@aria-label] Alejar
- [@aria-label] Acercar
- [@aria-label] Ajustar a la vista
- [@aria-label] Restablecer
- [@aria-label] Pantalla completa
- [@aria-label] Diagrama de entidades. Arrastra o usa las barras para desplazarte; el esquema textual tiene la misma información.
- [button] Franchise 5
- [span] idPK
- [span] uuid
- [span] slugUQ
- [span] text
- [span] logoAssetIdFK
- [span] uuid?
- [button] Series 5
- [span] franchiseIdFK
- [span] date?
- [button] Character 4
- [span] alias
- [span] text?
- [button] Figure 6
- [span] seriesIdFK
- [span] characterIdFK
- [button] Variant 4
- [span] figureIdFK
- [span] kind
- [span] label
- [button] Edition 4
- [span] variantIdFK
- [span] year
- [button] Retailer 3
- [span] nameUQ
- [button] Retailer exclusive 3
- [span] retailerIdFK
- [button] Region 3
- [span] codeUQ
- [button] Regional release 3
- [span] editionIdFK
- [span] regionIdFK
- [button] Media asset 5
- [span] url
- [span] width
- [span] integer?
- [span] licenceIdFK
- [button] Media licence 3
- [button] Figure image 3
- [span] assetIdFK
- [button] Source 4
- [button] Source record 5
- [span] sourceIdFK
- [button] Ingestion run 5
- [span] timestamp?
- [button] Ingestion item 5
- [span] runIdFK
- [span] sourceRecordIdFK
- [button] Review decision 5
- [span] itemIdFKUQ
- [span] curatorIdFK
- [button] User 5
- [span] emailUQ
- [span] role
- [button] Session 3
- [span] userIdFK
- [button] Magic link 5
- [span] tokenHashUQ
- [button] Collection 3
- [span] userIdFKUQ
- [button] Collection item 6
- [span] collectionIdFK
- [span] note
- … 101 more patterns omitted (same kinds as above).

### `idea-documents`

- [@aria-label] Quitar de favoritas
- [button[tab]] Documentos 82
- [@aria-label] Tabla desplazable
- [th] Eje
- [th] wedge
- [th] Modo
- [@aria-label] Documentos de la idea

### `idea-campaign`

- [span] ai
- [span] Score 72/100
- [p] Etapa: Arquitectura
- [@aria-label] Quitar de favoritas
- [button[tab]] Documentos 66
- [span] El viaje de esta idea por las 6 fases
- [span] Clic en una sala para su ficha
- [@aria-label] 3 de 6 fases entregadas; en curso: Arquitectura
- [span] 3/6 entregadas
- [@aria-label] 1. Investigación: entregado
- [span] 1 · Investigación
- [span] research.md →
- [@aria-label] 2. Producto: entregado
- [span] 2 · Producto
- [span] PRD + FRDs →
- [@aria-label] 3. Diseño: entregado
- [span] 3 · Diseño
- [span] sistema + mocks ↓
- [@aria-label] 6. Lanzamiento: en espera
- [span] 6 · Lanzamiento
- [span] en espera
- [span] ← el código
- [@aria-label] 5. Construcción: en espera
- [span] 5 · Construcción
- [span] ← blueprint + Build Plan
- [@aria-label] 4. Arquitectura: en curso
- [span] 4 · Arquitectura
- [p] Fase 4 de 6
- [@aria-label] Fase anterior: Diseño
- [@aria-label] Fase siguiente: Construcción
- [span] Descripción
- [span] Entra y sale
- [span] Lee
- [span] Equipo · 1 especialista
- [span] Qué puedes correr
- [p] Siguiente paso · avanza a Construcción
- [code] /pandacorp: implement
- [@aria-label] Copiar /pandacorp:implement
- [p] Con cuánta potencia se construye. Se recuerda por proyecto.
- [@aria-label] Potencia 2 de 4 (×4 of the same pattern)
- [small] Equipo de ≤3 agentes; líder opus, obreros sonnet/haiku. Por defecto, pensado para Max 5x.
- [span] deep
- [p] Otras opciones de esta fase
- [code] /pandacorp: architecture
- [@aria-label] Copiar /pandacorp:architecture
- [p] spec y explore se corren desde la fábrica con el nombre de la idea; el resto, dentro de la carpeta del proyecto.

### `idea-campaign-phase`

- [span] ai
- [span] Score 72/100
- [p] Etapa: Arquitectura
- [@aria-label] Quitar de favoritas
- [button[tab]] Documentos 66
- [span] El viaje de esta idea por las 6 fases
- [span] Clic en una sala para su ficha
- [@aria-label] 3 de 6 fases entregadas; en curso: Arquitectura
- [span] 3/6 entregadas
- [@aria-label] 1. Investigación: entregado
- [span] 1 · Investigación
- [span] research.md →
- [@aria-label] 2. Producto: entregado
- [span] 2 · Producto
- [span] PRD + FRDs →
- [@aria-label] 3. Diseño: entregado
- [span] 3 · Diseño
- [span] sistema + mocks ↓
- [@aria-label] 6. Lanzamiento: en espera
- [span] 6 · Lanzamiento
- [span] en espera
- [span] ← el código
- [@aria-label] 5. Construcción: en espera
- [span] 5 · Construcción
- [span] ← blueprint + Build Plan
- [@aria-label] 4. Arquitectura: en curso
- [span] 4 · Arquitectura
- [p] Fase 4 de 6
- [@aria-label] Fase anterior: Diseño
- [@aria-label] Fase siguiente: Construcción
- [span] Descripción
- [span] Entra y sale
- [span] Lee
- [span] Equipo · 1 especialista
- [span] Qué puedes correr
- [p] Siguiente paso · avanza a Construcción
- [code] /pandacorp: implement
- [@aria-label] Copiar /pandacorp:implement
- [p] Con cuánta potencia se construye. Se recuerda por proyecto.
- [@aria-label] Potencia 2 de 4 (×4 of the same pattern)
- [small] Equipo de ≤3 agentes; líder opus, obreros sonnet/haiku. Por defecto, pensado para Max 5x.
- [span] deep
- [p] Otras opciones de esta fase
- [code] /pandacorp: architecture
- [@aria-label] Copiar /pandacorp:architecture
- [p] spec y explore se corren desde la fábrica con el nombre de la idea; el resto, dentro de la carpeta del proyecto.

### `idea-campaign-research`

- [span] web
- [span] Score 74/100
- [p] Etapa: Investigación
- [@aria-label] Marcar como favorita
- [span] El viaje de esta idea por las 6 fases
- [span] Clic en una sala para su ficha
- [@aria-label] 0 de 6 fases entregadas; en curso: Investigación
- [span] 0/6 entregadas
- [@aria-label] 1. Investigación: en curso
- [span] 1 · Investigación
- [span] research.md →
- [@aria-label] 2. Producto: en espera
- [span] 2 · Producto
- [span] en espera
- [span] PRD + FRDs →
- [@aria-label] 3. Diseño: en espera
- [span] 3 · Diseño
- [span] sistema + mocks ↓
- [@aria-label] 6. Lanzamiento: en espera
- [span] 6 · Lanzamiento
- [span] ← el código
- [@aria-label] 5. Construcción: en espera
- [span] 5 · Construcción
- [span] ← blueprint + Build Plan
- [@aria-label] 4. Arquitectura: en espera
- [span] 4 · Arquitectura
- [p] Fase 1 de 6
- [@aria-label] Fase siguiente: Producto
- [span] Descripción
- [span] Entra y sale
- [span] Lee
- [span] Equipo · 1 especialista
- [span] Qué puedes correr
- [p] Siguiente paso · avanza a Producto
- [code] /pandacorp: spec market-stall-ledger
- [@aria-label] Copiar /pandacorp:spec market-stall-ledger
- [b] ask
- [code] /pandacorp: spec market-stall-ledger --ask
- [@aria-label] Copiar /pandacorp:spec market-stall-ledger --ask
- [b] auto
- [code] /pandacorp: spec market-stall-ledger --auto
- [@aria-label] Copiar /pandacorp:spec market-stall-ledger --auto
- [b] infer
- [code] /pandacorp: spec market-stall-ledger --infer
- [@aria-label] Copiar /pandacorp:spec market-stall-ledger --infer
- [p] Otras opciones de esta fase
- [code] /pandacorp: explore market-stall-ledger
- [@aria-label] Copiar /pandacorp:explore market-stall-ledger
- [p] spec y explore se corren desde la fábrica con el nombre de la idea; el resto, dentro de la carpeta del proyecto.

### `idea-campaign-design`

- [span] ai
- [span] Score 72/100
- [p] Etapa: Arquitectura
- [@aria-label] Quitar de favoritas
- [button[tab]] Documentos 66
- [span] El viaje de esta idea por las 6 fases
- [span] Clic en una sala para su ficha
- [@aria-label] 3 de 6 fases entregadas; en curso: Arquitectura
- [span] 3/6 entregadas
- [@aria-label] 1. Investigación: entregado
- [span] 1 · Investigación
- [span] research.md →
- [@aria-label] 2. Producto: entregado
- [span] 2 · Producto
- [span] PRD + FRDs →
- [@aria-label] 3. Diseño: entregado
- [span] 3 · Diseño
- [span] sistema + mocks ↓
- [@aria-label] 6. Lanzamiento: en espera
- [span] 6 · Lanzamiento
- [span] en espera
- [span] ← el código
- [@aria-label] 5. Construcción: en espera
- [span] 5 · Construcción
- [span] ← blueprint + Build Plan
- [@aria-label] 4. Arquitectura: en curso
- [span] 4 · Arquitectura
- [p] Fase 3 de 6
- [@aria-label] Fase anterior: Producto
- [@aria-label] Fase siguiente: Arquitectura
- [span] Descripción
- [span] Entra y sale
- [span] Lee
- [span] Equipo · 2 especialistas
- [span] Qué puedes correr
- [p] Siguiente paso · avanza a Arquitectura
- [code] /pandacorp: architecture
- [@aria-label] Copiar /pandacorp:architecture
- [p] Otras opciones de esta fase
- [code] /pandacorp: design
- [@aria-label] Copiar /pandacorp:design
- [p] spec y explore se corren desde la fábrica con el nombre de la idea; el resto, dentro de la carpeta del proyecto.

### `idea-campaign-build`

- [span] web
- [span] Mixta
- [span] Score 77/100
- [p] Etapa: Construcción
- [@aria-label] Quitar de favoritas
- [button[tab]] Documentos 82
- [span] El viaje de esta idea por las 6 fases
- [span] Clic en una sala para su ficha
- [@aria-label] 4 de 6 fases entregadas; en curso: Construcción
- [span] 4/6 entregadas
- [@aria-label] 1. Investigación: entregado
- [span] 1 · Investigación
- [span] research.md →
- [@aria-label] 2. Producto: entregado
- [span] 2 · Producto
- [span] PRD + FRDs →
- [@aria-label] 3. Diseño: entregado
- [span] 3 · Diseño
- [span] sistema + mocks ↓
- [@aria-label] 6. Lanzamiento: en espera
- [span] 6 · Lanzamiento
- [span] en espera
- [span] ← el código
- [@aria-label] 5. Construcción: en curso
- [span] 5 · Construcción
- [span] ← blueprint + Build Plan
- [@aria-label] 4. Arquitectura: entregado
- [span] 4 · Arquitectura
- [p] Fase 5 de 6
- [@aria-label] Fase anterior: Arquitectura
- [@aria-label] Fase siguiente: Lanzamiento
- [span] Descripción
- [span] Entra y sale
- [span] Lee
- [span] Equipo · 4 especialistas
- [span] Qué puedes correr
- [p] Siguiente paso · avanza a Lanzamiento
- [code] /pandacorp: release
- [@aria-label] Copiar /pandacorp:release
- [p] Otras opciones de esta fase
- [code] /pandacorp: implement
- [@aria-label] Copiar /pandacorp:implement
- [p] Con cuánta potencia se construye. Se recuerda por proyecto.
- [@aria-label] Potencia 2 de 4 (×4 of the same pattern)
- [small] Equipo de ≤3 agentes; líder opus, obreros sonnet/haiku. Por defecto, pensado para Max 5x.
- [span] deep
- [code] /pandacorp: bug
- [@aria-label] Copiar /pandacorp:bug
- [code] /pandacorp: change
- [@aria-label] Copiar /pandacorp:change
- [p] spec y explore se corren desde la fábrica con el nombre de la idea; el resto, dentro de la carpeta del proyecto.
- [a] Entrar a La Fragua

### `idea-campaign-release`

- [span] ai
- [span] Score 72/100
- [p] Etapa: Arquitectura
- [@aria-label] Quitar de favoritas
- [button[tab]] Documentos 66
- [span] El viaje de esta idea por las 6 fases
- [span] Clic en una sala para su ficha
- [@aria-label] 3 de 6 fases entregadas; en curso: Arquitectura
- [span] 3/6 entregadas
- [@aria-label] 1. Investigación: entregado
- [span] 1 · Investigación
- [span] research.md →
- [@aria-label] 2. Producto: entregado
- [span] 2 · Producto
- [span] PRD + FRDs →
- [@aria-label] 3. Diseño: entregado
- [span] 3 · Diseño
- [span] sistema + mocks ↓
- [@aria-label] 6. Lanzamiento: en espera
- [span] 6 · Lanzamiento
- [span] en espera
- [span] ← el código
- [@aria-label] 5. Construcción: en espera
- [span] 5 · Construcción
- [span] ← blueprint + Build Plan
- [@aria-label] 4. Arquitectura: en curso
- [span] 4 · Arquitectura
- [p] Fase 6 de 6
- [@aria-label] Fase anterior: Construcción
- [span] Descripción
- [span] Entra y sale
- [span] Lee
- [span] Equipo · 1 especialista
- [span] Qué puedes correr
- [p] Siguiente paso
- [code] /pandacorp: iterate
- [@aria-label] Copiar /pandacorp:iterate
- [p] Otras opciones de esta fase
- [code] /pandacorp: review-launch
- [@aria-label] Copiar /pandacorp:review-launch
- [code] /pandacorp: new-version
- [@aria-label] Copiar /pandacorp:new-version
- [code] /pandacorp: sync
- [@aria-label] Copiar /pandacorp:sync
- [p] spec y explore se corren desde la fábrica con el nombre de la idea; el resto, dentro de la carpeta del proyecto.

### `idea-frd-dialog`

- [dlg p] FRD-01 · Spec
- [dlg span] Visión
- [dlg span] 14/16 verificados
- [dlg button] Ver work orders

### `idea-adr-dialog`

- (no strings beyond the shared chrome and the first state of the same route)

### `idea-architecture-frd-dialog`

- [dlg p] FRD-01 · Plan de implementación
- [dlg span] Visión
- [dlg span] 14/16 verificados
- [dlg button] Ver work orders

### `idea-architecture-missing`

- [span] web
- [span] Mixta
- [span] Score 67/100
- [p] Etapa: Arquitectura
- [@aria-label] Quitar de favoritas
- [button[tab]] Documentos 11
- [span] La arquitectura todavía no está publicada.

### `idea-discard-dialog`

- [dlg p] Confirmar
- [dlg p] «PandaSaga — recuerda tus historias sin spoilers y descubre sus conexiones» pasará a la lista de descartadas. Podrás restaurarla después.
- [dlg label] Motivo (opcional)
- [dlg @placeholder] Por qué…
- [dlg p] Esta maqueta no modifica archivos de la fábrica. En la app real esta acción escribe solo el campo acotado de su tarjeta.
- [dlg button] Cancelar

### `idea-shipped`

- [span] web
- [span] Mixta
- [span] Score 80/100
- [p] Etapa: Lanzamiento
- [@aria-label] Marcar como favorita
- [button[tab]] Documentos 53
- [span] Memo-pitch de idea
- [h2] De un vistazo · el sueño
- [h2] Profundizar · el criterio
- [h2] El tablero de decisión
- [h3] Scorecard
- [span] Alto
- [span] wedge
- [span] Medio
- [span] small
- [span] Media
- [h3] Esfuerzo vs. valor
- [text] ★ zona ideal
- [text] esta idea
- [text] MICRO
- [text] ← más fácil · esfuerzo · más complejo →
- [text] valor →

### `idea-not-found`

- [strong] Esta idea no existe en la captura
- [span] No hay ninguna idea con el identificador «does-not-exist».

### `idea-discarded`

- [span] web
- [span] Sin score
- [p] Descartada
- [@aria-label] Marcar como favorita
- [button] Restaurar
- [span] Memo-pitch de idea

### `idea-restore-dialog`

- [dlg p] Confirmar
- [dlg h2] Restaurar idea
- [dlg p] «Informe Express — reportes mensuales para clientes de agencias» volverá a su columna del tablero.
- [dlg label] Motivo (opcional)
- [dlg @placeholder] Por qué…
- [dlg p] Esta maqueta no modifica archivos de la fábrica. En la app real esta acción escribe solo el campo acotado de su tarjeta.
- [dlg button] Cancelar

### `model-diagram`

- [@aria-label] Ruta
- [span] 0/35 WO · 0%
- [@aria-label] Fase: Arquitectura
- [@data-tip] 1. Investigación · completada
- [span] Investigación: completada
- [@data-tip] 2. Producto · completada
- [span] Producto: completada
- [@data-tip] 3. Diseño · completada
- [span] Diseño: completada
- [@data-tip] 4. Arquitectura · fase actual
- [span] Arquitectura: fase actual
- [@data-tip] 5. Construcción · pendiente
- [span] Construcción: pendiente
- [@data-tip] 6. Lanzamiento · pendiente
- [span] Lanzamiento: pendiente
- [b] Cambiar proyecto
- [@aria-label] Secciones de PandaSaga
- [button[tab]] Observabilidad 35
- [button[tab]] Cuentas 5
- [button[tab]] Documentos 66
- [span] fase · Arquitectura
- [h2] Stack y tecnologías
- [p] Qué tecnologías se usarán para construir la aplicación y por qué se eligieron.
- [th] Capa
- [td] Datos
- [td] ORM
- [td] Caché
- [td] Mapa
- [h2] Integraciones y operación
- [p] Cómo se conectan y operan las piezas del sistema: flujos, responsabilidades y límites.
- [b] Web
- [span] Modelo diseñado, no verificado contra una base viva
- [span] 26 entidades · 36 relaciones · docs/product/data-model.json
- [@aria-label] Buscar entidad o atributo
- [@placeholder] Buscar entidad o atributo…
- [@aria-label] Vista del modelo
- [button] Diagrama
- [@aria-label] Controles del diagrama
- [@aria-label] Alejar
- [@aria-label] Acercar
- [@aria-label] Ajustar a la vista
- [@aria-label] Restablecer
- [@aria-label] Pantalla completa
- [@aria-label] Diagrama de entidades. Arrastra o usa las barras para desplazarte; el esquema textual tiene la misma información.
- [button] User 4
- [span] idPK
- [span] uuid
- [span] emailUQ
- [span] text?
- [button] Guest context 4
- [span] deviceKeyUQ
- [span] mergedIntoUserIdFK
- [span] uuid?
- [button] Work 4
- [span] slugUQ
- [span] title
- [button] Medium 3
- [span] codeUQ
- [button] Release 5
- [span] workIdFK
- [span] mediumIdFK
- [button] Chapter 4
- [span] releaseIdFK
- [button] Reading progress 6
- [span] userIdFK
- [span] guestIdFK
- [span] chapterIdFK
- [button] Character 4
- [span] firstChapterIdFK
- [button] Place 4
- [button] Faction 4
- [button] Encyclopedia entry 4
- [span] kind
- [button] Entry revision 4
- [span] entryIdFK
- [span] visibleFromChapterIdFK
- [span] body
- [button] Connection 6
- [span] fromEntryIdFK
- [span] toEntryIdFK
- [span] typeIdFK
- [span] revealedAtChapterIdFK
- [button] Connection type 2
- [span] labelUQ
- [button] Recap 4
- [span] upToChapterIdFK
- [button] Recap section 4
- [span] recapIdFK
- [button] Chapter summary 2
- [span] chapterIdPKFK
- … 66 more patterns omitted (same kinds as above).

### `model-entity-selected`

- (no strings beyond the shared chrome and the first state of the same route)

### `model-zoomed-out`

- (no strings beyond the shared chrome and the first state of the same route)

### `model-schema`

- [@aria-label] Ruta
- [span] 0/35 WO · 0%
- [@aria-label] Fase: Arquitectura
- [@data-tip] 1. Investigación · completada
- [span] Investigación: completada
- [@data-tip] 2. Producto · completada
- [span] Producto: completada
- [@data-tip] 3. Diseño · completada
- [span] Diseño: completada
- [@data-tip] 4. Arquitectura · fase actual
- [span] Arquitectura: fase actual
- [@data-tip] 5. Construcción · pendiente
- [span] Construcción: pendiente
- [@data-tip] 6. Lanzamiento · pendiente
- [span] Lanzamiento: pendiente
- [b] Cambiar proyecto
- [@aria-label] Secciones de PandaSaga
- [button[tab]] Observabilidad 35
- [button[tab]] Cuentas 5
- [button[tab]] Documentos 66
- [span] fase · Arquitectura
- [h2] Stack y tecnologías
- [p] Qué tecnologías se usarán para construir la aplicación y por qué se eligieron.
- [th] Capa
- [td] Datos
- [td] ORM
- [td] Caché
- [td] Mapa
- [h2] Integraciones y operación
- [p] Cómo se conectan y operan las piezas del sistema: flujos, responsabilidades y límites.
- [b] Web
- [span] Modelo diseñado, no verificado contra una base viva
- [span] 26 entidades · 36 relaciones · docs/product/data-model.json
- [@aria-label] Buscar entidad o atributo
- [@placeholder] Buscar entidad o atributo…
- [@aria-label] Vista del modelo
- [button] Diagrama
- [summary] User 4 atributos
- [pre] model User { id uuid @PK email text @UQ displayName text? createdAt timestamp }
- [@aria-label] Esquema de User
- [summary] Guest context 4 atributos
- [pre] model Guest context { id uuid @PK deviceKey text @UQ createdAt timestamp mergedIntoUserId uuid? @FK }
- [@aria-label] Esquema de Guest context
- [summary] Work 4 atributos
- [pre] model Work { id uuid @PK slug text @UQ title text summary text }
- [@aria-label] Esquema de Work
- [summary] Medium 3 atributos
- [pre] model Medium { id uuid @PK code text @UQ label text }
- [@aria-label] Esquema de Medium
- [summary] Release 5 atributos
- [pre] model Release { id uuid @PK workId uuid @FK mediumId uuid @FK title text position integer }
- [@aria-label] Esquema de Release
- [summary] Chapter 4 atributos
- [pre] model Chapter { id uuid @PK releaseId uuid @FK number integer title text }
- [@aria-label] Esquema de Chapter
- [summary] Reading progress 6 atributos
- [pre] model Reading progress { id uuid @PK userId uuid? @FK guestId uuid? @FK releaseId uuid @FK chapterId uuid @FK updatedAt timestamp }
- [@aria-label] Esquema de Reading progress
- [summary] Character 4 atributos
- [pre] model Character { id uuid @PK workId uuid @FK name text firstChapterId uuid @FK }
- [@aria-label] Esquema de Character
- [summary] Place 4 atributos
- [pre] model Place { id uuid @PK workId uuid @FK name text firstChapterId uuid @FK }
- [@aria-label] Esquema de Place
- [summary] Faction 4 atributos
- [pre] model Faction { id uuid @PK workId uuid @FK name text firstChapterId uuid @FK }
- [@aria-label] Esquema de Faction
- [summary] Encyclopedia entry 4 atributos
- [pre] model Encyclopedia entry { id uuid @PK workId uuid @FK kind text title text }
- [@aria-label] Esquema de Encyclopedia entry
- [summary] Entry revision 4 atributos
- [pre] model Entry revision { id uuid @PK entryId uuid @FK visibleFromChapterId uuid @FK body text }
- [@aria-label] Esquema de Entry revision
- [summary] Connection 6 atributos
- [pre] model Connection { id uuid @PK workId uuid @FK fromEntryId uuid @FK toEntryId uuid @FK typeId uuid @FK revealedAtChapterId uuid @FK }
- [@aria-label] Esquema de Connection
- [summary] Connection type 2 atributos
- [pre] model Connection type { id uuid @PK label text @UQ }
- [@aria-label] Esquema de Connection type
- [summary] Recap 4 atributos
- [pre] model Recap { id uuid @PK releaseId uuid @FK upToChapterId uuid @FK generatedAt timestamp }
- [@aria-label] Esquema de Recap
- [summary] Recap section 4 atributos
- [pre] model Recap section { id uuid @PK recapId uuid @FK position integer body text }
- [@aria-label] Esquema de Recap section
- [summary] Chapter summary 2 atributos
- [pre] model Chapter summary { chapterId uuid @PK @FK body text }
- [@aria-label] Esquema de Chapter summary
- [summary] Catalog bundle 4 atributos
- [pre] model Catalog bundle { id uuid @PK workId uuid @FK version integer publishedAt timestamp? }
- … 73 more patterns omitted (same kinds as above).

### `model-none`

- [@aria-label] Ruta
- [span] PV
- [span] 19/25 WO · 76%
- [@aria-label] Fase: Lanzamiento
- [@data-tip] 1. Investigación · completada
- [span] Investigación: completada
- [@data-tip] 2. Producto · completada
- [span] Producto: completada
- [@data-tip] 3. Diseño · completada
- [span] Diseño: completada
- [@data-tip] 4. Arquitectura · completada
- [span] Arquitectura: completada
- [@data-tip] 5. Construcción · completada
- [span] Construcción: completada
- [@data-tip] 6. Lanzamiento · fase actual
- [span] Lanzamiento: fase actual
- [b] Cambiar proyecto
- [@aria-label] Secciones de PersonalPage v2
- [button[tab]] Observabilidad 25
- [button[tab]] Cuentas 3
- [button[tab]] Cambios 6
- [button[tab]] Documentos 53
- [span] fase · Lanzamiento
- [h2] Stack y tecnologías
- [p] Qué tecnologías se usarán para construir la aplicación y por qué se eligieron.
- [th] Capa
- [h2] Integraciones y operación
- [p] Cómo se conectan y operan las piezas del sistema: flujos, responsabilidades y límites.
- [p] Este proyecto declara explícitamente que no usa base de datos.
- [h2] Variables de entorno 4
- [p] Qué es y para qué sirve cada variable, según .env.example. Los valores nunca se muestran.
- [span] Todas descritas
- [p] Sitio
- [h2] Decisiones 3
- [h2] Plan de implementación
- [p] Cada fila es un FRD y cada cuadro una work order, por su estado; en la app real este bloque es el grafo interactivo de dependencias.
- [span] FRD-01Estructura, idiomas y temas
- [@aria-label] WO-01-001: Verificado (×25 of the same pattern)
- [@title] WO-01-001 · Layout shell with skip link (×25 of the same pattern)
- [span] FRD-02Inicio y posicionamiento
- [span] FRD-03Proyectos y casos
- [span] FRD-04Sobre mí y ahora
- [span] FRD-05Blog en MDX
- [span] FRD-06SEO y datos estructurados
- [span] FRD-07Contacto
- [span] FRD-08Skill para escribir el blog
- [span] UI
- [@aria-label] 4 verificado, 0 en revisión, 0 en curso, 0 bloqueado, 0 planificado (×5 of the same pattern)
- [span] Infra
- [span] Tool

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- REQ-02-003 "Capture ideas / oportunidades" | prototype button and dialog title "Capturar ideas" (board, board-capture-dialog); FRD text is English, interface is Spanish.
- REQ-02-014 "Sin ideas en esta columna" | "Sin ideas en esta fase" (board).
- U4 "Ver descartadas" button | "Descartadas · 12" (board) ; modal title "Ideas descartadas · 12".
- U5 "Volver a agregar" | "Restaurar" (idea-discarded) ; dialog title "Restaurar idea".
- U3/REQ-02-008 button "Discard idea" | "Descartar idea" ; dialog "Descartar idea" with "Motivo (opcional)".
- AC-02-015.8 "Modelo diseñado. Implementación sin verificar." | "Modelo diseñado, no verificado contra una base viva" (model-diagram).
- Column names "1 Investigación · 2 Producto · 3 Diseño · 4 Arquitectura · 5 Construcción · 6 Release" | "Lanzamiento" instead of "Release" (board, idea-campaign); the same rename applies in the Campaña ficha ("6 · Lanzamiento").
- AC-02-011.2 "📋 PRD, 🔬 Research, 🧩 FRDs" | "PRD · qué y por qué", "Research · la evidencia", "FRDs · las piezas del v1" (idea-spec).
- AC-02-011.3 FRD modal sections "Overview, User stories, Reglas de negocio, Fuera de alcance, Open questions" | "Visión, Historias de usuario, Reglas de negocio, Fuera de alcance, Preguntas abiertas" (idea-frd-dialog).
- AC-02-010.1 "EL VIAJE DE ESTA IDEA POR LAS 6 FASES" (uppercase) | "El viaje de esta idea por las 6 fases" (sentence case).
- AC-02-010.9 select option "default" | no select; disclosure "Elegir modo de construcción" / "Cuántas preguntas te hago antes de generar la documentación".
- AC-02-010.4 labels "LEE" / "ESCRIBE" | "Lee" / "Escribe" under "Entra y sale" (upper-cased by CSS).
- AC-02-012.3 aria-label "Marcar como favorita" | "Marcar como favorita: <título>" on cards.

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- Platform: prototype lists ALL tabs for any project-linked idea (Arquitectura even with no architecture), FRD omits the tab when both artifacts are absent (AC-02-013.1).
- "Entrar a La Fragua" targets tab=Party (removed): La Fragua is now the top of the project Resumen.
- Idea hero shows the verdict chip "🧪 validate"; AC-02-009.5 says to omit the verdict badge.
- REQ-02-008 quick-tags and in-flight state; AC-02-012.4 gold card highlight; AC-02-013.6 scoped DAG in the FRD dialog: FRD wants, prototype lacks (Group B candidates).
- Plan de implementación is a mosaic, the AC wants the real DAG component (AC-02-013.3).

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- 2026-10-21 scope decision: the board's "recommended" badge is NOT drawn and stays out of v2; Campaña's per-phase checklists stay out of v2 (the ficha carries description, reads, writes, team and commands only).
- Iterations 5-6: one horizontal pipeline at every width, 280 px columns, phase selector with counts, "Ocultar columnas vacías" switch remembered per browser, no drag-and-drop.
- Iterations 7-14, 28: idea tabs follow the app's structure (hero, tinted bands, label | content rows) with the shared card header; no coloured edge stripes; FRD kind tags in colour (UI pink, Infra slate, Tool/CLI teal).
- Iteration 11-12: Campaña keeps its animations (roaming cast in the active room, idle-bob in finished rooms, static and dimmed when locked, nothing under reduced motion).
- Iteration 27 language rule: interface Spanish, shown content keeps its language; the phase name "Release" shows as "Lanzamiento"; artifact names (FRD, PRD, ADR, work order, spec, backlog) stay English.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
