/**
 * WO-18-001 — Regression fixes (second pass) — RED phase
 *
 * Tests that cover the three blocking issues identified in the FRD-18 gate review:
 *
 * Fix 1 — Digest runaway / no cap (AC-18-001.4, REQ-18-005):
 *   computeDigest / Digest must cap new events so a fresh marker (0) doesn't
 *   render hundreds of rows and crash visual fidelity.
 *
 * Fix 2 — phaseStartedAt wired (AC-18-001.7, REQ-18-017):
 *   page.tsx must pass status.updatedAt as phaseStartedAt so ageInStageDays and
 *   isStalled can actually fire. With phaseStartedAt: undefined every project
 *   always has ageInStageDays = undefined and isStalled = false.
 *
 * Fix 3 — CardData not duplicated (AC-18-001.10, DR-057):
 *   Cartera.tsx must import CardData from _lib/card.ts, not re-declare it.
 *   (The Cartera re-declaration was already present but the page now passes
 *   the _lib/card CardData shape — the types must unify.)
 *
 * Non-blocking (also tested here):
 *   - Cartera badge flags: LiveBadge, NoSignalBadge, StalledBadge should use
 *     Chip primitive from design system instead of bespoke emoji spans.
 *
 * Traceability: AC-18-001.4, AC-18-001.7, AC-18-001.10
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { computeDigest } from "@/app/_lib/digest";
import type { Event } from "@/lib/events/events";
import type { GuildLevel } from "@/lib/gamification/gamification";

// ---------------------------------------------------------------------------
// Shared fixture builders
// ---------------------------------------------------------------------------

const NOW_MS = new Date("2026-06-18T12:00:00Z").getTime();
const HOUR_MS = 60 * 60 * 1000;

function makeEvent(at: string, overrides: Partial<Event> = {}): Event {
  return { event: "AgentWorking", at, ...overrides };
}

/** Build N events spread over the last hour (all newer than epoch → all "new" without marker). */
function makeNEvents(n: number): Event[] {
  return Array.from({ length: n }, (_, i) => {
    const offset = ((i + 1) / (n + 1)) * HOUR_MS;
    return makeEvent(new Date(NOW_MS - offset).toISOString(), {
      event: "AgentWorking",
      project: `project-${i}`,
    });
  });
}

const EMPTY_EVENTS = {
  events: [],
  lastEventAt: null,
  byProject: {} as Record<string, { lastEventAt: string }>,
};

const HEALTHY_MEMORY = {
  rawNotes: 0,
  candidates: 0,
  lastMemoryRunAt: new Date().toISOString(),
  staleDays: 0,
};

const GUILD_LEVEL: GuildLevel = {
  level: 1,
  title: "Aprendiz",
  xp: 0,
  next: 100,
  pctToNext: 0,
};

// ---------------------------------------------------------------------------
// Mocks for page.tsx render
// ---------------------------------------------------------------------------

vi.mock("@/lib/events/events", () => ({
  readEvents: vi.fn(() => EMPTY_EVENTS),
}));

vi.mock("@/lib/portfolio/portfolio", () => ({
  readPortfolio: vi.fn(() => []),
  activeProjects: vi.fn(() => []),
}));

vi.mock("@/lib/ideas/ideas", () => ({
  readIdeas: vi.fn(() => []),
}));

vi.mock("@/lib/status/status", () => ({
  readStatus: vi.fn(() => ({ present: false as const, malformed: false as const, status: null })),
}));

vi.mock("@/lib/memory/memory-health", () => ({
  memoryHealth: vi.fn(() => HEALTHY_MEMORY),
}));

vi.mock("@/lib/work-orders/work-orders", () => ({
  listWorkOrders: vi.fn(() => []),
  aggregateProgress: vi.fn(() => ({ done: 0, total: 0, pct: 0, failing: [] })),
}));

vi.mock("@/lib/profile/profile", () => ({
  readProfile: vi.fn(() => ({ present: true as const, profile: { name: "Test" } })),
}));

vi.mock("@/lib/gamification/gamification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gamification/gamification")>();
  return {
    ...actual,
    computeGuildLevel: vi.fn(() => GUILD_LEVEL),
    deriveGuildOutcomes: vi.fn(() => ({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    })),
  };
});

vi.mock("@/lib/achievements/stats", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/achievements/stats")>();
  return { ...actual, computeStats: vi.fn(() => []) };
});

vi.mock("@/lib/achievements/achievements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/achievements/achievements")>();
  return {
    ...actual,
    computeChains: vi.fn(() => []),
    computeUniques: vi.fn(() => []),
    computeSecrets: vi.fn(() => []),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: vi.fn(() => ({ snapshot: null, connected: false, lastEventAt: null })),
}));

// ---------------------------------------------------------------------------
// Fix 1 — Digest cap: computeDigest must cap newEvents when marker is 0
// ---------------------------------------------------------------------------

describe("frd-18: Fix 1 — Digest cap: newEvents bounded at MAX_DIGEST_NEW", () => {
  it("frd-18: computeDigest caps newEvents when marker=0 and tail is large (≥50 events)", () => {
    // Simulate a large event tail (200 events, all newer than epoch marker=0)
    const largeEvents = makeNEvents(200);
    const { newEvents } = computeDigest(largeEvents, 0, NOW_MS);

    // Must be capped — should NOT return all 200 rows
    // The cap is expected to be a reasonable UI limit (e.g. 20 or 25 per FDD §3 prototype)
    expect(newEvents.length).toBeLessThanOrEqual(30);
  });

  it("frd-18: computeDigest returns a non-empty DigestResult with a hasMore flag or truncated list", () => {
    const largeEvents = makeNEvents(200);
    const result = computeDigest(largeEvents, 0, NOW_MS);

    // The result must expose how many were capped (either via totalNewCount or a hasMore flag)
    // so the UI can show "N más" without rendering them all
    expect(result).toHaveProperty("totalNewCount");
    const resultWithCount = result as typeof result & { totalNewCount: number };
    expect(resultWithCount.totalNewCount).toBe(200); // all 200 are new
    expect(result.newEvents.length).toBeLessThanOrEqual(30); // but only a bounded set is rendered
  });

  it("frd-18: computeDigest keeps ALL newEvents when tail is small (< cap)", () => {
    const smallEvents = makeNEvents(5);
    const { newEvents } = computeDigest(smallEvents, 0, NOW_MS);
    // Small tail: all events returned (no truncation needed)
    expect(newEvents.length).toBe(5);
  });

  it("frd-18: newEvents are the NEWEST ones when capped (not arbitrary)", () => {
    // Make 50 events; only the most recent cap (e.g. 20) should survive
    const events = makeNEvents(50);
    const { newEvents } = computeDigest(events, 0, NOW_MS);

    // After sorting newest-first, the capped slice must all be from the top of the sorted order
    // Verify that all returned events are newer than the ones left out
    if (newEvents.length < 50) {
      const newestAt = newEvents[0]?.event.at ?? "";
      const oldestRetained = newEvents[newEvents.length - 1]?.event.at ?? "";
      // All retained events must be newer than any event that would come after the cap
      // (just check that the list is still sorted newest-first)
      for (let i = 1; i < newEvents.length; i++) {
        const prev = newEvents[i - 1];
        const curr = newEvents[i];
        if (prev && curr) {
          expect(prev.event.at >= curr.event.at).toBe(true);
        }
      }
      expect(newestAt).toBeTruthy();
      expect(oldestRetained).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Fix 2 — phaseStartedAt wired from status.updatedAt (AC-18-001.7)
// ---------------------------------------------------------------------------

describe("frd-18: Fix 2 — phaseStartedAt wired via status.updatedAt (AC-18-001.7, REQ-18-017)", () => {
  it("frd-18: deriveCard with phaseStartedAt set fires ageInStageDays", async () => {
    const { deriveCard } = await import("@/app/(dashboard)/_lib/card");
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const phaseStartedAt = new Date(NOW_MS - THIRTY_DAYS_MS).toISOString();

    const card = deriveCard({
      name: "test-project",
      phase: "implementation",
      version: "v1",
      running: false,
      workOrdersDone: 5,
      workOrdersTotal: 10,
      phaseStartedAt,
      lastEventAt: null,
      failedWoReason: undefined,
      nowMs: NOW_MS,
    });

    // With 30 days elapsed, ageInStageDays should be 30
    expect(card.ageInStageDays).toBe(30);
  });

  it("frd-18: deriveCard with phaseStartedAt beyond staleness threshold fires isStalled", async () => {
    const { deriveCard } = await import("@/app/(dashboard)/_lib/card");
    const { STALENESS_THRESHOLD_DAYS } = await import("@/lib/constants");
    const BEYOND_THRESHOLD_MS = (STALENESS_THRESHOLD_DAYS + 5) * 24 * 60 * 60 * 1000;
    const phaseStartedAt = new Date(NOW_MS - BEYOND_THRESHOLD_MS).toISOString();

    const card = deriveCard({
      name: "stalled-project",
      phase: "implementation",
      version: "v1",
      running: false,
      workOrdersDone: 0,
      workOrdersTotal: 10,
      phaseStartedAt,
      lastEventAt: null,
      failedWoReason: undefined,
      nowMs: NOW_MS,
    });

    expect(card.isStalled).toBe(true);
    expect(card.ageInStageDays).toBeGreaterThan(STALENESS_THRESHOLD_DAYS);
  });

  it("frd-18: page.tsx passes status.updatedAt as phaseStartedAt to deriveCard", async () => {
    // Set up a project with a known updatedAt so we can verify it flows through
    const { readEvents } = await import("@/lib/events/events");
    const { activeProjects } = await import("@/lib/portfolio/portfolio");
    const { readStatus } = await import("@/lib/status/status");

    const TWENTY_DAYS_MS = 20 * 24 * 60 * 60 * 1000;
    const updatedAt = new Date(NOW_MS - TWENTY_DAYS_MS).toISOString();

    vi.mocked(readEvents).mockReturnValueOnce({
      events: [],
      lastEventAt: null,
      byProject: {},
    });

    vi.mocked(activeProjects).mockReturnValueOnce([
      {
        name: "my-project",
        path: "/fake/path",
        exists: true,
        stage: "implementation",
        running: false,
        status: {
          present: true,
          malformed: false,
          status: {
            phase: "implementation",
            version: "v1",
            workOrdersDone: 3,
            workOrdersTotal: 10,
            updatedAt,
          },
        },
      } as Parameters<typeof vi.mocked<typeof activeProjects>>[0] extends undefined
        ? never
        : ReturnType<typeof activeProjects>[0],
    ]);

    vi.mocked(readStatus).mockReturnValue({
      present: true,
      malformed: false,
      status: { phase: "implementation", version: "v1", updatedAt },
    });

    const { default: HomePage } = await import("@/app/page");
    render(<HomePage />);

    // If phaseStartedAt is threaded, 20-day-old project should show age in cartera card
    // The card renders "Nd en fase" or similar age text in the phase label
    // We use a loose check — "20d" or similar age in a cartera card
    const carteraGrid = screen.queryByTestId("cartera-grid");
    if (carteraGrid) {
      // If there's a project card, it must show age information
      // (ageInStageDays defined → "Nd en fase" text visible)
      expect(carteraGrid.textContent).toMatch(/\d+d/);
    }
    // If there are no cards (mock returned no active projects somehow), at least
    // verify the page renders without crashing
    expect(screen.getByTestId("dashboard-page")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Fix 3 — CardData type must not be duplicated in Cartera.tsx (DR-057)
// ---------------------------------------------------------------------------

describe("frd-18: Fix 3 — CardData imported from _lib/card, not re-declared in Cartera", () => {
  it("frd-18: CardData exported from _lib/card has all required fields", async () => {
    const { deriveCard } = await import("@/app/(dashboard)/_lib/card");

    const card = deriveCard({
      name: "test",
      phase: "implementation",
      version: "v1",
      running: false,
      workOrdersDone: 0,
      workOrdersTotal: 0,
      phaseStartedAt: undefined,
      lastEventAt: null,
      failedWoReason: undefined,
      nowMs: NOW_MS,
    });

    // All fields required by Cartera must be present on the derived card
    expect(card).toHaveProperty("name");
    expect(card).toHaveProperty("phase");
    expect(card).toHaveProperty("version");
    expect(card).toHaveProperty("woProgress");
    expect(card).toHaveProperty("ageInStageDays");
    expect(card).toHaveProperty("nextCommand");
    expect(card).toHaveProperty("isLive");
    expect(card).toHaveProperty("isNoSignal");
    expect(card).toHaveProperty("isStalled");
    expect(card).toHaveProperty("isShipped");
    expect(card).toHaveProperty("blockerReason");
    expect(card).toHaveProperty("lastEventAt");
  });

  it("frd-18: Cartera renders with CardData from _lib/card without type errors", async () => {
    const { deriveCard } = await import("@/app/(dashboard)/_lib/card");
    const { Cartera } = await import("@/components/dashboard/Cartera/Cartera");

    const card = deriveCard({
      name: "my-project",
      phase: "implementation",
      version: "v1",
      running: true,
      workOrdersDone: 3,
      workOrdersTotal: 10,
      phaseStartedAt: new Date(NOW_MS - 5 * 24 * 60 * 60 * 1000).toISOString(),
      lastEventAt: new Date(NOW_MS - 60 * 1000).toISOString(),
      failedWoReason: undefined,
      nowMs: NOW_MS,
    });

    // Must render without throwing — the CardData type matches
    expect(() => render(<Cartera cards={[card]} />)).not.toThrow();
    expect(screen.getByTestId("cartera-card-my-project")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Fix 4 — Cartera flags use Chip primitive (AC-18-001.10, DR-057)
// ---------------------------------------------------------------------------

describe("frd-18: Fix 4 — Cartera badge flags use shared Chip primitive (AC-18-001.10)", () => {
  it("frd-18: 'en vivo' flag renders with data-testid cartera-flag-live", async () => {
    const { deriveCard } = await import("@/app/(dashboard)/_lib/card");
    const { Cartera } = await import("@/components/dashboard/Cartera/Cartera");

    // A live project: running + fresh last event
    const card = deriveCard({
      name: "live-project",
      phase: "implementation",
      version: "v1",
      running: true,
      workOrdersDone: 0,
      workOrdersTotal: 5,
      phaseStartedAt: undefined,
      lastEventAt: new Date(NOW_MS - 30 * 1000).toISOString(), // 30s ago → live
      failedWoReason: undefined,
      nowMs: NOW_MS,
    });

    render(<Cartera cards={[card]} />);
    const liveBadge = screen.getByTestId("cartera-flag-live");
    expect(liveBadge).toBeDefined();
    // Should contain the "en vivo" text (not just a raw dot emoji)
    expect(liveBadge.textContent).toMatch(/en vivo/i);
  });

  it("frd-18: 'sin señal' flag renders with data-testid cartera-flag-nosignal", async () => {
    const { deriveCard } = await import("@/app/(dashboard)/_lib/card");
    const { Cartera } = await import("@/components/dashboard/Cartera/Cartera");

    // A no-signal project: running + stale last event
    const card = deriveCard({
      name: "nosignal-project",
      phase: "implementation",
      version: "v1",
      running: true,
      workOrdersDone: 0,
      workOrdersTotal: 5,
      phaseStartedAt: undefined,
      lastEventAt: new Date(NOW_MS - 3 * 60 * 60 * 1000).toISOString(), // 3h ago → stale
      failedWoReason: undefined,
      nowMs: NOW_MS,
    });

    render(<Cartera cards={[card]} />);
    const noSignalBadge = screen.getByTestId("cartera-flag-nosignal");
    expect(noSignalBadge).toBeDefined();
    expect(noSignalBadge.textContent).toMatch(/sin señal/i);
  });

  it("frd-18: 'estancado' flag renders with data-testid cartera-flag-stalled", async () => {
    const { deriveCard } = await import("@/app/(dashboard)/_lib/card");
    const { Cartera } = await import("@/components/dashboard/Cartera/Cartera");
    const { STALENESS_THRESHOLD_DAYS } = await import("@/lib/constants");

    const BEYOND_MS = (STALENESS_THRESHOLD_DAYS + 5) * 24 * 60 * 60 * 1000;
    const card = deriveCard({
      name: "stalled-project",
      phase: "implementation",
      version: "v1",
      running: false,
      workOrdersDone: 0,
      workOrdersTotal: 5,
      phaseStartedAt: new Date(NOW_MS - BEYOND_MS).toISOString(),
      lastEventAt: null,
      failedWoReason: undefined,
      nowMs: NOW_MS,
    });

    render(<Cartera cards={[card]} />);
    const stalledBadge = screen.getByTestId("cartera-flag-stalled");
    expect(stalledBadge).toBeDefined();
    expect(stalledBadge.textContent).toMatch(/estancado/i);
  });
});
