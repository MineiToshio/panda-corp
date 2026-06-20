/**
 * WO-01-009 — ADVERSARIAL route tests (reviewer-authored, DR-015/016).
 *
 * The implementer's route.test.ts asserts the project filter with vacuous
 * `if (frame !== null) { ... }` guards that pass even when filtering is broken.
 * These tests pin the behavior NON-vacuously: they FAIL if the route stops
 * filtering, stops re-deriving aggregates, or mishandles the `?kind=` filter
 * (which the implementer never tested at all).
 *
 * Strategy: drive the exported GET handler directly, force a snapshot via the
 * mocked reader, read the first SSE frame, and assert the EXACT filtered set.
 */

import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventsSnapshot } from "@/lib/events/events";

vi.mock("@/lib/events/events", () => ({ readEvents: vi.fn() }));

import { readEvents } from "@/lib/events/events";
import { GET } from "../route";

const mockReadEvents = vi.mocked(readEvents);

interface Frame {
  events: Array<{ event: string; at: string; project?: string }>;
  lastEventAt: string | null;
  byProject: Record<string, { lastEventAt: string }>;
}

async function firstFrame(res: Response): Promise<Frame> {
  const { body } = res;
  expect(body).not.toBeNull();
  if (body === null) throw new Error("no body");
  const reader = body.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  const text = new TextDecoder().decode(value);
  const match = text.match(/^data: (.+)$/m);
  expect(match, `expected a data: frame, got:\n${text}`).not.toBeNull();
  // biome-ignore lint/style/noNonNullAssertion: asserted non-null above
  return JSON.parse(match![1] as string) as Frame;
}

const MIXED: EventsSnapshot = {
  events: [
    { event: "AgentWorking", at: "2026-06-19T10:00:00Z", project: "mission-control" },
    { event: "BuildEnd", at: "2026-06-19T10:00:01Z", project: "other-project" },
    { event: "AgentWorking", at: "2026-06-19T10:00:02Z" }, // legacy/global
    { event: "BuildEnd", at: "2026-06-19T10:00:03Z", project: "other-project" },
  ],
  lastEventAt: "2026-06-19T10:00:03Z",
  byProject: {
    "mission-control": { lastEventAt: "2026-06-19T10:00:00Z" },
    "other-project": { lastEventAt: "2026-06-19T10:00:03Z" },
    __global__: { lastEventAt: "2026-06-19T10:00:02Z" },
  },
};

describe("GET /api/live — adversarial filtering (non-vacuous)", () => {
  let watchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    watchSpy = vi
      .spyOn(fs, "watch")
      .mockImplementation(() => ({ close: vi.fn() }) as unknown as fs.FSWatcher);
  });

  afterEach(() => {
    watchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("?project= DROPS other-project events but KEEPS mission-control + legacy/global", async () => {
    mockReadEvents.mockReturnValue(MIXED);
    const res = GET(new Request("http://localhost/api/live?project=mission-control"));
    const frame = await firstFrame(res);

    // EXACTLY the mission-control event + the legacy/global one — not the 4 raw.
    expect(frame.events).toHaveLength(2);
    const projects = frame.events.map((e) => e.project);
    expect(projects).toContain("mission-control");
    expect(projects).toContain(undefined); // legacy/global survived
    expect(projects).not.toContain("other-project"); // dropped
  });

  it("re-derives lastEventAt from the FILTERED set, not the raw snapshot", async () => {
    mockReadEvents.mockReturnValue(MIXED);
    const res = GET(new Request("http://localhost/api/live?project=mission-control"));
    const frame = await firstFrame(res);

    // Raw lastEventAt is 10:00:03 (other-project). After filtering to
    // mission-control + global, the latest is the global event at 10:00:02.
    expect(frame.lastEventAt).toBe("2026-06-19T10:00:02Z");
    // byProject must NOT leak the filtered-out project.
    expect(frame.byProject).not.toHaveProperty("other-project");
    expect(frame.byProject).toHaveProperty("mission-control");
    expect(frame.byProject).toHaveProperty("__global__");
  });

  it("?kind= keeps only matching event kinds (implementer never tested this)", async () => {
    mockReadEvents.mockReturnValue(MIXED);
    const res = GET(new Request("http://localhost/api/live?kind=BuildEnd"));
    const frame = await firstFrame(res);

    expect(frame.events.length).toBeGreaterThan(0);
    for (const ev of frame.events) {
      expect(ev.event).toBe("BuildEnd");
    }
    // The two AgentWorking events must be gone.
    expect(frame.events.every((e) => e.event === "BuildEnd")).toBe(true);
  });

  it("?kind= with multiple comma-separated kinds keeps all listed kinds", async () => {
    mockReadEvents.mockReturnValue(MIXED);
    const res = GET(new Request("http://localhost/api/live?kind=AgentWorking,BuildEnd"));
    const frame = await firstFrame(res);
    expect(frame.events).toHaveLength(4); // both kinds present → nothing dropped
  });

  it("combined ?project=&kind= applies BOTH filters", async () => {
    mockReadEvents.mockReturnValue(MIXED);
    const res = GET(
      new Request("http://localhost/api/live?project=mission-control&kind=AgentWorking"),
    );
    const frame = await firstFrame(res);
    // mission-control AgentWorking + legacy/global AgentWorking; other-project BuildEnd dropped.
    expect(frame.events).toHaveLength(2);
    for (const ev of frame.events) {
      expect(ev.event).toBe("AgentWorking");
      expect(ev.project === "mission-control" || ev.project === undefined).toBe(true);
    }
  });

  it("empty ?kind= (blank) is treated as NO kind filter (does not drop everything)", async () => {
    mockReadEvents.mockReturnValue(MIXED);
    const res = GET(new Request("http://localhost/api/live?kind="));
    const frame = await firstFrame(res);
    expect(frame.events).toHaveLength(4); // blank kind → no filtering
  });

  it("no filter returns the full raw snapshot unchanged", async () => {
    mockReadEvents.mockReturnValue(MIXED);
    const res = GET(new Request("http://localhost/api/live"));
    const frame = await firstFrame(res);
    expect(frame.events).toHaveLength(4);
    expect(frame.lastEventAt).toBe("2026-06-19T10:00:03Z");
  });
});
