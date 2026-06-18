/**
 * WO-02-012 — `goToParty` host-navigation + `useGoToParty` hook (CMP-02-go-party, IF-02-goParty)
 *
 * Host-navigation function: switch the host app to Portfolio → selected project → Party tab
 * (FRD-06 / La Fragua) for the given idea's project.
 *
 * Design constraints (AC-02-010.5, blueprint §4b):
 *   - NOT an iframe window.parent bridge — the CampaignPipeline is a native React component.
 *   - NO inner reload of the card detail: the navigation is a host-router push, not a full page load.
 *   - Read-only over the factory: no fs write, no Claude call, no network request.
 *   - Navigation/UI state ONLY: the function sets the host URL and lets the router re-render.
 *   - Unknown / empty slug → safe no-op (no crash, no navigation attempted).
 *
 * Party tab URL convention (FRD-04, TabBar):
 *   The project workspace lives at `/projects/<slug>`.
 *   The Party tab (FRD-06) is selected via the `?tab=party` search param.
 *   So the Party URL for a project is `/projects/<slug>?tab=party`.
 *
 * Usage (in CampaignPipeline, via the host-wired `onEnterForge` prop):
 *   The hook `useGoToParty()` returns a stable callback that the CampaignPipeline
 *   receives as `onEnterForge`. For plain (non-hook) tests, `partyUrl(slug)` returns
 *   the deterministic target URL.
 *
 * Traceability:
 *   CMP-02-go-party → REQ-02-010 (AC-02-010.5)
 *   IF-02-goParty: `goToParty(slug: string): void`
 *   WO-02-012
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The `?tab=` value for the Party tab — mirrors TabId "party" in the workspace TabBar. */
export const PARTY_TAB_PARAM = "party" as const;

/** Route segment for the project workspace. */
const PROJECTS_BASE = "/projects" as const;

// ---------------------------------------------------------------------------
// Pure URL builder — deterministic, no side effects
// ---------------------------------------------------------------------------

/**
 * Build the host URL for a project's Party tab.
 *
 * Returns the relative URL `/projects/<slug>?tab=party` for a valid slug,
 * or an empty string (`""`) for an empty / whitespace-only slug (safe no-op marker).
 * Callers MUST check for a falsy return value before navigating.
 *
 * @param slug - The project's name/slug as used by the workspace router.
 * @returns Relative URL string, or `""` for invalid slugs.
 */
export function partyUrl(slug: string): string {
  const trimmed = slug.trim();
  if (trimmed.length === 0) {
    return "";
  }
  return `${PROJECTS_BASE}/${trimmed}?tab=${PARTY_TAB_PARAM}`;
}

// ---------------------------------------------------------------------------
// Host-navigation action — imperative, router-agnostic
// ---------------------------------------------------------------------------

/**
 * Navigate the host application to the Party tab (FRD-06 / La Fragua) for the given project.
 *
 * This is the `IF-02-goParty` contract:
 *   `goToParty(slug: string): void`
 *
 * - Accepts a `push` function (injected at call site from `useRouter().push`).
 * - For an empty / whitespace-only slug: safe no-op (does NOT call `push`).
 * - No filesystem access, no write, no Claude call — navigation/UI state only.
 *
 * Separation of concerns: the pure URL logic lives in `partyUrl` (testable in isolation);
 * this function wires `partyUrl` to the actual router push (injected for testability).
 *
 * @param slug - The project's slug.
 * @param push - Router push function (from `useRouter().push` in the client component).
 */
export function goToParty(slug: string, push: (url: string) => void): void {
  const url = partyUrl(slug);
  if (url === "") {
    // Unknown / empty slug — safe no-op; do not navigate.
    return;
  }
  push(url);
}

// ---------------------------------------------------------------------------
// React hook — wires goToParty to Next.js useRouter (client-side only)
// ---------------------------------------------------------------------------

import { useRouter } from "next/navigation";

/**
 * React hook: returns a stable callback that navigates to the Party tab
 * (FRD-06 / La Fragua) for the given project slug.
 *
 * Usage in CampaignPipeline (WO-02-010):
 *   ```tsx
 *   "use client";
 *   const handleEnterForge = useGoToParty();
 *   <CampaignPipeline slug={slug} activePhase={phase} onEnterForge={handleEnterForge} />
 *   ```
 *
 * Consuming components MUST be "use client" — `useRouter` is a client-only hook.
 * This module is safe to import in both client and server contexts because
 * Next.js tree-shakes the `useRouter` import on the server (it is never called there).
 *
 * @returns A callback `(slug: string) => void` that calls router.push with the Party URL.
 */
export function useGoToParty(): (slug: string) => void {
  const router = useRouter();
  return (slug: string) => {
    goToParty(slug, router.push);
  };
}
