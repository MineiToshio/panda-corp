---
id: WO-02-012
type: work-order
slug: go-party
title: WO-02-012 — Host-navigation from Construcción to the Party tab
status: ACTIVE
parent: FRD-02
implementation_status: VERIFIED
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

- [x] Test (RED first): calling the navigation action with a slug sets the host to Portfolio, selects
  that project, and opens its Party tab (assert the resulting host state / route), with no full
  reload of the card detail.
- [x] Resolves to FRD-06's Party tab for the given project; unknown slug → safe no-op (no crash).
- [x] Read-only over the factory; navigation/UI state only.
- [x] `.pandacorp/verify.sh` green (biome + tsc + vitest).

## Status Note

**Built:** `goToParty(slug, push)` + `partyUrl(slug)` + `useGoToParty()` hook — the complete
host-navigation glue for AC-02-010.5. Navigation target is `/projects/<slug>?tab=party` (the
project workspace URL with the Party tab selected via the FRD-04 `?tab=` convention). Empty /
whitespace-only slugs are a safe no-op: `partyUrl` returns `""` and `goToParty` does NOT call
`push`, so the card detail never crashes.

**Interfaces/contracts exposed:**

```ts
// src/lib/go-party/go-party.ts

/** The ?tab= value for the Party tab — mirrors TabId "party" in the workspace TabBar. */
export const PARTY_TAB_PARAM: "party";

/**
 * Pure URL builder. Returns "/projects/<slug>?tab=party" for valid slugs,
 * "" for empty/whitespace-only slugs (safe no-op marker).
 */
export function partyUrl(slug: string): string;

/**
 * IF-02-goParty contract: navigate to the Party tab for the given project.
 * Calls push(partyUrl(slug)); no-op if slug is empty/whitespace.
 * No fs, no write, no Claude — navigation/UI state only.
 */
export function goToParty(slug: string, push: (url: string) => void): void;

/**
 * React hook: returns (slug: string) => void wired to useRouter().push.
 * Consuming component must be "use client".
 * Wire as onEnterForge prop of CampaignPipeline (WO-02-010):
 *   const handleEnterForge = useGoToParty();
 *   <CampaignPipeline slug={slug} activePhase={phase} onEnterForge={handleEnterForge} />
 */
export function useGoToParty(): (slug: string) => void;
```

**Integration seam:** `CampaignPipeline` (WO-02-010, not yet built) receives `onEnterForge` as a
prop typed `(slug: string) => void`. The host-side wiring is:

```tsx
// In the board card detail host (wherever CampaignPipeline is mounted):
"use client";
const handleEnterForge = useGoToParty();
<CampaignPipeline slug={idea.slug} activePhase={phase} onEnterForge={handleEnterForge} />
```

No inner reload of the card detail: `push` is Next.js App Router client-side navigation — it does
NOT cause a full page reload; the card detail stays mounted.

**Test files:**
- `src/lib/go-party/_tests/go-party.test.ts` — 17 tests: `partyUrl` URL shape, `PARTY_TAB_PARAM`
  constant, empty/whitespace no-op safety, purity/idempotency, `goToParty` wiring with injected push.
- `src/lib/go-party/_tests/useGoToParty.test.tsx` — 6 tests: hook returns a function, valid slug
  → push called with correct URL, empty/whitespace slug → no-op, successive calls are independent.

**Gate:** 23/23 tests GREEN. tsc clean. biome clean. Pre-existing fragua-snapshot.reviewer.test.ts
failure (FRD-06 untracked reviewer file) is outside this WO's scope and pre-dates this change.
