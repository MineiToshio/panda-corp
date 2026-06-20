/**
 * WO-01-009 — `useLiveSnapshot` hook tests.
 *
 * Tests the client hook that subscribes to the SSE live transport:
 *   - Opens an EventSource on mount with the correct URL
 *   - Passes ?project= and ?kind= query params
 *   - Returns { snapshot, connected, lastEventAt }
 *   - Debounces high-frequency bursts
 *   - Auto-reconnects on connection drop
 *   - Tears down EventSource on unmount (no leak)
 *   - Treats events without a project field as legacy/global
 *
 * Traceability:
 *   AC-01-009.1 — event reaches subscribed client (hook receives SSE frames)
 *   AC-01-009.2 — ?project= filter accepted and passed to the endpoint
 *   AC-01-009.3 — hook debounces bursts and reconnects after dropped connection
 *   AC-01-009.3 — tears down on unmount (no leak)
 *
 * Strategy: mock EventSource globally; render the hook with @testing-library/react;
 * fire synthetic SSE message events; assert state transitions.
 *
 * Timer notes:
 *   - Most tests use REAL timers + act()/waitFor so React's internal scheduler
 *     and @testing-library/react's waitFor work correctly.
 *   - Debounce and reconnect tests use vi.useFakeTimers() in a localised scope,
 *     with advanceTimersByTimeAsync() so the React scheduler still runs.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// EventSource mock — replaces the global in jsdom (which lacks EventSource)
// ---------------------------------------------------------------------------

interface MockEventSourceInstance {
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  close: ReturnType<typeof vi.fn>;
  _simulateOpen: () => void;
  _simulateMessage: (data: string) => void;
  _simulateError: () => void;
}

let capturedInstances: MockEventSourceInstance[] = [];

class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  close: ReturnType<typeof vi.fn>;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockEventSource.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.close = vi.fn(() => {
      this.readyState = MockEventSource.CLOSED;
    });

    capturedInstances.push(this as unknown as MockEventSourceInstance);
  }

  _simulateOpen(): void {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.(new Event("open"));
  }

  _simulateMessage(data: string): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  _simulateError(): void {
    this.readyState = MockEventSource.CLOSED;
    this.onerror?.(new Event("error"));
  }
}

// ---------------------------------------------------------------------------
// Import hook (will fail until the file is created — RED phase)
// ---------------------------------------------------------------------------

import { useLiveSnapshot } from "../useLiveSnapshot";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makePayload(at: string, project?: string): string {
  const events = project
    ? [{ event: "AgentWorking", at, project }]
    : [{ event: "AgentWorking", at }];
  return JSON.stringify({
    events,
    lastEventAt: at,
    byProject: project ? { [project]: { lastEventAt: at } } : { __global__: { lastEventAt: at } },
  });
}

const SNAPSHOT_PAYLOAD = makePayload("2026-06-19T10:00:00Z", "mission-control");
const LEGACY_PAYLOAD = makePayload("2026-06-19T10:00:00Z"); // no project

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("useLiveSnapshot", () => {
  beforeEach(() => {
    capturedInstances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers(); // always restore real timers between tests
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe("initial state", () => {
    it("returns snapshot=null, connected=false, lastEventAt=null before connection", () => {
      const { result } = renderHook(() => useLiveSnapshot());
      expect(result.current.snapshot).toBeNull();
      expect(result.current.connected).toBe(false);
      expect(result.current.lastEventAt).toBeNull();
    });

    it("creates an EventSource on mount", () => {
      renderHook(() => useLiveSnapshot());
      expect(capturedInstances.length).toBe(1);
    });

    it("uses /api/live as the default URL", () => {
      renderHook(() => useLiveSnapshot());
      expect(capturedInstances[0]?.url).toMatch(/\/api\/live/);
    });
  });

  // ---------------------------------------------------------------------------
  // Query parameters
  // ---------------------------------------------------------------------------

  describe("query parameters", () => {
    it("appends ?project= when project is provided", () => {
      renderHook(() => useLiveSnapshot({ project: "mission-control" }));
      expect(capturedInstances[0]?.url).toContain("project=mission-control");
    });

    it("appends ?kind= when kinds are provided", () => {
      renderHook(() => useLiveSnapshot({ kinds: ["AgentWorking", "BuildEnd"] }));
      expect(capturedInstances[0]?.url).toContain("kind=");
    });

    it("does not append ?project= when not provided", () => {
      renderHook(() => useLiveSnapshot());
      expect(capturedInstances[0]?.url).not.toContain("project=");
    });
  });

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  describe("connection lifecycle", () => {
    it("sets connected=true when EventSource opens", async () => {
      const { result } = renderHook(() => useLiveSnapshot());

      act(() => {
        capturedInstances[0]?._simulateOpen();
      });

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });
    });

    it("sets connected=false on error", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useLiveSnapshot());

      act(() => {
        capturedInstances[0]?._simulateOpen();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      act(() => {
        capturedInstances[0]?._simulateError();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      expect(result.current.connected).toBe(false);
    });

    it("closes EventSource on unmount (no leak)", () => {
      const { unmount } = renderHook(() => useLiveSnapshot());
      const es = capturedInstances[0];
      unmount();
      expect(es?.close).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Message handling
  // ---------------------------------------------------------------------------

  describe("message handling", () => {
    it("updates snapshot when a valid SSE message is received", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useLiveSnapshot());

      act(() => {
        capturedInstances[0]?._simulateOpen();
        capturedInstances[0]?._simulateMessage(SNAPSHOT_PAYLOAD);
      });
      // Flush debounce
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(result.current.snapshot).not.toBeNull();
    });

    it("updates lastEventAt from the message payload", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useLiveSnapshot());

      act(() => {
        capturedInstances[0]?._simulateOpen();
        capturedInstances[0]?._simulateMessage(SNAPSHOT_PAYLOAD);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(result.current.lastEventAt).toBe("2026-06-19T10:00:00Z");
    });

    it("ignores malformed/non-JSON SSE data (no crash)", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useLiveSnapshot());

      act(() => {
        capturedInstances[0]?._simulateOpen();
        capturedInstances[0]?._simulateMessage("this is not json");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      // Snapshot stays null — no crash
      expect(result.current.snapshot).toBeNull();
    });

    it("ignores SSE data that is valid JSON but not a snapshot shape", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useLiveSnapshot());

      act(() => {
        capturedInstances[0]?._simulateOpen();
        capturedInstances[0]?._simulateMessage(JSON.stringify({ foo: "bar" }));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      // Snapshot stays null
      expect(result.current.snapshot).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Debounce (burst protection)
  // ---------------------------------------------------------------------------

  describe("debounce", () => {
    it("applies only the last of a rapid burst of messages", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useLiveSnapshot());

      act(() => {
        capturedInstances[0]?._simulateOpen();
        // Fire 5 rapid messages with increasing timestamps
        capturedInstances[0]?._simulateMessage(makePayload("2026-06-19T10:00:01Z", "mc"));
        capturedInstances[0]?._simulateMessage(makePayload("2026-06-19T10:00:02Z", "mc"));
        capturedInstances[0]?._simulateMessage(makePayload("2026-06-19T10:00:03Z", "mc"));
        capturedInstances[0]?._simulateMessage(makePayload("2026-06-19T10:00:04Z", "mc"));
        capturedInstances[0]?._simulateMessage(makePayload("2026-06-19T10:00:05Z", "mc"));
      });

      // Advance past the debounce window (DEBOUNCE_MS = 150ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      // The last message's timestamp should be applied
      expect(result.current.lastEventAt).toBe("2026-06-19T10:00:05Z");
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-reconnect
  // ---------------------------------------------------------------------------

  describe("auto-reconnect", () => {
    it("reconnects after a connection error with a delay", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useLiveSnapshot());

      act(() => {
        capturedInstances[0]?._simulateOpen();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(result.current.connected).toBe(true);

      act(() => {
        capturedInstances[0]?._simulateError();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(result.current.connected).toBe(false);

      // Advance past the RECONNECT_DELAY_MS (3000ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });

      // A new EventSource instance should have been created
      expect(capturedInstances.length).toBeGreaterThan(1);
    });

    it("does not reconnect after unmount", async () => {
      vi.useFakeTimers();
      const { unmount } = renderHook(() => useLiveSnapshot());

      act(() => {
        capturedInstances[0]?._simulateOpen();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      const countBefore = capturedInstances.length;
      unmount();

      // Simulate error AFTER unmount — should NOT trigger reconnect
      act(() => {
        capturedInstances[0]?._simulateError();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // No new instances should have been created after unmount
      expect(capturedInstances.length).toBe(countBefore);
    });
  });

  // ---------------------------------------------------------------------------
  // Legacy / global events (architecture §5, CLAUDE.md)
  // ---------------------------------------------------------------------------

  describe("legacy / global events", () => {
    it("accepts events without a project field (legacy/global)", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useLiveSnapshot({ project: "mission-control" }));

      act(() => {
        capturedInstances[0]?._simulateOpen();
        capturedInstances[0]?._simulateMessage(LEGACY_PAYLOAD);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(result.current.snapshot).not.toBeNull();
    });
  });
});
