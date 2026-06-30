/**
 * RED → GREEN tests for IF-10-usage (`usageMix`), WO-10-014, AC-10-014.4.
 *
 * Pure over the already-read `eventsSnapshot` — no new fs. Asserts the top workflows
 * (from SubagentStop background-task names) + the effort mix, both descending.
 */

import { describe, expect, it } from "vitest";
import type { Event, EventsSnapshot } from "../../../events/events";
import type { ReaderData } from "../../readerData";
import { usageMix } from "../usage";

function ev(over: Partial<Event> & Pick<Event, "event">): Event {
  return { at: "2026-06-20T10:00:00Z", ...over };
}

function snapshot(events: Event[]): EventsSnapshot {
  return { events, lastEventAt: null, byProject: {} };
}

function readerData(events: Event[]): ReaderData {
  return { ideas: [], statuses: [], eventsSnapshot: snapshot(events) };
}

describe("usageMix — real shape", () => {
  it("returns top workflows descending + the effort mix descending", () => {
    const events: Event[] = [
      ...Array.from({ length: 1494 }, () =>
        ev({ event: "SubagentStop", workflows: ["deep-research"], effortLevel: "high" }),
      ),
      ...Array.from({ length: 850 }, () =>
        ev({ event: "SubagentStop", workflows: ["pandacorp-build"], effortLevel: "xhigh" }),
      ),
      ...Array.from({ length: 400 }, () =>
        ev({ event: "SubagentStop", workflows: ["audits-research"], effortLevel: "max" }),
      ),
      ...Array.from({ length: 3 }, () =>
        ev({ event: "SubagentStop", workflows: ["misc"], effortLevel: "medium" }),
      ),
    ];

    const mix = usageMix(readerData(events));

    expect(mix.workflows.slice(0, 3)).toEqual([
      { name: "deep-research", count: 1494 },
      { name: "pandacorp-build", count: 850 },
      { name: "audits-research", count: 400 },
    ]);
    // descending by count
    const counts = mix.workflows.map((w) => w.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);

    const effort = Object.fromEntries(mix.effort.map((e) => [e.level, e.count]));
    expect(effort.high).toBe(1494);
    expect(effort.xhigh).toBe(850);
    expect(effort.max).toBe(400);
    expect(effort.medium).toBe(3);
    const effortCounts = mix.effort.map((e) => e.count);
    expect([...effortCounts].sort((a, b) => b - a)).toEqual(effortCounts);
  });

  it("an event carrying multiple workflow names counts each", () => {
    const mix = usageMix(
      readerData([ev({ event: "SubagentStop", workflows: ["a", "b"], effortLevel: "high" })]),
    );
    const wf = Object.fromEntries(mix.workflows.map((w) => [w.name, w.count]));
    expect(wf.a).toBe(1);
    expect(wf.b).toBe(1);
  });

  it("no snapshot → empty (honest, pure)", () => {
    const mix = usageMix({ ideas: [], statuses: [], eventsSnapshot: null });
    expect(mix.workflows).toEqual([]);
    expect(mix.effort).toEqual([]);
  });
});
