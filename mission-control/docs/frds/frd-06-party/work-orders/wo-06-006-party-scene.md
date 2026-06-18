---
id: WO-06-006
type: work-order
slug: party-scene
title: 'WO-06-006 — La Fragua scene (rooms, WO sprites, +N en cola, gate, trophies, tracker)'
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-18'
---
# WO-06-006 — La Fragua scene (rooms, WO sprites, +N en cola, gate, trophies, tracker)

**Components/Interfaces:** `CMP-06-scene` · **Traces:** REQ-06-001, REQ-06-002, REQ-06-003, REQ-06-004, REQ-06-005, REQ-06-006, REQ-06-009
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/FraguaScene.tsx` (+ `.test.tsx`)

> **REOPENED → PLANNED (2026-06-18, La Fragua redesign).** The old scene rendered 4 zones + one sprite
> per roster role + wandering. The faithful scene renders **three rooms**, **one sprite per running WO**
> (≤ wave) + a **"+N en cola"** badge, the **reviewer gate** (one per FRD), the **trophy shelf** with
> **"+N archivados"**, the **parchment**, the **FRD tracker + global counter**, and **hover tooltips**.
> Visual contract: `../../../prototype/party-proposal.html`. The deep relay is rendered by WO-06-013.

## Acceptance criteria (verbatim EARS)
- AC-06-001.1: WHILE a work order is a **running `implementer`**, THE system SHALL render exactly **one sprite** for it in the Sala de Forja.
- AC-06-001.3: WHILE the FRD has additional work orders not yet building, THE system SHALL render them as a single **"+N en cola"** count, NOT as sprites.
- AC-06-002.1: THE system SHALL set the scene to the **single FRD currently in build** and SHALL display that FRD's **title**.
- AC-06-002.3: WHEN a sprite is hovered, THE system SHALL show a tooltip with that work order's **id and title**.
- AC-06-003.1: THE system SHALL render three rooms in a linear flow — Forja, Tribunal, Bóveda — each with its label, and SHALL NOT render a 3-column kanban.
- AC-06-004.1: THE system SHALL render exactly **one `reviewer`** figure for the FRD, dimmed, WHILE not all of the FRD's work orders are `IN_REVIEW`.
- AC-06-004.2: WHEN **all** of the FRD's work orders reach `IN_REVIEW`, THE system SHALL activate the single `reviewer` and SHALL indicate it reviews with **three lenses**.
- AC-06-005.1: WHEN a work order reaches `VERIFIED`, THE system SHALL place it as a **trophy** on the Bóveda shelf.
- AC-06-006.1: WHEN a work order closes and writes its `## Status Note`, THE system SHALL render a **parchment** travelling to a **dependent** work order's station.
- AC-06-009.1: IN production, THE system SHALL NOT expose any pause / reset / agent-control affordance.

## Scope
- `"use client"` `FraguaScene` that mounts the engine (WO-06-004), binds the RAF loop, and renders: the
  three rooms (forge/tribunal/vault) with Spanish labels (AC-06-003.1); one sprite per **running WO**
  (≤ wave) with `implementer` art + halo + progress + WO-id tag + hover tooltip (id+title, AC-06-002.3);
  the **"+N en cola"** badge (AC-06-001.3); the **reviewer** figure dim/active per the gate (AC-06-004);
  the **trophy shelf** + "+N archivados" (AC-06-005); the **parchment** element (AC-06-006); the **FRD
  tracker** (title) + **global counter** (AC-06-002.1).
- Re-mount discipline (`runId` self-stop); tab-hidden pauses RAF.
- Receives `FraguaSnapshot` + event diffs as props; calls `engine.applyEvents` on prop change.
- **No control affordances** (observation-only, AC-06-009.1) — no selector/pause/reset.
- The deep-relay sub-render is delegated to `<DeepRelay>` (WO-06-013).

## Dependencies
- WO-06-004 (engine), WO-06-005 (snapshot/props), WO-06-002 (layout), WO-06-013 (deep relay), FRD-13 tokens; `prefers-reduced-motion` handling in WO-06-011.

## TDD / Definition of done
- Component tests (jsdom + RTL): renders 4 zones with labels; one sprite per roster role placed in its zone; state classes (`s-work/s-walk/s-idle/s-blocked/s-review`) applied from snapshot; no button/control to command agents exists. RAF is mocked.
- Gate green.

## Status Note (WO-06-006 — La Fragua scene — BUILT 2026-06-18)

**What was built:** `FraguaScene` (`"use client"`, CMP-06-scene) — the La Fragua faithful scene
replacing the 4-zone PartyScene stub from WO-06-005. Full RAF loop with `runIdRef` self-stop
discipline + page-visibility pause. Styles extracted to `FraguaScene.styles.ts` to keep the main
component within the 500-line limit (351 + 224 lines).

**Files delivered:**
- `src/app/projects/[slug]/_party/FraguaScene/FraguaScene.tsx` — 351 lines, full implementation.
- `src/app/projects/[slug]/_party/FraguaScene/FraguaScene.styles.ts` — 224 lines, style constants.
- `src/app/projects/[slug]/_party/FraguaScene/_tests/FraguaScene.test.tsx` — 31 tests RED→GREEN.
- Updated `FraguaScene.deeprelay.test.tsx` — stale testid `fragua-wo-chip-{wo}` → `fragua-wo-{wo}`.
- Updated `PartyTab.integration.reviewer.test.tsx` — stale testids `fragua-room-forja/boveda` →
  `fragua-room-forge/vault`.

**Interfaces/contracts exposed:**
```ts
export interface FraguaSceneProps {
  snapshot: FraguaSnapshot;
}
export function FraguaScene({ snapshot }: FraguaSceneProps): React.JSX.Element
```

**data-testid surface (WO-06-006 contract):**
- `fragua-scene` — root `<section>`, aria-label in Spanish
- `fragua-room-forge` — Sala de Forja room (running WO sprites)
- `fragua-room-tribunal` — Tribunal del Juez room (reviewer gate)
- `fragua-room-vault` — Bóveda room (trophy shelf)
- `fragua-wo-{id}` — one sprite per running WO, `title="{id} — {title}"` (hover tooltip)
- `fragua-queue-badge` — "+N en cola" badge (only when queuedCount > 0)
- `fragua-reviewer` — reviewer figure, `data-gate-open={"true"|"false"}`
- `fragua-reviewer-lens-{correctness|security|quality}` — 3 lenses (only when gate open)
- `fragua-trophy-{id}` — one per VERIFIED WO on the Bóveda shelf
- `fragua-archived` — "+N archivados" compact (only when archivedCount > 0)
- `fragua-parchment` — status-note parchment (always present, hidden when inactive)
- `fragua-frd-tracker` — FRD id + title block (only when frd !== null)
- `fragua-project-counter` — global WO done/total counter
- `fragua-mode-display` / `fragua-mode-value` — mode (read-only, no selector)

**Integration seams:**
- Consumes `createFraguaEngine` (WO-06-004) — mounted on effect, seeded from snapshot.
- Delegates deep-mode WOs to `<DeepRelay>` (WO-06-013).
- Receives `FraguaSnapshot` (WO-06-005) as props from RSC `PartyTab`.
- RAF mocked in tests (`vi.stubGlobal("requestAnimationFrame", ...)`).

**AC coverage:**
- AC-06-001.1 ✓ (one sprite per running WO, fragua-wo-{id})
- AC-06-001.3 ✓ (fragua-queue-badge, no sprites for queued WOs)
- AC-06-002.1 ✓ (fragua-frd-tracker shows FRD title)
- AC-06-002.3 ✓ (sprite title attribute = "{id} — {title}")
- AC-06-003.1 ✓ (three rooms, no 4-zone kanban)
- AC-06-004.1/2 ✓ (fragua-reviewer data-gate-open, 3 lenses when open)
- AC-06-005.1/2 ✓ (fragua-trophy-{id}, fragua-archived compact)
- AC-06-006.1 ✓ (fragua-parchment element present)
- AC-06-009.1 ✓ (zero buttons/inputs/selectors)

**Test coverage:** `FraguaScene/_tests/FraguaScene.test.tsx` — 31 tests across 10 describe blocks.
`FraguaScene.deeprelay.test.tsx` — 3 tests for deep-mode relay host (REQ-06-007).

**Gate:** 234 test files, 5931 tests GREEN + 2 expected-fail + 5 skipped. `tsc --noEmit` clean.
`biome check` clean. `verify.sh` PASS. Commit: `7ee7957`.

---

### Previous build (obsoleted by the redesign — kept for history)

**Built:** `PartyScene` (`"use client"`) — the RPG map component (CMP-06-scene). Mounts `createPartyEngine` (WO-06-004), binds it to a `requestAnimationFrame` loop with the PARTY.md §5 re-mount discipline (`runIdRef` self-stop pattern), and renders 4 pixel-art zones with labels + one sprite per roster role with state classes.

**Files delivered:**
- `app/projects/[slug]/_party/PartyScene.tsx` — `"use client"` component: zones (library/forge/workshop/lab) with Spanish labels and pixel-art backgrounds from `prototype/assets/zones/`; sprites from `prototype/assets/agents/` with `image-rendering:pixelated`; RAF loop syncing engine positions + state classes to DOM refs; zero control affordances (observation-only).
- `app/projects/[slug]/_party/PartyScene.test.tsx` — 27 tests RED→GREEN covering all 4 ACs.

**Interfaces/contracts exposed:**
```ts
// PartySceneProps (public API)
export interface AgentInfo { id: Role; state: AgentState; color: string; }
export interface PartySceneProps {
  roster: Role[];          // ordered roster from rosterFor(mode)
  agents: AgentInfo[];     // initial states (server-derived snapshot)
  active: boolean;         // whether there is an active team
  mode: "pro" | "balanced" | "powerful" | "deep";
  events?: VisualAction[]; // prop-driven event dispatch → engine.applyEvents
}
export function PartyScene(props: PartySceneProps): React.JSX.Element
```

**Integration seams:**
- Consumes `createPartyEngine` (WO-06-004) — engine is created on mount, state synced via `engine.setState` on `agents` prop change, events dispatched via `engine.applyEvents` on `events` prop change.
- `data-testid="party-scene"` on root `<section>` (aria-label in Spanish).
- `data-testid="party-zone-{library|forge|workshop|lab}"` on each station, `data-pixelart="true"`.
- `data-testid="party-sprite-{role}"` on each sprite div, `data-zone="{zoneName}"` encoding home zone.
- State classes `mcag s-{work|walk|idle|blocked|review}` on sprite divs (synced by RAF loop and by the `agents` effect).
- Re-mount discipline: `rosterKey` (`roster.join(","):mode`) is the sole dep; RAF loop self-stops via `runIdRef`.

**What is NOT in scope (deferred per WO):**
- `prefers-reduced-motion` disabling RAF — handled in WO-06-011.
- Emotes (…/!/?) and speech bubbles — cosmetic layer, not required by these ACs.
- Progress bars — not in these ACs.
- `PartyTab` integration wiring — WO-06-005 owns the RSC shell; this WO delivers the scene component.

**Test coverage:** `app/projects/[slug]/_party/PartyScene.test.tsx` — 27 tests across 6 describe blocks: zones+labels (AC-06-001.1), sprites per role (AC-06-002.1), state classes (AC-06-003.1), observation-only (AC-06-009.1), container/a11y, prop-change integration seam.

**Gate:** 146 test files, 3951 tests GREEN + 2 expected-fail + 5 skipped. `tsc --noEmit` clean. `biome check` clean. `verify.sh` green.
