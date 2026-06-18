/**
 * WO-02-012 — goToParty host-navigation (CMP-02-go-party, IF-02-goParty)
 *
 * Tests for AC-02-010.5:
 *   WHEN the owner activates the Construcción (build) phase's "Entrar a La Fragua" action,
 *   THE system SHALL navigate the host app to Portfolio → that project → the Party tab
 *   (FRD-06 / La Fragua) for that project, WITHOUT an inner iframe reload of the card detail.
 *
 * Acceptance criteria verified here:
 *   AC-02-010.5 — calling goToParty(slug) produces a navigation to /projects/<slug>?tab=party
 *   DoD 1  — calling with a slug sets the host to Portfolio → project → Party tab (assert URL/route)
 *   DoD 2  — unknown/empty slug → safe no-op (no crash, no navigation)
 *   DoD 3  — read-only: no fs, no write, no Claude call (pure navigation/UI state only)
 *
 * Traceability:
 *   CMP-02-go-party → REQ-02-010 (AC-02-010.5)
 *   IF-02-goParty: `goToParty(slug: string): void`
 *   WO-02-012
 */

import { describe, expect, it, vi } from "vitest";
import { goToParty, PARTY_TAB_PARAM, partyUrl } from "../go-party";

// ---------------------------------------------------------------------------
// 1. partyUrl — pure URL builder (deterministic, no side effects)
// ---------------------------------------------------------------------------

describe("partyUrl — pure URL builder for the Party tab route", () => {
  it("returns /projects/<slug>?tab=party for a standard slug", () => {
    expect(partyUrl("mission-control")).toBe("/projects/mission-control?tab=party");
  });

  it("returns /projects/<slug>?tab=party for any non-empty slug", () => {
    expect(partyUrl("my-project")).toBe("/projects/my-project?tab=party");
    expect(partyUrl("awesome-app-v2")).toBe("/projects/awesome-app-v2?tab=party");
  });

  it("includes the tab=party search param (FRD-04 / TabBar convention)", () => {
    const url = partyUrl("some-slug");
    expect(url).toContain("tab=party");
    expect(url).toContain("/projects/some-slug");
  });

  it("is a relative URL (no protocol/domain — host-internal navigation)", () => {
    const url = partyUrl("my-app");
    expect(url.startsWith("/")).toBe(true);
    expect(url).not.toContain("http");
    expect(url).not.toContain("://");
  });

  it("does not include iframe, window.parent or any bridge mechanism", () => {
    const url = partyUrl("slug");
    expect(url).not.toContain("iframe");
    expect(url).not.toContain("parent");
    expect(url).not.toContain("postMessage");
  });
});

// ---------------------------------------------------------------------------
// 2. PARTY_TAB_PARAM constant — FRD-04 TabBar convention
// ---------------------------------------------------------------------------

describe("PARTY_TAB_PARAM constant", () => {
  it("equals 'party' (the TabId used in the project workspace TabBar)", () => {
    expect(PARTY_TAB_PARAM).toBe("party");
  });
});

// ---------------------------------------------------------------------------
// 3. Unknown / empty slug — safe no-op guard
// ---------------------------------------------------------------------------

describe("partyUrl — unknown / empty slug safety", () => {
  it("returns an empty string for an empty slug (safe no-op marker)", () => {
    // An empty slug must NOT produce a navigable URL; callers check for falsy before navigating.
    expect(partyUrl("")).toBe("");
  });

  it("does not throw for any string input", () => {
    expect(() => partyUrl("")).not.toThrow();
    expect(() => partyUrl("valid-slug")).not.toThrow();
    expect(() => partyUrl("  ")).not.toThrow();
  });

  it("returns empty string for whitespace-only slug (safe no-op marker)", () => {
    // Whitespace-only slugs are not valid project names; treat as empty.
    expect(partyUrl("  ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 4. Purity — no filesystem, no network, no writes, no side effects
// ---------------------------------------------------------------------------

describe("partyUrl — purity / no side effects", () => {
  it("is idempotent: same slug always returns the same URL", () => {
    const url1 = partyUrl("stable-slug");
    const url2 = partyUrl("stable-slug");
    expect(url1).toBe(url2);
  });

  it("does not mutate the input slug string", () => {
    const slug = "my-project";
    const original = slug;
    partyUrl(slug);
    expect(slug).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// 5. goToParty — wired navigation action (IF-02-goParty contract)
// ---------------------------------------------------------------------------

describe("goToParty — wired host-navigation action (AC-02-010.5)", () => {
  it("calls push with /projects/<slug>?tab=party for a valid slug", () => {
    const push = vi.fn();
    goToParty("mission-control", push);
    expect(push).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/projects/mission-control?tab=party");
  });

  it("does NOT call push for an empty slug (safe no-op)", () => {
    const push = vi.fn();
    goToParty("", push);
    expect(push).not.toHaveBeenCalled();
  });

  it("does NOT call push for a whitespace-only slug (safe no-op)", () => {
    const push = vi.fn();
    goToParty("   ", push);
    expect(push).not.toHaveBeenCalled();
  });

  it("does not throw for any slug (never crashes the card detail)", () => {
    const push = vi.fn();
    expect(() => goToParty("", push)).not.toThrow();
    expect(() => goToParty("valid", push)).not.toThrow();
  });

  it("each call is independent — does not retain state between calls", () => {
    const push = vi.fn();
    goToParty("project-a", push);
    goToParty("project-b", push);
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenNthCalledWith(1, "/projects/project-a?tab=party");
    expect(push).toHaveBeenNthCalledWith(2, "/projects/project-b?tab=party");
  });

  it("navigates WITHOUT an inner reload — push is used, not window.location.href assign", () => {
    // The push function is the router's push (client-side navigation).
    // We assert it is called (not window.location which causes full reload).
    const push = vi.fn();
    goToParty("my-project", push);
    // push was called — SPA navigation, no full reload.
    expect(push).toHaveBeenCalledWith("/projects/my-project?tab=party");
  });
});
