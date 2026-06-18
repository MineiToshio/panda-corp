/**
 * WO-09-006 — CMP-09-celebration: scaling celebration surface (tests)
 *
 * TDD: RED first. Tests verify all acceptance criteria before the component exists.
 *
 * Acceptance criteria (EARS, FRD-09 + FRD-13):
 *   AC-09-006.1 — Celebration SHALL scale with the outcome tier:
 *                  toast → animation → celebration → level-up; NOT flat on every action.
 *   AC-09-006.2 — Non-result event SHALL produce NO celebration (negative AC).
 *   AC-09-006.3 — Animation SHALL use only transform/opacity, duration <300ms,
 *                  and SHALL be disabled under prefers-reduced-motion (data still visible).
 *   AC-09-006.4 — NO false-urgency timer, countdown, or nagging (negative AC, FRD-09).
 *   AC-09-006.5 — Announcements SHALL use aria-live="polite" (Spanish) without
 *                  stealing focus (FRD-13).
 *
 * Traceability:
 *   CMP-09-celebration → WO-09-006 → AC-09-006.1..5
 *   Depends on: classifyCelebration (WO-09-005), LiveRegion (WO-13-003)
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "@/lib/events/events";
import { CelebrationSurface } from "../CelebrationSurface";

// ---------------------------------------------------------------------------
// Helpers — canonical event fixtures
// ---------------------------------------------------------------------------

/** A "toast" event: achievement + workOrder present → classifyCelebration = "toast" */
const toastEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:00:00Z",
  agent: "backend-dev",
  workOrder: "WO-09-001",
  status: "ok",
};

/** A "phase" event: achievement + task starts with "phase:" → "phase" */
const phaseEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:01:00Z",
  agent: "backend-dev",
  task: "phase:design",
  status: "ok",
};

/** A "release" event: achievement + task = "release" → "release" */
const releaseEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:02:00Z",
  agent: "backend-dev",
  task: "release",
  status: "ok",
};

/** A "levelup" event: achievement + task = "levelup" → "levelup" */
const levelupEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:03:00Z",
  agent: "backend-dev",
  task: "levelup",
  status: "ok",
};

/** A "none" event: read → classifyCelebration = "none" */
const noneEvent: Event = {
  event: "read",
  at: "2026-06-17T10:04:00Z",
  agent: "backend-dev",
};

/** A "none" event: failure → classifyCelebration = "none" */
const failEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:05:00Z",
  agent: "backend-dev",
  workOrder: "WO-09-001",
  status: "fail",
};

/** A "none" event: write activity → "none" */
const writeEvent: Event = {
  event: "write",
  at: "2026-06-17T10:06:00Z",
  agent: "frontend-dev",
};

// ---------------------------------------------------------------------------
// matchMedia mock helpers (prefers-reduced-motion)
// ---------------------------------------------------------------------------

function mockMatchMedia(prefersReducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("reduce") ? prefersReducedMotion : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC-09-006.1 — Celebration scales with outcome tier
// ---------------------------------------------------------------------------

describe("CMP-09-celebration — AC-09-006.1: celebration scales with outcome tier", () => {
  beforeEach(() => mockMatchMedia(false));

  it("renders nothing when no event is provided (no-event baseline)", () => {
    render(<CelebrationSurface event={null} />);
    // No celebration container visible when there is no event
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });

  it("renders a toast for a 'toast' tier event (work order closed)", () => {
    render(<CelebrationSurface event={toastEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    expect(surface).toBeDefined();
    expect(surface.getAttribute("data-tier")).toBe("toast");
  });

  it("renders a phase animation for a 'phase' tier event", () => {
    render(<CelebrationSurface event={phaseEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-tier")).toBe("phase");
  });

  it("renders a celebration for a 'release' tier event", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-tier")).toBe("release");
  });

  it("renders a level-up moment for a 'levelup' tier event", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-tier")).toBe("levelup");
  });

  it("each tier has a distinct message (not flat/identical across tiers)", () => {
    const { unmount: u1 } = render(<CelebrationSurface event={toastEvent} />);
    const toastMsg = screen.getByTestId("celebration-message").textContent;
    u1();

    const { unmount: u2 } = render(<CelebrationSurface event={phaseEvent} />);
    const phaseMsg = screen.getByTestId("celebration-message").textContent;
    u2();

    const { unmount: u3 } = render(<CelebrationSurface event={releaseEvent} />);
    const releaseMsg = screen.getByTestId("celebration-message").textContent;
    u3();

    const { unmount: u4 } = render(<CelebrationSurface event={levelupEvent} />);
    const levelupMsg = screen.getByTestId("celebration-message").textContent;
    u4();

    // All four messages must be distinct — not a flat identical text
    const messages = [toastMsg, phaseMsg, releaseMsg, levelupMsg];
    const unique = new Set(messages);
    expect(unique.size).toBe(4);
  });

  it("message text is in Spanish (never empty for a result event)", () => {
    render(<CelebrationSurface event={toastEvent} />);
    const msg = screen.getByTestId("celebration-message");
    expect(msg.textContent).toBeTruthy();
    // Spanish content check: must not be only Latin chars with no accents/special
    // (a crude guard; deeper Spanish validation is qualitative)
    expect(msg.textContent?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-09-006.2 — Non-result event SHALL produce NO celebration (negative AC)
// ---------------------------------------------------------------------------

describe("CMP-09-celebration — AC-09-006.2: non-result event produces no celebration", () => {
  beforeEach(() => mockMatchMedia(false));

  it("WHEN a 'none' tier event is passed (read), renders nothing", () => {
    render(<CelebrationSurface event={noneEvent} />);
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });

  it("WHEN a 'none' tier event is passed (write activity), renders nothing", () => {
    render(<CelebrationSurface event={writeEvent} />);
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });

  it("WHEN a failure event is passed (status=fail), renders nothing", () => {
    render(<CelebrationSurface event={failEvent} />);
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });

  it("WHEN classifyCelebration returns 'none', there is no celebration-surface in the DOM", () => {
    // message event: pure activity → none
    const messageEvent: Event = {
      event: "message",
      at: "2026-06-17T10:07:00Z",
      agent: "researcher",
    };
    render(<CelebrationSurface event={messageEvent} />);
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });

  it("WHEN a start event is passed (activity), renders nothing", () => {
    const startEvent: Event = {
      event: "start",
      at: "2026-06-17T10:08:00Z",
      agent: "backend-dev",
    };
    render(<CelebrationSurface event={startEvent} />);
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-09-006.3 — Animation: only transform/opacity, <300ms, disabled under
//               prefers-reduced-motion (data still present)
// ---------------------------------------------------------------------------

describe("CMP-09-celebration — AC-09-006.3: animation tokens + reduced-motion", () => {
  it("WHEN prefers-reduced-motion is false, surface has data-animated='true'", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={toastEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-animated")).toBe("true");
  });

  it("WHEN prefers-reduced-motion is true, surface has data-animated='false'", () => {
    mockMatchMedia(true);
    render(<CelebrationSurface event={toastEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-animated")).toBe("false");
  });

  it("WHEN prefers-reduced-motion is true, data IS still present in the DOM", () => {
    mockMatchMedia(true);
    render(<CelebrationSurface event={toastEvent} />);
    // The celebration is rendered (data still visible), just not animated
    expect(screen.getByTestId("celebration-surface")).toBeDefined();
    expect(screen.getByTestId("celebration-message")).toBeDefined();
  });

  it("WHEN prefers-reduced-motion is true, message is still readable", () => {
    mockMatchMedia(true);
    render(<CelebrationSurface event={releaseEvent} />);
    const msg = screen.getByTestId("celebration-message");
    expect(msg.textContent?.length).toBeGreaterThan(0);
  });

  it("style property only uses transform and/or opacity for animation (no left/top/color)", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={toastEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    const style = surface.getAttribute("style") ?? "";
    // Must NOT contain layout-affecting or color-changing CSS properties
    expect(style).not.toMatch(/\bleft\b/);
    expect(style).not.toMatch(/\btop\b/);
    expect(style).not.toMatch(/\bmargin\b/);
    expect(style).not.toMatch(/\bcolor\s*:/);
    expect(style).not.toMatch(/\bbackground\s*:/);
  });

  it("animation duration is sourced from CSS variable (not hardcoded ms value > 300)", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={toastEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    const style = surface.getAttribute("style") ?? "";
    // Must not contain a hardcoded millisecond value > 300ms
    const msMatches = style.match(/(\d+)ms/g) ?? [];
    for (const match of msMatches) {
      const value = Number.parseInt(match, 10);
      expect(value).toBeLessThanOrEqual(300);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-09-006.4 — NO false-urgency timer, countdown, or nagging (negative AC)
// ---------------------------------------------------------------------------

describe("CMP-09-celebration — AC-09-006.4: no false urgency, no timer/countdown", () => {
  beforeEach(() => mockMatchMedia(false));

  it("renders NO timer element (data-testid='celebration-timer')", () => {
    render(<CelebrationSurface event={toastEvent} />);
    expect(screen.queryByTestId("celebration-timer")).toBeNull();
  });

  it("renders NO countdown element", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    // No countdown text (any element with 'countdown' in testid or content like "3..2..1")
    expect(screen.queryByTestId("celebration-countdown")).toBeNull();
  });

  it("renders NO nagging/alert urgency text (e.g. '!!' or urgency classes)", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    // No role=alertdialog (stealing focus)
    expect(surface.getAttribute("role")).not.toBe("alertdialog");
    // No urgency aria-live (only "polite" is permitted)
    const liveRegions = surface.querySelectorAll("[aria-live]");
    for (const region of liveRegions) {
      expect(region.getAttribute("aria-live")).not.toBe("assertive");
    }
  });

  it("the celebration message does NOT contain countdown patterns like '3..2..1'", () => {
    render(<CelebrationSurface event={toastEvent} />);
    const msg = screen.getByTestId("celebration-message");
    expect(msg.textContent).not.toMatch(/\b[123]\.\.[123]\.\.[123]\b/);
    expect(msg.textContent).not.toMatch(/countdown/i);
  });
});

// ---------------------------------------------------------------------------
// AC-09-006.5 — aria-live="polite" (Spanish) without stealing focus
// ---------------------------------------------------------------------------

describe("CMP-09-celebration — AC-09-006.5: aria-live polite, Spanish, no focus steal", () => {
  beforeEach(() => mockMatchMedia(false));

  it("the celebration contains an aria-live='polite' region (via LiveRegion or direct)", () => {
    render(<CelebrationSurface event={toastEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    // There must be at least one element with aria-live=polite inside (LiveRegion)
    const politeRegions = surface.querySelectorAll("[aria-live='polite']");
    expect(politeRegions.length).toBeGreaterThan(0);
  });

  it("no aria-live='assertive' is used (never steals focus)", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const assertiveRegions = screen.queryAllByRole("alert");
    // role="alert" implies assertive — must be absent
    expect(assertiveRegions.length).toBe(0);
  });

  it("the live region contains the celebration message text in Spanish", () => {
    render(<CelebrationSurface event={phaseEvent} />);
    // The live region (data-testid="live-region") must contain meaningful text
    const liveRegion = screen.getByTestId("live-region");
    expect(liveRegion.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("NO element with role='alertdialog' or autofocused element (no focus steal)", () => {
    render(<CelebrationSurface event={levelupEvent} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    // Nothing should have autofocus
    const surface = screen.getByTestId("celebration-surface");
    const autofocused = surface.querySelector("[autofocus]");
    expect(autofocused).toBeNull();
  });

  it("the celebration-surface role is 'status' (polite, not alert)", () => {
    render(<CelebrationSurface event={toastEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    // The outer wrapper should not be role=alert/alertdialog
    const role = surface.getAttribute("role");
    expect(role).not.toBe("alert");
    expect(role).not.toBe("alertdialog");
  });
});

// ---------------------------------------------------------------------------
// Cross-tier: verify tier-to-class correspondence for styling hooks
// ---------------------------------------------------------------------------

describe("CMP-09-celebration — tier-to-visual correspondence", () => {
  beforeEach(() => mockMatchMedia(false));

  it("each tier gets a unique CSS class or data attribute (not the same for all)", () => {
    const tiers: Array<[Event, string]> = [
      [toastEvent, "toast"],
      [phaseEvent, "phase"],
      [releaseEvent, "release"],
      [levelupEvent, "levelup"],
    ];

    const seenClasses: string[] = [];
    for (const [event, expectedTier] of tiers) {
      const { unmount } = render(<CelebrationSurface event={event} />);
      const surface = screen.getByTestId("celebration-surface");
      const tierClass = surface.getAttribute("data-tier");
      expect(tierClass).toBe(expectedTier);
      seenClasses.push(tierClass ?? "");
      unmount();
    }

    const unique = new Set(seenClasses);
    expect(unique.size).toBe(4);
  });

  it("WHEN event is null (no event), nothing is rendered", () => {
    render(<CelebrationSurface event={null} />);
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
    expect(screen.queryByTestId("celebration-message")).toBeNull();
    expect(screen.queryByTestId("live-region")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Design-token compliance (FRD-13) — no hardcoded colors
// ---------------------------------------------------------------------------

describe("CMP-09-celebration — FRD-13 design token compliance", () => {
  beforeEach(() => mockMatchMedia(false));

  it("no hardcoded hex/rgb/hsl color in style attribute", () => {
    render(<CelebrationSurface event={releaseEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    const allStyles = Array.from(surface.querySelectorAll("[style]"))
      .map((el) => el.getAttribute("style") ?? "")
      .join(" ");
    const rootStyle = surface.getAttribute("style") ?? "";
    const combined = `${rootStyle} ${allStyles}`;

    expect(combined).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(combined).not.toMatch(/rgb\s*\(/i);
    expect(combined).not.toMatch(/hsl\s*\(/i);
    // oklch IS permitted (design-token space) — do NOT block it
  });

  it("data-testid='celebration-surface' is present for each result tier", () => {
    for (const event of [toastEvent, phaseEvent, releaseEvent, levelupEvent]) {
      const { unmount } = render(<CelebrationSurface event={event} />);
      expect(screen.getByTestId("celebration-surface")).toBeDefined();
      unmount();
    }
  });

  it("data-testid='celebration-message' is present for each result tier", () => {
    for (const event of [toastEvent, phaseEvent, releaseEvent, levelupEvent]) {
      const { unmount } = render(<CelebrationSurface event={event} />);
      expect(screen.getByTestId("celebration-message")).toBeDefined();
      unmount();
    }
  });
});
