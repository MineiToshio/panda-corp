/**
 * WO-09-006 — REVIEWER RED test (DR-073): the ledger read leaks real disk state
 * into the achievements page render, breaking the honest-zero XP-bar contract.
 *
 * Defect: WO-09-006 added `readLedger()` to the shared `getGuildState()` seam
 * (src/lib/gamification/guildState.ts:79). The achievements page test mocks every
 * data reader (portfolio/status/events/deriveGuildOutcomes → empty factory) but does
 * NOT mock the ledger read. So on a machine where `factory/gamification-ledger.json`
 * exists with accumulated totals, the MAX(live, ledger) merge floors the "empty
 * factory" outcomes to the ledger's historical maximum — and the XP bar that FRD-09
 * promises is HONEST-ZERO (pctToNext=0 → width 0%) renders a fabricated ~66% fill.
 *
 * This violates:
 *   - FRD-09 honest-zero contract ("the bar is NEVER artificially inflated";
 *     "pctToNext = 0 when xp = 0").
 *   - AC-10-005.3 (achievements hero XP bar honest, no fake fill).
 *   - Test hermeticity (tests must pass in isolation / any order; mock true external
 *     boundaries — the fs is one). The test's verdict currently depends on whether a
 *     gitignored file happens to exist on disk.
 *
 * RED proof: this test FAILS without the fix when the real ledger file exists (the
 * page reads it through the unmocked seam). It PASSES once the achievements page test
 * neutralizes the ledger read (mock `@/lib/gamification/guildState` to return a
 * zero-floor state, OR mock `@/lib/gamification/ledger`'s `readLedger` to zero-totals).
 *
 * THE FIX (production-side, for the engine to patch): make the guild-surface render
 * hermetic — in src/app/achievements/_tests/page.test.tsx (and any test that renders a
 * guild surface), add a mock so the ledger floor is neutralized, e.g.:
 *
 *     vi.mock("@/lib/gamification/ledger", async (importOriginal) => {
 *       const actual = await importOriginal<typeof import("@/lib/gamification/ledger")>();
 *       return { ...actual, readLedger: vi.fn().mockReturnValue({
 *         version: 1, updatedAt: new Date(0).toISOString(),
 *         totals: { workOrdersDone: 0, phasesCompleted: 0, releases: 0 } }) };
 *     });
 *
 * (mocking `readLedger` keeps the real `mergeLedgerOutcomes` MAX semantics under test;
 * mocking the whole `guildState` module is the heavier alternative.)
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Empty-factory mocks — identical posture to page.test.tsx (the foundation FRD-10 test).
vi.mock("@/lib/portfolio/portfolio", () => ({
  readPortfolio: vi.fn().mockReturnValue([]),
}));
vi.mock("@/lib/status/status", () => ({
  readStatus: vi.fn().mockReturnValue({ present: false, malformed: false, status: null }),
}));
vi.mock("@/lib/events/events", () => ({
  readEvents: vi.fn().mockReturnValue({ events: [], lastEventAt: null, byProject: {} }),
}));
vi.mock("@/lib/ideas/ideas", () => ({
  readIdeas: vi.fn().mockReturnValue([]),
}));
vi.mock("@/lib/gamification/gamification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gamification/gamification")>();
  return {
    ...actual,
    deriveGuildOutcomes: vi.fn().mockReturnValue({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
      weeklyStreak: 0,
    }),
  };
});

// THE FIX under test: neutralize the ledger read so the empty-factory render is
// hermetic and the honest-zero contract holds regardless of on-disk ledger state.
// Without this mock (the current state of page.test.tsx), the render reads the real
// factory/gamification-ledger.json and the XP bar shows a fabricated fill.
vi.mock("@/lib/gamification/ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gamification/ledger")>();
  return {
    ...actual,
    readLedger: vi.fn().mockReturnValue({
      version: 1 as const,
      updatedAt: new Date(0).toISOString(),
      totals: { workOrdersDone: 0, phasesCompleted: 0, releases: 0 },
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.resetModules();
});

async function renderPage() {
  const { default: HallPage } = await import("../page");
  const jsx = await HallPage();
  return render(jsx);
}

describe("WO-09-006 ledger must not inflate the honest-zero XP bar (DR-073 RED)", () => {
  it("empty factory → XP bar fill width is 0% (no fabricated ledger floor)", async () => {
    await renderPage();
    const hero = screen.getByTestId("guild-hero");
    const fill = within(hero).getByTestId("xp-bar-fill");
    expect((fill as HTMLElement).style.width).toBe("0%");
  });

  it("empty factory → XP bar aria-valuenow is 0 (honest progressbar)", async () => {
    await renderPage();
    const hero = screen.getByTestId("guild-hero");
    const track = within(hero).getByTestId("xp-bar-track");
    expect(track.getAttribute("role")).toBe("progressbar");
    expect(track.getAttribute("aria-valuenow")).toBe("0");
  });
});
