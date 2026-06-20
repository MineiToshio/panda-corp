/**
 * WO-01-009 — ADVERSARIAL hook tests (reviewer-authored, DR-015/016).
 *
 * Edge cases the implementer's useLiveSnapshot.test.ts did NOT cover:
 *   - changing options (project) re-opens the EventSource and closes the old one
 *   - a burst that straddles the debounce window applies the LATEST, not a stale one
 *   - reconnect timer scheduled before unmount does NOT fire a connect afterwards
 *   - a frame with no `lastEventAt` field still sets snapshot and leaves lastEventAt null
 *   - the connection flips back to connected=true after a reconnect succeeds
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockES {
  url: string;
  onopen: ((e: Event) => void) | null;
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  close: ReturnType<typeof vi.fn>;
  _open: () => void;
  _msg: (data: string) => void;
  _err: () => void;
}

let instances: MockES[] = [];

class MockEventSource {
  url: string;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    instances.push(this as unknown as MockES);
  }
  _open(): void {
    this.onopen?.(new Event("open"));
  }
  _msg(data: string): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }
  _err(): void {
    this.onerror?.(new Event("error"));
  }
}

import { useLiveSnapshot } from "../useLiveSnapshot";

function payload(at: string, project?: string): string {
  return JSON.stringify({
    events: project ? [{ event: "X", at, project }] : [{ event: "X", at }],
    lastEventAt: at,
    byProject: {},
  });
}

describe("useLiveSnapshot — adversarial", () => {
  beforeEach(() => {
    instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("changing the `project` option closes the old EventSource and opens a new scoped one", async () => {
    const { rerender } = renderHook((props: { project?: string }) => useLiveSnapshot(props), {
      initialProps: { project: "alpha" },
    });
    expect(instances).toHaveLength(1);
    expect(instances[0]?.url).toContain("project=alpha");
    const firstClose = instances[0]?.close;

    rerender({ project: "beta" });

    await waitFor(() => {
      expect(instances.length).toBeGreaterThan(1);
    });
    expect(firstClose).toHaveBeenCalled(); // old stream torn down — no leak
    expect(instances[instances.length - 1]?.url).toContain("project=beta");
  });

  it("debounce applies the LATEST frame of a burst, dropping intermediate ones", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveSnapshot());
    act(() => {
      instances[0]?._open();
      instances[0]?._msg(payload("2026-06-19T10:00:01Z"));
      instances[0]?._msg(payload("2026-06-19T10:00:02Z"));
    });
    // Before the debounce window elapses, nothing applied yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current.lastEventAt).toBeNull();
    // After the window, only the last frame is applied.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(result.current.lastEventAt).toBe("2026-06-19T10:00:02Z");
  });

  it("recovers connected=true after an error → reconnect → open cycle", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveSnapshot());
    act(() => {
      instances[0]?._open();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      instances[0]?._err();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.connected).toBe(false);

    // Advance past reconnect delay (3000ms) → a new instance is created.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });
    expect(instances.length).toBeGreaterThan(1);

    // The new connection opens → connected flips true again.
    act(() => {
      instances[instances.length - 1]?._open();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.connected).toBe(true);
  });

  it("a frame missing lastEventAt sets the snapshot but keeps lastEventAt null", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveSnapshot());
    act(() => {
      instances[0]?._open();
      instances[0]?._msg(JSON.stringify({ events: [{ event: "X", at: "t" }] })); // no lastEventAt
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.lastEventAt).toBeNull();
  });

  // DR-016 gap closed (reviewer): the existing "does not reconnect after unmount"
  // test errors the source AFTER unmount, so a reconnect timer is never pending
  // at teardown — neither the cleanup's cancelReconnect() nor the inner reconnect
  // guard is exercised (both mutations survived). This pins the REAL race: an
  // error fires, a reconnect timer is SCHEDULED, and THEN the component unmounts
  // before the delay elapses. No new EventSource may be opened after unmount.
  it("a reconnect timer pending AT unmount is cancelled — no EventSource opens afterwards", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useLiveSnapshot());

    act(() => {
      instances[0]?._open();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Error WHILE mounted → schedules a reconnect timer (RECONNECT_DELAY_MS=3000).
    act(() => {
      instances[0]?._err();
    });
    // Advance only partway — the reconnect timer is now PENDING, not yet fired.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    const countBefore = instances.length;

    // Unmount with the reconnect timer still pending.
    unmount();

    // Let the original reconnect delay (and more) elapse post-unmount.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // The pending reconnect must have been cancelled — no new EventSource opened.
    expect(instances.length).toBe(countBefore);
  });
});
