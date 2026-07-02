/**
 * readEvents — project filter BEFORE the tail cap (FRD-01 IF-01-readEvents,
 * 2026-07-01). The global stream mixes every session's hook noise with each
 * build's events; filtering AFTER capping let noise crowd a project's events
 * out of the tail (the Party rendered another project's build). These tests
 * pin the filter-then-cap order and the cross-project isolation.
 */

import { describe, expect, it } from "vitest";

import { readEvents } from "@/lib/events/events";
import { FIXTURE_EVENTS_MULTIPROJECT_NOISE_NDJSON } from "@/tests/fixtures";

describe("frd-01: readEvents — project filter before cap", () => {
  it("frd-01: WHEN project is set THEN only that project's events are retained", () => {
    const { events } = readEvents({
      path: FIXTURE_EVENTS_MULTIPROJECT_NOISE_NDJSON,
      project: "alpha",
    });
    expect(events).toHaveLength(3);
    expect(events.every((ev) => ev.project === "alpha")).toBe(true);
  });

  it("frd-01: WHEN the cap is smaller than the noise tail THEN the project's events still survive (filter runs first)", () => {
    // Without the filter, cap=4 would retain only the last 4 events — all
    // project "beta" noise. With the filter, all 3 "alpha" events survive.
    const { events } = readEvents({
      path: FIXTURE_EVENTS_MULTIPROJECT_NOISE_NDJSON,
      cap: 4,
      project: "alpha",
    });
    expect(events).toHaveLength(3);
    expect(events.map((ev) => ev.workOrder)).toEqual(["WO-01-001", "WO-01-002", "WO-01-001"]);
  });

  it("frd-01: WHEN no project is set THEN the global tail keeps every project (backward compat)", () => {
    const { events } = readEvents({ path: FIXTURE_EVENTS_MULTIPROJECT_NOISE_NDJSON });
    expect(events).toHaveLength(9);
  });

  it("frd-01: lastEventAt is derived from the FILTERED tail, not the global one", () => {
    const { lastEventAt } = readEvents({
      path: FIXTURE_EVENTS_MULTIPROJECT_NOISE_NDJSON,
      project: "alpha",
    });
    expect(lastEventAt).toBe("2026-07-01T10:02:00Z");
  });
});
