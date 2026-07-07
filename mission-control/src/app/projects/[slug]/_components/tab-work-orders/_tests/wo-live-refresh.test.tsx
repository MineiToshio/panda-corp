/**
 * WoLiveRefresh — the invisible live board updater (AC-05-005.1).
 *
 * TWO refresh triggers (2026-07-07): a new EVENT (lastEventAt changed) OR a moved
 * machine-STATE version. The engine emits NO event on a backward WO transition
 * (IN_REVIEW→PLANNED) — it only rewrites frontmatter, which moves `stateVersion` —
 * so the event-only path would miss it. These tests pin both triggers.
 */

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const useLiveSnapshotMock = vi.fn();
vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => useLiveSnapshotMock(),
}));

import { WoLiveRefresh } from "../wo-live-refresh";

function frame(lastEventAt: string | null, stateVersion: number | undefined) {
  return {
    snapshot: { events: [], lastEventAt, byProject: {}, stateVersion },
    connected: true,
    lastEventAt,
  };
}

beforeEach(() => {
  refreshMock.mockReset();
  useLiveSnapshotMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("WoLiveRefresh", () => {
  it("does not refresh before the first event arrives (null lastEventAt, baseline state)", () => {
    useLiveSnapshotMock.mockReturnValue(frame(null, 100));
    render(<WoLiveRefresh project="mc" />);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refreshes when a new event arrives (lastEventAt changed)", () => {
    useLiveSnapshotMock.mockReturnValue(frame(null, 100));
    const { rerender } = render(<WoLiveRefresh project="mc" />);
    expect(refreshMock).not.toHaveBeenCalled();

    useLiveSnapshotMock.mockReturnValue(frame("2026-07-07T10:00:05Z", 100));
    rerender(<WoLiveRefresh project="mc" />);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes when stateVersion MOVES with NO new event (backward WO transition)", () => {
    useLiveSnapshotMock.mockReturnValue(frame(null, 100));
    const { rerender } = render(<WoLiveRefresh project="mc" />);
    expect(refreshMock).not.toHaveBeenCalled();

    // Same (null) lastEventAt, higher stateVersion — the engine rewrote frontmatter
    // (IN_REVIEW→PLANNED) without emitting an event.
    useLiveSnapshotMock.mockReturnValue(frame(null, 200));
    rerender(<WoLiveRefresh project="mc" />);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when neither the event nor the state version moved", () => {
    useLiveSnapshotMock.mockReturnValue(frame("2026-07-07T10:00:05Z", 100));
    const { rerender } = render(<WoLiveRefresh project="mc" />);
    // First real frame triggers one refresh (board becomes current).
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // A replay of the SAME frame (new object, same values) must not refresh again.
    useLiveSnapshotMock.mockReturnValue(frame("2026-07-07T10:00:05Z", 100));
    rerender(<WoLiveRefresh project="mc" />);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("renders the invisible marker span (data-testid=wo-live-refresh)", () => {
    useLiveSnapshotMock.mockReturnValue(frame(null, undefined));
    const { getByTestId } = render(<WoLiveRefresh project="mc" />);
    expect(getByTestId("wo-live-refresh")).toBeDefined();
  });
});
