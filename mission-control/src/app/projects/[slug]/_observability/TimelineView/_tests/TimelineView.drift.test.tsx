/**
 * TimelineView shows the FRD drift badge in both layouts (FRD-12 AC-12-003.3): structural and
 * durations. The badge derives from each FRD's `drift` result; nothing else is stored.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BuildTimeline, TLFrd } from "@/lib/build-track/build-track";
import { TimelineView } from "../TimelineView";

const T0 = Date.parse("2026-09-30T10:00:00Z");
const MIN = 60_000;

function frd(id: string, drift: TLFrd["drift"], timed: boolean): TLFrd {
  return {
    id,
    label: id.slice(0, 6).toUpperCase(),
    startMs: timed ? T0 : null,
    endMs: timed ? T0 + 10 * MIN : null,
    state: "done",
    workOrders: [
      {
        id: "WO-02-001",
        title: "Board",
        frd: id,
        state: "done",
        startMs: timed ? T0 : null,
        endMs: timed ? T0 + 10 * MIN : null,
        durationMin: timed ? 10 : null,
        attempts: 1,
      },
    ],
    review: null,
    drift,
  };
}

function timeline(timed: boolean): BuildTimeline {
  return {
    frds: [
      frd("frd-02-ideas-board", { ok: true, ids: ["AC-02-010.4", "REQ-03-001"] }, timed),
      frd("frd-03-portfolio", { ok: true, ids: [] }, timed),
    ],
    hasDurations: timed,
    source: timed ? "track" : "structural",
    buildStartMs: timed ? T0 : null,
  };
}

describe("TimelineView: FRD drift badge", () => {
  it.each([
    ["durations", true],
    ["structural", false],
  ] as const)("%s layout: a verified FRD with drift shows 'Verificado · 2 derivas'", (_mode, timed) => {
    render(<TimelineView timeline={timeline(timed)} project="alpha" />);
    expect(screen.getByRole("link", { name: /Verificado · 2 derivas/ })).toHaveAttribute(
      "href",
      "?project=alpha&tab=changes",
    );
  });

  it.each([
    ["durations", true],
    ["structural", false],
  ] as const)("%s layout: a FRD without drift shows no badge", (_mode, timed) => {
    render(<TimelineView timeline={timeline(timed)} project="alpha" />);
    expect(screen.queryByTestId("frd-drift-badge-frd-03-portfolio")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /deriva/ })).toHaveLength(1);
  });
});
