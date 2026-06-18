---
id: WO-06-006
type: work-order
slug: party-scene
title: 'WO-06-006 — La Fragua scene (rooms, WO sprites, +N en cola, gate, trophies, tracker)'
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
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

## Status Note (La Fragua redesign — what the retry must build)

**Why reopened:** the shipped `PartyScene` renders 4 zones (`party-zone-{library|forge|workshop|lab}`)
+ one sprite per roster role with wandering. The faithful scene (renamed `FraguaScene`) renders the
three rooms, **one sprite per running WO** capped at the wave, the **"+N en cola"** badge, the
**reviewer gate**, the **trophy shelf** + "+N archivados", the **parchment**, and the **FRD tracker +
global counter**, per the visual contract. New `data-testid`s: `fragua-scene`, `fragua-room-{forge|
tribunal|vault}`, `fragua-wo-{id}` (running sprites), `fragua-queue-badge`, `fragua-reviewer`
(`data-gate-open`), `fragua-trophy-{id}`, `fragua-archived`, `fragua-parchment`, `fragua-frd-tracker`,
`fragua-project-counter`, sprite hover tooltip. Delete the 4-zone render and the roster prop. Defer the
deep relay to `<DeepRelay>` (WO-06-013). Rewrite the 27 tests against the new model; RAF mocked; no
control affordance present (AC-06-009.1).

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
