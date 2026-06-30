/**
 * RED → GREEN tests for IF-10-funnel (`funnelAndFlow`), WO-10-014, AC-10-014.4.
 *
 * Pure over readIdeas + readStatus — no new I/O. Asserts the funnel, WIP, status
 * breakdown, conversion and discards-without-reason hygiene signal.
 */

import { describe, expect, it } from "vitest";
import type { IdeaCard, IdeaStatus } from "../../../ideas/ideas";
import type { Phase, StatusResult } from "../../../status/status";
import { funnelAndFlow } from "../funnel";

function idea(status: IdeaStatus, over: Partial<IdeaCard> = {}): IdeaCard {
  return { slug: over.slug ?? `${status}-x`, title: "t", status, body: "", ...over };
}

function statusOf(phase: Phase): StatusResult {
  return { present: true, malformed: false, status: { phase } };
}

describe("funnelAndFlow — real shape", () => {
  it("computes funnel 18→1 (≈6%), WIP=1, the status breakdown and discards-without-reason", () => {
    const ideas: IdeaCard[] = [
      ...Array.from({ length: 6 }, (_, i) => idea("discovered", { slug: `disc-${i}` })),
      ...Array.from({ length: 2 }, (_, i) => idea("in-pipeline", { slug: `pipe-${i}` })),
      // 10 discarded: 4 with a reason, 6 without
      ...Array.from({ length: 4 }, (_, i) =>
        idea("discarded", { slug: `dr-${i}`, discardReason: "reason" }),
      ),
      ...Array.from({ length: 6 }, (_, i) => idea("discarded", { slug: `dn-${i}` })),
    ];
    // statuses: one launched (release), one WIP (implementation)
    const statuses: StatusResult[] = [statusOf("release"), statusOf("implementation")];

    const flow = funnelAndFlow(ideas, statuses);

    expect(flow.totalIdeas).toBe(18);
    expect(flow.launched).toBe(1);
    expect(flow.conversionPct).toBe(6); // round(1/18*100) = 6
    expect(flow.wip).toBe(1);
    expect(flow.byStatus.discovered).toBe(6);
    expect(flow.byStatus["in-pipeline"]).toBe(2);
    expect(flow.byStatus.discarded).toBe(10);
    expect(flow.discardsWithoutReason).toBe(6);
  });

  it("WIP counts design/architecture/implementation only (not product, not release)", () => {
    const statuses: StatusResult[] = [
      statusOf("product"),
      statusOf("design"),
      statusOf("architecture"),
      statusOf("implementation"),
      statusOf("release"),
    ];
    const flow = funnelAndFlow([], statuses);
    expect(flow.wip).toBe(3);
  });

  it("no ideas → conversion 0 (no divide-by-zero), every status bucket present", () => {
    const flow = funnelAndFlow([], []);
    expect(flow.totalIdeas).toBe(0);
    expect(flow.conversionPct).toBe(0);
    expect(flow.byStatus.discovered).toBe(0);
    expect(flow.byStatus.recommended).toBe(0);
    expect(flow.byStatus["in-pipeline"]).toBe(0);
    expect(flow.byStatus.shipped).toBe(0);
    expect(flow.byStatus.discarded).toBe(0);
  });
});
