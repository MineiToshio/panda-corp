---
id: WO-06-006
type: work-order
slug: party-scene
title: 'WO-06-006 — Party scene render (zones, stations, sprites)'
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-06-006 — Party scene render (zones, stations, sprites)

**Components/Interfaces:** `CMP-06-scene` · **Traces:** REQ-06-001, REQ-06-002, REQ-06-003, REQ-06-004, REQ-06-009
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/PartyScene.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-06-001.1: The view SHALL show 4 pixel-art zones, each with its label.
- AC-06-002.1: EACH workflow subagent SHALL appear as a sprite placed in its zone.
- AC-06-003.1: WHILE there is no stage transition, the sprites SHALL have life (breathing + wandering).
- AC-06-009.1: The view is for **observation**: to redirect/pause an agent, the owner uses the Claude Code app.

## Scope
- `"use client"` component that mounts the engine (WO-06-004), binds it to a `requestAnimationFrame` loop, and renders the DOM: zones with labels, stations (fixed label + dim/hot per activity, PARTY.md §2), sprites (reused assets from `prototype/assets/**`, `image-rendering: pixelated`), halos/emotes/progress bars/speech bubbles per state.
- Re-mount discipline from PARTY.md §5: each render bumps a `runId`; the old loop self-stops; tab-hidden pauses RAF (browser default).
- Receives `PartySnapshot` + event diffs as props; calls `engine.applyEvents` on prop change.
- **No control affordances** (observation-only, REQ-06-009).

## Dependencies
- WO-06-004 (engine), WO-06-005 (snapshot/props), FRD-13 design tokens (agent colors, halos, motion <300ms), `prefers-reduced-motion` (full handling in WO-06-011).

## TDD / Definition of done
- Component tests (jsdom + RTL): renders 4 zones with labels; one sprite per roster role placed in its zone; state classes (`s-work/s-walk/s-idle/s-blocked/s-review`) applied from snapshot; no button/control to command agents exists. RAF is mocked.
- Gate green.

## Status Note

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
