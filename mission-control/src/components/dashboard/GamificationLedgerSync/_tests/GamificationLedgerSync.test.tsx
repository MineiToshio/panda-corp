/**
 * WO-09-006 — GamificationLedgerSync component tests (RED phase)
 *
 * Tests that the client component:
 *   - mounts without visible UI (transparent to the user)
 *   - calls snapshotGamificationLedger exactly once on mount (fire-and-forget)
 *   - does not re-call when re-rendered with the same props
 *   - receives liveOutcomes prop and passes it to the server action
 *
 * Traceability: AC-09-006.2 (fire-and-forget snapshot on mount)
 */
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GuildOutcomes } from "@/lib/gamification/gamification";

// ---------------------------------------------------------------------------
// Mock the server action (fire-and-forget, no real I/O in component tests)
// ---------------------------------------------------------------------------

const mockSnapshotGamificationLedger = vi.fn().mockResolvedValue(undefined);

vi.mock("@/app/_actions/snapshotLedger", () => ({
  snapshotGamificationLedger: (...args: unknown[]) => mockSnapshotGamificationLedger(...args),
}));

// ---------------------------------------------------------------------------
// Import component under test (will fail RED until component is created)
// ---------------------------------------------------------------------------

import { GamificationLedgerSync } from "../GamificationLedgerSync";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_OUTCOMES: GuildOutcomes = {
  workOrdersDone: 15,
  phasesCompleted: 3,
  releases: 1,
  greenTestRuns: 50,
  weeklyStreak: 2,
};

const ZERO_OUTCOMES: GuildOutcomes = {
  workOrdersDone: 0,
  phasesCompleted: 0,
  releases: 0,
  greenTestRuns: 0,
  weeklyStreak: 0,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GamificationLedgerSync — mount behavior", () => {
  it("renders nothing visible (transparent to the user)", () => {
    const { container } = render(<GamificationLedgerSync liveOutcomes={SAMPLE_OUTCOMES} />);
    // The component should render null or an empty wrapper with no visible content
    expect(container.textContent).toBe("");
  });

  it("calls snapshotGamificationLedger exactly once on mount (fire-and-forget)", async () => {
    render(<GamificationLedgerSync liveOutcomes={SAMPLE_OUTCOMES} />);
    await waitFor(() => {
      expect(mockSnapshotGamificationLedger).toHaveBeenCalledTimes(1);
    });
  });

  it("passes liveOutcomes to snapshotGamificationLedger", async () => {
    render(<GamificationLedgerSync liveOutcomes={SAMPLE_OUTCOMES} />);
    await waitFor(() => {
      expect(mockSnapshotGamificationLedger).toHaveBeenCalledWith(SAMPLE_OUTCOMES);
    });
  });

  it("calls the action even with zero outcomes (cold start)", async () => {
    render(<GamificationLedgerSync liveOutcomes={ZERO_OUTCOMES} />);
    await waitFor(() => {
      expect(mockSnapshotGamificationLedger).toHaveBeenCalledTimes(1);
    });
    expect(mockSnapshotGamificationLedger).toHaveBeenCalledWith(ZERO_OUTCOMES);
  });

  it("does not re-call on re-render (useEffect fires only once — strict mount)", async () => {
    const { rerender } = render(<GamificationLedgerSync liveOutcomes={SAMPLE_OUTCOMES} />);
    await waitFor(() => {
      expect(mockSnapshotGamificationLedger).toHaveBeenCalledTimes(1);
    });

    // Re-render with same props
    rerender(<GamificationLedgerSync liveOutcomes={SAMPLE_OUTCOMES} />);

    // Still only called once (the effect fires on mount, not on every render)
    expect(mockSnapshotGamificationLedger).toHaveBeenCalledTimes(1);
  });

  it("renders no interactive elements (no buttons, inputs, links)", () => {
    const { container } = render(<GamificationLedgerSync liveOutcomes={SAMPLE_OUTCOMES} />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("does not throw when the server action rejects (fire-and-forget — no crash)", async () => {
    mockSnapshotGamificationLedger.mockRejectedValueOnce(new Error("disk full"));

    // Should NOT throw even if the action rejects
    expect(() => render(<GamificationLedgerSync liveOutcomes={SAMPLE_OUTCOMES} />)).not.toThrow();
    // Wait a tick to let the promise settle
    await new Promise((r) => setTimeout(r, 10));
  });
});
