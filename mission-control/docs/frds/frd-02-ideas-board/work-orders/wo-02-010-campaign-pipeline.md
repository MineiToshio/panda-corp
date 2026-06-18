---
id: WO-02-010
type: work-order
slug: campaign-pipeline
title: WO-02-010 — La Campaña pipeline component
status: ACTIVE
parent: FRD-02
implementation_status: PLANNED
source_requirements: [REQ-02-010]
last_updated: '2026-06-18'
---
# WO-02-010 — La Campaña pipeline component

**Module:** `components/CampaignPipeline.tsx`
**IDs touched:** `CMP-02-campaign-pipeline`; REQ-02-010
**Dependencies:** WO-02-011 (`phaseFromStatus`), WO-02-012 (host-navigation callback — for the
build phase's "Entrar a La Fragua")
**Visual contract:** `prototype/party-pipeline.html` embedded in `prototype/index.html`'s board card
detail. Faithful phase model in `prototype/party-redesign-spec.md` §2.

## EARS criteria (from FRD-02)

- AC-02-010.1 — WHEN the Campaña tab is active, THE system SHALL render the **6-phase pipeline** in
  order `research → product → design → architecture → build → release`, each a room, in a labelled
  container.
- AC-02-010.3 — phases **before** the active one render as **done** (showing their deliverable), the
  active one as **current** (glowing), phases **after** as **locked**.
- AC-02-010.4 — WHEN a phase is clicked, THE system SHALL show its **ficha**: description + LEE
  (reads the previous deliverable) + ESCRIBE (writes the next deliverable) + the **WHOLE team** —
  every specialist, its role and what it does (not just the lead). Teams: research=`researcher`;
  product=`product-manager`; design=`designer`+`copywriter`; architecture=`architect`;
  build=`implementer`+`reviewer`+`analytics`; release=`security-auditor`+`devops`.
- AC-02-010.5 — WHEN the build phase's "Entrar a La Fragua" action is activated, THE system SHALL
  **navigate the host app** to Portfolio → that project → the Party tab (FRD-06), no inner reload
  (via the `onEnterForge(slug)` callback — wired in WO-02-012).
- AC-02-010.6 — THE view SHALL be **read-only**: no Claude call, no write, no build trigger.
- AC-02-010.7 — IF a phase is locked (future), THEN it SHALL render a graceful locked/empty state
  (no document, locked marker) without breaking.

## Contract

```tsx
"use client";
export interface CampaignPipelineProps {
  slug: string;                 // the project/idea slug (for host-navigation to Party)
  activePhase: CampaignPhase;   // 0–5, from phaseFromStatus (WO-02-011)
  onEnterForge: (slug: string) => void; // host-navigate to Portfolio → project → Party (WO-02-012)
}
export function CampaignPipeline(props: CampaignPipelineProps): React.JSX.Element;
```

- The 6-phase model (name, deliverable, reads, writes, and the **full team** with role + one-line
  "what it does") is a static constant in the component, faithful to `party-redesign-spec.md` §2 and
  the prototype's `PHASES` / `ROLE_WHAT` tables. No data is invented.
- Each phase rendered done/current/locked by its index vs `activePhase` (AC-02-010.3 / .7).
- Clicking a phase opens its ficha (description + LEE/ESCRIBE + every team member) (AC-02-010.4).
- The build phase exposes "Entrar a La Fragua" → `onEnterForge(slug)` (AC-02-010.5).
- Pure display + local selection state; **no** fs, network, write or Claude (AC-02-010.6).
- `data-testid="campaign-pipeline"`; per-phase `data-testid="campaign-phase-{key}"`; design tokens
  only; Spanish copy.

## Definition of done

- [ ] `components/CampaignPipeline.test.tsx` (RED first, jsdom):
  - [ ] renders 6 phases in order with the labelled container.
  - [ ] given `activePhase=N`, phases <N are done, N is current, >N are locked.
  - [ ] clicking a phase shows its ficha with description + LEE/ESCRIBE + **every** team member of
    that phase (e.g. design shows designer AND copywriter; build shows implementer, reviewer AND
    analytics).
  - [ ] the build phase's "Entrar a La Fragua" calls `onEnterForge` with the slug (AC-02-010.5).
  - [ ] a locked future phase renders the empty/locked state without crashing (AC-02-010.7).
- [ ] Read-only; no write, no network, no fs, no Claude call (assert no such side effects).
- [ ] `.pandacorp/verify.sh` green (biome + tsc + vitest); design-token compliance; a11y.
