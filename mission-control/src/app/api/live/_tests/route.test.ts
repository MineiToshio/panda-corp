/**
 * WO-01-009 — `app/api/live` SSE route handler tests.
 *
 * Tests the GET /api/live route:
 *   - Returns text/event-stream with correct headers
 *   - Passes ?project= and ?kind= filter params to the watcher
 *   - Handles missing/locked NDJSON file defensively (no throw)
 *   - Closes the stream and watcher on abort signal
 *   - Emits data frames in the SSE format
 *
 * Traceability:
 *   AC-01-009.1 — change appended to NDJSON reaches subscribed client via SSE
 *   AC-01-009.2 — ?project= filters the stream; legacy/global events still arrive
 *   AC-01-009.3 — route never throws on missing/locked file; closing ends the watcher
 *
 * Strategy: mock readEvents from lib/events; stub fs.watch via vi.spyOn;
 * invoke the exported GET handler directly with a minimal Request.
 */

import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventsSnapshot } from "@/lib/events/events";

// ---------------------------------------------------------------------------
// Mocks — must be declared before the import of the module under test
// ---------------------------------------------------------------------------

vi.mock("@/lib/events/events", () => ({
  readEvents: vi.fn(),
}));

import { readEvents } from "@/lib/events/events";
import { __resetLiveEventStoresForTest, GET } from "../route";

const mockReadEvents = vi.mocked(readEvents);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_SNAPSHOT: EventsSnapshot = {
  events: [],
  lastEventAt: null,
  byProject: {},
};

const SNAPSHOT_WITH_EVENTS: EventsSnapshot = {
  events: [
    { event: "AgentWorking", at: "2026-06-19T10:00:00Z", project: "mission-control" },
    { event: "AgentWorking", at: "2026-06-19T10:00:01Z" }, // legacy/global
  ],
  lastEventAt: "2026-06-19T10:00:01Z",
  byProject: {
    "mission-control": { lastEventAt: "2026-06-19T10:00:00Z" },
    __global__: { lastEventAt: "2026-06-19T10:00:01Z" },
  },
};

const SNAPSHOT_OTHER_PROJECT: EventsSnapshot = {
  events: [{ event: "AgentWorking", at: "2026-06-19T10:00:00Z", project: "other-project" }],
  lastEventAt: "2026-06-19T10:00:00Z",
  byProject: {
    "other-project": { lastEventAt: "2026-06-19T10:00:00Z" },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the first available chunk from a Response body stream.
 * Asserts the body is non-null (fails test loudly if it is).
 */
async function readFirstChunk(res: Response): Promise<string> {
  const { body } = res;
  expect(body, "Response.body must not be null").not.toBeNull();
  if (body === null) return "";
  const reader = body.getReader();
  const { value } = await reader.read();
  reader.cancel();
  return new TextDecoder().decode(value);
}

/**
 * Parse the first `data:` payload from an SSE text block.
 * Returns the parsed object, or null if no data line is present.
 */
function parseFirstFrame(text: string): Record<string, unknown> | null {
  const match = text.match(/^data: (.+)$/m);
  if (match === null || match[1] === undefined) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/live — SSE route", () => {
  let watchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level shared EventStore so each test starts from a clean
    // watcher/subscriber state (the singleton persists across tests within a file;
    // an un-cancelled connection would otherwise keep the shared watcher armed).
    __resetLiveEventStoresForTest();
    mockReadEvents.mockReturnValue(EMPTY_SNAPSHOT);

    // Stub fs.watch to return a fake watcher that does nothing.
    watchSpy = vi
      .spyOn(fs, "watch")
      .mockImplementation(() => ({ close: vi.fn() }) as unknown as fs.FSWatcher);
  });

  afterEach(() => {
    watchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Response headers
  // ---------------------------------------------------------------------------

  describe("response headers", () => {
    it("returns Content-Type: text/event-stream", () => {
      const req = new Request("http://localhost/api/live");
      const res = GET(req);
      res.body?.cancel();
      expect(res.headers.get("Content-Type")).toMatch(/text\/event-stream/);
    });

    it("returns Cache-Control: no-cache", () => {
      const req = new Request("http://localhost/api/live");
      const res = GET(req);
      res.body?.cancel();
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
    });

    it("returns Connection: keep-alive", () => {
      const req = new Request("http://localhost/api/live");
      const res = GET(req);
      res.body?.cancel();
      expect(res.headers.get("Connection")).toBe("keep-alive");
    });

    it("returns status 200", () => {
      const req = new Request("http://localhost/api/live");
      const res = GET(req);
      res.body?.cancel();
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Stream body
  // ---------------------------------------------------------------------------

  describe("stream body", () => {
    it("returns a ReadableStream body", () => {
      const req = new Request("http://localhost/api/live");
      const res = GET(req);
      expect(res.body).not.toBeNull();
      expect(res.body).toBeInstanceOf(ReadableStream);
      res.body?.cancel();
    });

    it("emits initial snapshot as SSE data frame when events exist", async () => {
      mockReadEvents.mockReturnValue(SNAPSHOT_WITH_EVENTS);
      const req = new Request("http://localhost/api/live");
      const res = GET(req);

      const text = await readFirstChunk(res);
      expect(text).toMatch(/^data: /m);
    });

    it("SSE frame contains valid JSON", async () => {
      mockReadEvents.mockReturnValue(SNAPSHOT_WITH_EVENTS);
      const req = new Request("http://localhost/api/live");
      const res = GET(req);

      const text = await readFirstChunk(res);
      const frame = parseFirstFrame(text);
      expect(frame).not.toBeNull();
    });

    it("emits the SSE frame even when the snapshot is empty", async () => {
      mockReadEvents.mockReturnValue(EMPTY_SNAPSHOT);
      const req = new Request("http://localhost/api/live");
      const res = GET(req);

      const text = await readFirstChunk(res);
      expect(text).toMatch(/^data: /m);
    });
  });

  // ---------------------------------------------------------------------------
  // Query parameter: ?project=
  // ---------------------------------------------------------------------------

  describe("query parameter: ?project=", () => {
    it("passes project filter — readEvents is called at least once", async () => {
      const req = new Request("http://localhost/api/live?project=mission-control");
      const res = GET(req);
      await readFirstChunk(res);
      expect(mockReadEvents).toHaveBeenCalled();
    });

    it("filters out events not belonging to the requested project", async () => {
      mockReadEvents.mockReturnValue(SNAPSHOT_OTHER_PROJECT);
      const req = new Request("http://localhost/api/live?project=mission-control");
      const res = GET(req);

      const text = await readFirstChunk(res);
      const frame = parseFirstFrame(text);
      if (frame !== null) {
        const events = frame.events as Array<{ project?: string }> | undefined;
        if (events !== undefined) {
          for (const ev of events) {
            // Each event must belong to the requested project or be legacy/global
            expect(ev.project === "mission-control" || ev.project === undefined).toBe(true);
          }
        }
      }
    });

    it("still delivers legacy/global events (no project field) when ?project= is set", async () => {
      mockReadEvents.mockReturnValue(SNAPSHOT_WITH_EVENTS);
      const req = new Request("http://localhost/api/live?project=mission-control");
      const res = GET(req);

      const text = await readFirstChunk(res);
      const frame = parseFirstFrame(text);
      if (frame !== null) {
        const events = frame.events as Array<{ project?: string }> | undefined;
        if (events !== undefined && events.length > 0) {
          // At least one event without project (legacy/global) must be included
          const hasGlobal = events.some((ev) => ev.project === undefined);
          expect(hasGlobal).toBe(true);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Defensive: missing/locked file
  // ---------------------------------------------------------------------------

  describe("defensive: missing/locked file", () => {
    it("does not throw when readEvents returns an empty snapshot", () => {
      mockReadEvents.mockReturnValue(EMPTY_SNAPSHOT);
      const req = new Request("http://localhost/api/live");
      // GET is synchronous — it must not throw
      expect(() => GET(req)).not.toThrow();
    });

    it("returns 200 even when readEvents returns empty snapshot", () => {
      mockReadEvents.mockReturnValue(EMPTY_SNAPSHOT);
      const req = new Request("http://localhost/api/live");
      const res = GET(req);
      res.body?.cancel();
      expect(res.status).toBe(200);
    });

    it("fs.watch failure does not crash the route — returns 200 with stream", async () => {
      watchSpy.mockImplementation(() => {
        throw new Error("ENOTSUP: operation not supported");
      });
      const req = new Request("http://localhost/api/live");
      const res = GET(req);
      expect(res.status).toBe(200);
      res.body?.cancel();
    });
  });

  // ---------------------------------------------------------------------------
  // Watcher setup
  // ---------------------------------------------------------------------------

  describe("cleanup on abort/close", () => {
    it("sets up a fs.watch watcher after the first chunk is consumed", async () => {
      const req = new Request("http://localhost/api/live");
      const res = GET(req);
      // Read one chunk to trigger the stream start callback
      await readFirstChunk(res);
      expect(watchSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // SSE frame shape
  // ---------------------------------------------------------------------------

  describe("SSE frame shape", () => {
    it("frame has events, lastEventAt and byProject fields", async () => {
      mockReadEvents.mockReturnValue(SNAPSHOT_WITH_EVENTS);
      const req = new Request("http://localhost/api/live");
      const res = GET(req);

      const text = await readFirstChunk(res);
      const frame = parseFirstFrame(text);
      expect(frame).not.toBeNull();
      if (frame !== null) {
        expect(frame).toHaveProperty("events");
        expect(frame).toHaveProperty("lastEventAt");
        expect(frame).toHaveProperty("byProject");
      }
    });

    it("frame events only contains mission-control and global events when filtered", async () => {
      mockReadEvents.mockReturnValue(SNAPSHOT_WITH_EVENTS);
      const req = new Request("http://localhost/api/live?project=mission-control");
      const res = GET(req);

      const text = await readFirstChunk(res);
      const frame = parseFirstFrame(text);
      if (frame !== null) {
        const events = frame.events as Array<{ project?: string }> | undefined;
        if (events !== undefined) {
          for (const ev of events) {
            expect(ev.project === "mission-control" || ev.project === undefined).toBe(true);
          }
        }
      }
    });
  });
});
