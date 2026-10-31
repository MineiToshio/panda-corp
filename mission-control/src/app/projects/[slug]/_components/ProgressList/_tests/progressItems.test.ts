import { describe, expect, it } from "vitest";
import type { BuildTimeline } from "@/lib/build-track/build-track";
import type { ChangeQueueItem } from "@/lib/changes/changes";
import { progressItems } from "../progressItems";

function change(id: string, date: string, status: ChangeQueueItem["status"]): ChangeQueueItem {
  return {
    id,
    date,
    status,
    title: id,
    type: "change",
    cls: "standard",
    frd: "",
    rebuildsVerified: false,
    dependsOn: "",
    implementedSha: "",
    closingAt: "",
    body: "",
  };
}
const timeline: BuildTimeline = {
  source: "track",
  hasDurations: true,
  buildStartMs: null,
  frds: [
    {
      id: "frd-01-reading",
      label: "FRD-01",
      startMs: null,
      endMs: null,
      state: "done",
      review: null,
      workOrders: [
        {
          id: "WO-01-001",
          title: "one",
          frd: "frd-01-reading",
          state: "done",
          startMs: null,
          endMs: Date.parse("2026-10-20T12:00:00Z"),
          durationMin: null,
          attempts: 1,
        },
        {
          id: "WO-01-002",
          title: "two",
          frd: "frd-01-reading",
          state: "done",
          startMs: null,
          endMs: Date.parse("2026-10-20T13:00:00Z"),
          durationMin: null,
          attempts: 1,
        },
        {
          id: "WO-01-003",
          title: "review",
          frd: "frd-01-reading",
          state: "review",
          startMs: null,
          endMs: Date.parse("2026-10-30T12:00:00Z"),
          durationMin: null,
          attempts: 1,
        },
      ],
    },
  ],
};
describe("structured progress", () => {
  it("AC-04-014.7: groups verified orders by day, excludes review, and compares offset dates as instants", () => {
    const items = progressItems(
      timeline,
      [
        change("older", "2026-10-21T01:00:00+02:00", "ready"),
        change("newer", "2026-10-20T23:30:00Z", "done"),
        change("undated", "", "draft"),
      ],
      "/projects/demo/summary",
    );
    expect(items.map((item) => item.subject)).toEqual(["newer", "older", "FRD-01"]);
    expect(items[2]?.label).toBe("2 work orders verificadas");
    expect(items[0]?.href).toBe("/projects/demo/changes?change=newer");
    expect(items[1]?.label).toBe("Listo para construir");
  });
  it("AC-04-014.7: caps the feed at six and never fabricates dates from a structural or git timeline", () => {
    expect(progressItems({ ...timeline, source: "git" }, [], "/projects/demo/summary")).toEqual([]);
    const items = progressItems(
      timeline,
      Array.from({ length: 8 }, (_, i) => change(`change-${i}`, `2026-10-${21 + i}`, "building")),
      "/projects/demo/summary",
    );
    expect(items).toHaveLength(6);
    expect(items[0]?.subject).toBe("change-7");
  });
});
