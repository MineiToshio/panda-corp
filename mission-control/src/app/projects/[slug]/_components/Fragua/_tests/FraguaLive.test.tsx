import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { EventsSnapshot } from "@/lib/events/events";
import { FraguaLive } from "../FraguaLive";

const live = vi.hoisted(() => ({
  snapshot: null as (EventsSnapshot & { stateVersion?: number }) | null,
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: live.refresh }) }));
vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => ({ snapshot: live.snapshot }),
}));
beforeEach(() => {
  vi.useFakeTimers();
  live.snapshot = null;
  live.refresh.mockClear();
});
afterEach(() => vi.useRealTimers());
const signal = { kind: "live", lastSignalAt: "2026-10-30T11:59:00Z", ageMinutes: 1 } as const;
it("AC-06-001.6: stateVersion movement refreshes even without a new event", () => {
  const { rerender } = render(
    <FraguaLive project="demo" signal={signal} nowIso="2026-10-30T12:00:00Z">
      scene
    </FraguaLive>,
  );
  live.snapshot = { events: [], lastEventAt: null, byProject: {}, stateVersion: 1 };
  rerender(
    <FraguaLive project="demo" signal={signal} nowIso="2026-10-30T12:00:00Z">
      scene
    </FraguaLive>,
  );
  live.snapshot = { ...live.snapshot, stateVersion: 2 };
  rerender(
    <FraguaLive project="demo" signal={signal} nowIso="2026-10-30T12:00:00Z">
      scene
    </FraguaLive>,
  );
  act(() => vi.advanceTimersByTime(5000));
  expect(live.refresh).toHaveBeenCalledTimes(1);
});
it("AC-06-020.6: a single TTL refresh removes local animation and cleans up on unmount", () => {
  const { container, unmount } = render(
    <FraguaLive project="demo" signal={signal} nowIso="2026-10-30T12:00:00Z">
      scene
    </FraguaLive>,
  );
  expect(container.firstChild).toHaveAttribute("data-live", "true");
  act(() => vi.advanceTimersByTime(9 * 60000));
  expect(container.firstChild).toHaveAttribute("data-live", "false");
  expect(live.refresh).toHaveBeenCalledTimes(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
