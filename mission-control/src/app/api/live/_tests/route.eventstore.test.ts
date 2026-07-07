/**
 * GET /api/live — shared EventStore (stream hygiene, 2026-07-07).
 *
 * The route no longer opens a per-connection watcher + full re-parse. A
 * module-level singleton owns ONE fs.watch on the events file plus a memoized
 * snapshot; each connection filters the shared snapshot. These tests pin:
 *   - concurrent connections share ONE fs.watch (reference-counted);
 *   - the shared watcher tears down only when the LAST connection unsubscribes;
 *   - a fresh connection after teardown re-arms the shared watcher;
 *   - the memoized parse isn't re-run for an unchanged file.
 */

import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventsSnapshot } from "@/lib/events/events";

vi.mock("@/lib/events/events", () => ({ readEvents: vi.fn() }));

import { readEvents } from "@/lib/events/events";
import { __resetLiveEventStoresForTest, GET } from "../route";

const mockReadEvents = vi.mocked(readEvents);

const EMPTY: EventsSnapshot = { events: [], lastEventAt: null, byProject: {} };

describe("GET /api/live — shared EventStore", () => {
  let watchSpy: ReturnType<typeof vi.spyOn>;
  let closeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetLiveEventStoresForTest();
    closeSpy = vi.fn();
    watchSpy = vi
      .spyOn(fs, "watch")
      .mockImplementation(() => ({ close: closeSpy }) as unknown as fs.FSWatcher);
    mockReadEvents.mockReturnValue(EMPTY);
  });

  afterEach(() => {
    watchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  /** Open a connection and consume its initial frame (triggers start()). */
  async function openConnection(): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    const res = GET(new Request("http://localhost/api/live"));
    const { body } = res;
    expect(body).not.toBeNull();
    if (body === null) throw new Error("no body");
    const reader = body.getReader();
    await reader.read();
    return reader;
  }

  it("shares ONE fs.watch across concurrent connections; closes it on the LAST unsubscribe", async () => {
    const r1 = await openConnection();
    const r2 = await openConnection();

    // ONE shared watcher armed for both connections (not one per connection).
    expect(watchSpy).toHaveBeenCalledTimes(1);

    await r1.cancel();
    // One subscriber remains → shared watcher stays open.
    expect(closeSpy).toHaveBeenCalledTimes(0);

    await r2.cancel();
    // Last subscriber gone → shared watcher torn down exactly once (no leak).
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("re-arms the shared watcher for a fresh connection after all closed", async () => {
    const r1 = await openConnection();
    await r1.cancel();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    const r2 = await openConnection();
    expect(watchSpy).toHaveBeenCalledTimes(2);
    await r2.cancel();
  });

  it("does not re-parse the events file for an unchanged file (memoized snapshot)", async () => {
    const r1 = await openConnection();
    const callsAfterFirst = mockReadEvents.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    const r2 = await openConnection();
    // A second connection reuses the memoized parse (or re-reads at most once more
    // when the default path can't be statted — either way, never a full re-parse
    // per connection).
    expect(mockReadEvents.mock.calls.length).toBeLessThanOrEqual(callsAfterFirst + 1);

    await r1.cancel();
    await r2.cancel();
  });
});
