---
id: WO-02-012
type: work-order
slug: go-party
title: WO-02-012 — Host-navigation from Construcción to the Party tab
status: ACTIVE
parent: FRD-02
implementation_status: PLANNED
source_requirements: [REQ-02-010]
last_updated: '2026-06-18'
---
# WO-02-012 — Host-navigation from Construcción to the Party tab

**Module:** host-navigation glue (the `onEnterForge(slug)` callback wired from the board card detail
to the host router / Portfolio → project → Party tab, FRD-06)
**IDs touched:** `CMP-02-go-party`, `IF-02-goParty`; REQ-02-010
**Dependencies:** WO-02-010 (`CampaignPipeline` raises the callback), FRD-06 (the Party tab is the
navigation target)

> Prototype reference: `prototype/index.html` exposes `window.mcGoParty(slug)` which sets
> `ST.view="portfolio"`, `ST.projectSlug=slug`, `ST.projectTab="mission"` and re-renders. In the app
> this becomes a typed host-navigation action on the router/state, NOT a `window.parent` bridge — the
> `CampaignPipeline` is a native component, not an iframe.

## EARS criteria (from FRD-02)

- AC-02-010.5 — WHEN the owner activates the Construcción (build) phase's "Entrar a La Fragua"
  action, THE system SHALL **navigate the host app** to Portfolio → that project → the **Party** tab
  (FRD-06 / La Fragua) for that project, WITHOUT an inner iframe reload of the card detail.

## Contract

```ts
// Host-side navigation: switch the app to Portfolio, select the project, open its Party tab.
export function goToParty(slug: string): void; // sets view=portfolio, projectSlug=slug, projectTab=party
```

Wired as the `onEnterForge` prop of `CampaignPipeline` (WO-02-010). No fs, no write — it only changes
host navigation/UI state.

## Definition of done

- [ ] Test (RED first): calling the navigation action with a slug sets the host to Portfolio, selects
  that project, and opens its Party tab (assert the resulting host state / route), with no full
  reload of the card detail.
- [ ] Resolves to FRD-06's Party tab for the given project; unknown slug → safe no-op (no crash).
- [ ] Read-only over the factory; navigation/UI state only.
- [ ] `.pandacorp/verify.sh` green (biome + tsc + vitest).
