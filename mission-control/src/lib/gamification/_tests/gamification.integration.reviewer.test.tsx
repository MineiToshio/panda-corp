/**
 * FRD-09 — Gamification · REVIEWER adversarial integration tests (DR-015).
 *
 * Written by the FRD-gate reviewer (a different model from the implementers).
 * These exercise WO-09-001..006 TOGETHER (real integration) at the edges the
 * implementers did NOT cover, anchored in the FRD-09 EARS criteria and the
 * forbidden-pattern list. They are NOT a re-run of the per-WO unit tests.
 *
 * The whole pipeline under test:
 *   real portfolio statuses + event stream
 *     → deriveGuildOutcomes (WO-09-004)
 *     → computeGuildLevel (WO-09-001)  → GuildBar / XpBar (WO-09-004)
 *     → classifyCelebration (WO-09-005) → CelebrationSurface (WO-09-006)
 *   and, in parallel, computeAgentLevel (WO-09-002) + Avatar (WO-09-003).
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { CelebrationSurface } from "@/components/core/CelebrationSurface/CelebrationSurface";
import { XpBar } from "@/components/core/XpBar/XpBar";
import { GuildBar } from "@/components/modules/GuildBar/GuildBar";
import type { Event, EventsSnapshot } from "@/lib/events/events";
import { computeAgentLevel } from "@/lib/gamification/agents";
import {
  classifyCelebration,
  computeGuildLevel,
  deriveGuildOutcomes,
  type GuildOutcomes,
  RANKS,
} from "@/lib/gamification/gamification";
import type { StatusResult } from "@/lib/status/status";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom does not implement matchMedia; CelebrationSurface reads prefers-reduced-motion.
// Provide a default mock (motion enabled) — the existing WO-09-006 suite does the same.
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ---------------------------------------------------------------------------
// Helpers — build the real reader-shaped inputs the layout would feed.
// ---------------------------------------------------------------------------

function statusPresent(partial: { phase?: string; workOrdersDone?: number }): StatusResult {
  return {
    present: true,
    malformed: false,
    // biome-ignore lint/suspicious/noExplicitAny: test fixture mirrors Partial<ProjectStatus>
    status: partial as any,
  };
}

function snapshot(events: Event[]): EventsSnapshot {
  return {
    events,
    lastEventAt: events.at(-1)?.at ?? null,
    byProject: {},
  };
}

function ev(partial: Partial<Event>): Event {
  return { event: "message", at: "2026-06-17T00:00:00Z", ...partial };
}

// ===========================================================================
// 1. The central forbidden pattern, end-to-end: an EMPTY factory must NEVER
//    render a stuck/fake XP bar (FRD-09 "bar artificially stuck near full").
//    Exercised through the REAL render path, not just the pure function.
// ===========================================================================

describe("FRD-09 honesty pipeline — empty factory never shows a fake bar", () => {
  it("absent portfolio + no events → guild bar renders an honest zero, fill width 0%", () => {
    // deriveGuildOutcomes over a totally empty factory (the very first boot).
    const outcomes = deriveGuildOutcomes({ statuses: [], eventsSnapshot: null });
    expect(outcomes.workOrdersDone).toBe(0);
    expect(outcomes.releases).toBe(0);

    render(<GuildBar outcomes={outcomes} />);

    // Level 1, lowest rank, honest.
    expect(screen.getByTestId("guild-bar-level").textContent).toBe("1");
    expect(screen.getByTestId("guild-bar-title").textContent).toBe(RANKS[0]?.title);

    // The fill must be literally 0% width — NOT pinned near full.
    const fill = screen.getByTestId("xp-bar-fill") as HTMLElement;
    expect(fill.style.width).toBe("0%");

    // progressbar aria value is 0, never an inflated number.
    const track = screen.getByTestId("xp-bar-track");
    expect(track.getAttribute("aria-valuenow")).toBe("0");
  });

  it("malformed/absent statuses are skipped (fail-soft) and do not inflate XP", () => {
    const statuses: StatusResult[] = [
      { present: false, malformed: false, status: null },
      { present: true, malformed: true, status: {} },
      statusPresent({}), // present but no phase / no workOrdersDone
    ];
    const outcomes = deriveGuildOutcomes({ statuses, eventsSnapshot: null });
    expect(outcomes).toEqual<GuildOutcomes>({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
      weeklyStreak: 0,
    });
    const guild = computeGuildLevel(outcomes);
    expect(guild.xp).toBe(0);
    expect(guild.pctToNext).toBe(0);
  });
});

// ===========================================================================
// 2. deriveGuildOutcomes ABUSE — negative / NaN / huge work-order counts.
//    The aggregator clamps with Math.max(0, trunc); a poisoned status.yaml
//    must not produce negative XP or NaN that would crash the bar render.
// ===========================================================================

describe("FRD-09 deriveGuildOutcomes — abusive status values", () => {
  it("negative workOrdersDone is floored to 0 (no negative XP)", () => {
    const outcomes = deriveGuildOutcomes({
      statuses: [statusPresent({ workOrdersDone: -999 })],
      eventsSnapshot: null,
    });
    expect(outcomes.workOrdersDone).toBe(0);
    expect(computeGuildLevel(outcomes).xp).toBe(0);
  });

  it("NaN workOrdersDone is rejected (Number.isFinite guard), bar stays renderable", () => {
    const outcomes = deriveGuildOutcomes({
      statuses: [statusPresent({ workOrdersDone: Number.NaN })],
      eventsSnapshot: null,
    });
    expect(outcomes.workOrdersDone).toBe(0);
    const guild = computeGuildLevel(outcomes);
    render(<XpBar {...guild} label={guild.title} nextTitle="x" />);
    // Width must be a finite percentage string, never "NaN%".
    const fill = screen.getByTestId("xp-bar-fill") as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });

  it("fractional workOrdersDone is truncated, not rounded up (honest, no free XP)", () => {
    const outcomes = deriveGuildOutcomes({
      statuses: [statusPresent({ workOrdersDone: 3.9 })],
      eventsSnapshot: null,
    });
    expect(outcomes.workOrdersDone).toBe(3);
  });

  it("a project in 'operation' counts as both a completed phase AND a release", () => {
    const outcomes = deriveGuildOutcomes({
      statuses: [statusPresent({ phase: "operation", workOrdersDone: 0 })],
      eventsSnapshot: null,
    });
    // Documented design: operation ⇒ phasesCompleted +1 and releases +1.
    expect(outcomes.phasesCompleted).toBe(1);
    expect(outcomes.releases).toBe(1);
  });

  it("an unknown/garbage phase string contributes neither a phase nor a release", () => {
    const outcomes = deriveGuildOutcomes({
      statuses: [statusPresent({ phase: "not-a-real-phase" })],
      eventsSnapshot: null,
    });
    expect(outcomes.phasesCompleted).toBe(0);
    expect(outcomes.releases).toBe(0);
  });
});

// ===========================================================================
// 3. The XP bar is NEVER color-alone and NEVER renders > 100% width even when
//    fed an out-of-contract pctToNext (defensive against a buggy caller).
// ===========================================================================

describe("FRD-09 XpBar — defensive against out-of-range progress", () => {
  it("pctToNext > 100 is clamped to 100% width (no overflow)", () => {
    render(<XpBar xp={50} next={100} pctToNext={9999} label="L" nextTitle="N" />);
    const fill = screen.getByTestId("xp-bar-fill") as HTMLElement;
    expect(fill.style.width).toBe("100%");
    expect(screen.getByTestId("xp-bar-track").getAttribute("aria-valuenow")).toBe("100");
  });

  it("negative pctToNext is clamped to 0% (no negative width)", () => {
    render(<XpBar xp={0} next={100} pctToNext={-50} label="L" nextTitle="N" />);
    const fill = screen.getByTestId("xp-bar-fill") as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });

  it("not color-alone: a textual label is always present alongside the accent fill", () => {
    render(<XpBar xp={10} next={100} pctToNext={10} label="Artesano" nextTitle="Oficial" />);
    // Shape + text accompany the accent so state is not conveyed by color only.
    expect(screen.getByTestId("xp-bar-label").textContent).toBe("Artesano");
    expect(screen.getByTestId("xp-bar-fill").getAttribute("data-accent")).toBe("true");
  });
});

// ===========================================================================
// 4. Celebration SCALING, end-to-end through the real surface, with the SAME
//    event stream that drives the guild bar. Verifies the tiers are distinct
//    (never flat) and that activity/failure never celebrate (AC-09-006.1/.2/.4).
// ===========================================================================

describe("FRD-09 celebration surface — scales, never flat, never on activity", () => {
  it("each outcome tier renders a DISTINCT celebration (not a flat one)", () => {
    const cases: Array<[Event, string]> = [
      [ev({ event: "achievement", workOrder: "WO-1", status: "ok" }), "toast"],
      [ev({ event: "achievement", task: "phase:design" }), "phase"],
      [ev({ event: "achievement", task: "release" }), "release"],
      [ev({ event: "achievement", task: "levelup" }), "levelup"],
    ];
    const seenTiers = new Set<string>();
    for (const [event, expectedTier] of cases) {
      render(<CelebrationSurface event={event} />);
      const surface = screen.getByTestId("celebration-surface");
      expect(surface.getAttribute("data-tier")).toBe(expectedTier);
      seenTiers.add(surface.getAttribute("data-tier") ?? "");
      cleanup();
    }
    // Four genuinely different tiers — the celebration is not flat.
    expect(seenTiers.size).toBe(4);
  });

  it("a stream of pure activity events produces NO celebration surface at all", () => {
    const activity: Event[] = [
      ev({ event: "read" }),
      ev({ event: "write" }),
      ev({ event: "message" }),
      ev({ event: "start", task: "phase:design" }), // start, not end → no phase celebration
      ev({ event: "test_fail", workOrder: "WO-1" }),
    ];
    for (const e of activity) {
      const { container } = render(<CelebrationSurface event={e} />);
      expect(container.querySelector('[data-testid="celebration-surface"]')).toBeNull();
      cleanup();
    }
  });

  it("a FAILED work order never celebrates even though it carries a workOrder id", () => {
    const failed = ev({ event: "achievement", workOrder: "WO-7", status: "fail" });
    // The pure classifier agrees with the surface — they must not disagree.
    expect(classifyCelebration(failed)).toBe("none");
    const { container } = render(<CelebrationSurface event={failed} />);
    expect(container.querySelector('[data-testid="celebration-surface"]')).toBeNull();
  });

  it("the celebration carries no countdown / timer / urgency text (forbidden pattern)", () => {
    render(<CelebrationSurface event={ev({ event: "achievement", task: "release" })} />);
    const text = screen.getByTestId("celebration-surface").textContent ?? "";
    expect(text).not.toMatch(/\d+\s*(s|seg|min|h)\b/i); // no "5s", "30 seg", "2 min"
    expect(text.toLowerCase()).not.toMatch(/cuenta atrás|caduca|expira|ahora|rápido/);
  });
});

// ===========================================================================
// 5. Cross-engine integration: the agent XP engine and the guild XP engine
//    read the SAME event stream and must stay mutually consistent — a closed
//    WO that credits the guild must also credit the agent who closed it, and a
//    NON-WO activity event must credit neither.
// ===========================================================================

describe("FRD-09 cross-engine consistency (guild vs agent over one stream)", () => {
  it("a closed WO credits both the guild (via count) and the owning agent — activity credits neither", () => {
    const closedWo = ev({
      event: "achievement",
      agent: "backend-dev",
      workOrder: "WO-09-001",
      status: "ok",
    });
    const navigation = ev({ event: "read", agent: "backend-dev" });

    const stream = snapshot([closedWo, navigation]);

    // Agent side: exactly 1 XP from the closed WO, 0 from the read.
    const agent = computeAgentLevel("backend-dev", stream.events);
    expect(agent.xp).toBe(1);

    // Guild side: greenTestRuns is derived from test_ok only; the achievement WO
    // is counted via status.yaml work_orders_done, not events — so for THIS
    // events-only snapshot the guild greenTestRuns is 0, proving activity is
    // never silently turned into guild XP through the event path.
    const outcomes = deriveGuildOutcomes({ statuses: [], eventsSnapshot: stream });
    expect(outcomes.greenTestRuns).toBe(0);
    expect(computeGuildLevel(outcomes).xp).toBe(0);
  });

  it("an unknown agentId over a populated stream returns the honest zero state (never throws)", () => {
    const stream = snapshot([
      ev({ event: "achievement", agent: "backend-dev", workOrder: "WO-1", status: "ok" }),
    ]);
    const ghost = computeAgentLevel("does-not-exist", stream.events);
    expect(ghost.xp).toBe(0);
    expect(ghost.level).toBe(1);
  });

  it("test_ok events drive guild greenTestRuns; fail/activity events do not", () => {
    const stream = snapshot([
      ev({ event: "test_ok", workOrder: "WO-1" }),
      ev({ event: "test_ok" }),
      ev({ event: "test_fail", workOrder: "WO-2" }),
      ev({ event: "read" }),
    ]);
    const outcomes = deriveGuildOutcomes({ statuses: [], eventsSnapshot: stream });
    expect(outcomes.greenTestRuns).toBe(2); // both test_ok, neither fail nor read
  });
});

// ===========================================================================
// 6. GuildBar nextTitle at the boundary — at the MAX rank there is no higher
//    rank; the bar must not invent a phantom next title nor crash.
// ===========================================================================

describe("FRD-09 GuildBar — max-rank boundary", () => {
  it("at the top rank the bar is full and does not invent a higher rank title", () => {
    // Enough XP to reach the final RANKS entry.
    const outcomes: GuildOutcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 100, // 100 * 200 = 20000 XP >> top threshold
      greenTestRuns: 0,
    };
    const guild = computeGuildLevel(outcomes);
    expect(guild.title).toBe(RANKS.at(-1)?.title);
    expect(guild.pctToNext).toBe(100);

    render(<GuildBar outcomes={outcomes} />);
    expect(screen.getByTestId("guild-bar-title").textContent).toBe(RANKS.at(-1)?.title);
    const fill = screen.getByTestId("xp-bar-fill") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });
});

// ===========================================================================
// 7. Avatar graceful degradation in integration — an unknown agent id (which
//    can legitimately appear in a real event stream) must never break layout.
// ===========================================================================

describe("FRD-09 Avatar — unknown id degrades, never breaks layout", () => {
  it("an unknown agent id still renders an <img> with Spanish alt and does not throw", () => {
    // biome-ignore lint/suspicious/noExplicitAny: deliberately passing an off-contract id
    render(<Avatar agentId={"mystery-agent" as any} />);
    const img = screen.getByTestId("agent-avatar-img") as HTMLImageElement;
    expect(img).toBeDefined();
    expect(img.getAttribute("src")).toBeTruthy(); // falls back to a real sprite
    expect(img.getAttribute("alt")).toContain("mystery-agent"); // Spanish alt "Sprite de …"
  });
});
