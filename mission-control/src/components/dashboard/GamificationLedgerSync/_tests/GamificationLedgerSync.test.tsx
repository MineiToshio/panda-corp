/**
 * WO-09-006 — GamificationLedgerSync component tests (RED phase)
 *
 * Tests that the client component:
 *   - mounts without visible UI (transparent to the user)
 *   - calls snapshotGamificationLedger exactly once on mount (fire-and-forget)
 *   - does not re-call when re-rendered with the same props
 *   - passes no client aggregate across the server-action trust boundary
 *
 * Traceability: AC-09-006.2 (fire-and-forget snapshot on mount)
 */
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GamificationLedgerSync — mount behavior", () => {
  it("renders nothing visible (transparent to the user)", () => {
    const { container } = render(<GamificationLedgerSync />);
    // The component should render null or an empty wrapper with no visible content
    expect(container.textContent).toBe("");
  });

  it("calls snapshotGamificationLedger exactly once on mount (fire-and-forget)", async () => {
    render(<GamificationLedgerSync />);
    await waitFor(() => {
      expect(mockSnapshotGamificationLedger).toHaveBeenCalledTimes(1);
    });
  });

  it("does not pass client aggregates across the server trust boundary", async () => {
    render(<GamificationLedgerSync />);
    await waitFor(() => {
      expect(mockSnapshotGamificationLedger).toHaveBeenCalledWith();
    });
  });

  it("calls the action on a cold start", async () => {
    render(<GamificationLedgerSync />);
    await waitFor(() => {
      expect(mockSnapshotGamificationLedger).toHaveBeenCalledTimes(1);
    });
    expect(mockSnapshotGamificationLedger).toHaveBeenCalledWith();
  });

  it("does not re-call on re-render (useEffect fires only once — strict mount)", async () => {
    const { rerender } = render(<GamificationLedgerSync />);
    await waitFor(() => {
      expect(mockSnapshotGamificationLedger).toHaveBeenCalledTimes(1);
    });

    rerender(<GamificationLedgerSync />);

    // Still only called once (the effect fires on mount, not on every render)
    expect(mockSnapshotGamificationLedger).toHaveBeenCalledTimes(1);
  });

  it("renders no interactive elements (no buttons, inputs, links)", () => {
    const { container } = render(<GamificationLedgerSync />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("does not throw when the server action rejects (fire-and-forget — no crash)", async () => {
    mockSnapshotGamificationLedger.mockRejectedValueOnce(new Error("disk full"));

    // Should NOT throw even if the action rejects
    expect(() => render(<GamificationLedgerSync />)).not.toThrow();
    // Wait a tick to let the promise settle
    await new Promise((r) => setTimeout(r, 10));
  });
});
