import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { DashboardLiveWatcher } from "../DashboardLiveWatcher";

const transport = vi.hoisted(() => ({
  lastEventAt: null as string | null,
  snapshot: { stateVersion: 1 },
}));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/hooks/useLiveSnapshot", () => ({ useLiveSnapshot: () => transport }));
beforeEach(() => {
  refresh.mockClear();
  transport.lastEventAt = null;
  transport.snapshot = { stateVersion: 1 };
});
it("AC-06-019.7 REQ-18-004: refreshes on stateVersion without an event, coalesces both changes and never refreshes unchanged frames", () => {
  const { rerender } = render(<DashboardLiveWatcher />);
  expect(refresh).not.toHaveBeenCalled();
  transport.snapshot = { stateVersion: 2 };
  rerender(<DashboardLiveWatcher />);
  expect(refresh).toHaveBeenCalledTimes(1);
  rerender(<DashboardLiveWatcher />);
  expect(refresh).toHaveBeenCalledTimes(1);
  transport.snapshot = { stateVersion: 3 };
  transport.lastEventAt = "2026-10-30T12:00:00Z";
  rerender(<DashboardLiveWatcher />);
  expect(refresh).toHaveBeenCalledTimes(2);
});
