/**
 * toWoStates — map authoritative WorkOrder[] frontmatter state to the Party's
 * per-WO visual WoState (DR-092 single source for the Party room placement).
 *
 * Traceability: AC-06-001.6 (Party agrees with the Work Orders board).
 */

import { describe, expect, it } from "vitest";

import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { toWoStates } from "../fragua-snapshot/wo-states";

function wo(id: string, state: WorkOrder["state"]): WorkOrder {
  return { id, title: id, frd: "frd-02-home-positioning", state, relPath: `x/${id}.md` };
}

describe("toWoStates — WorkOrderState → WoState mapping", () => {
  it("maps review → in_review", () => {
    expect(toWoStates([wo("WO-02-001", "review")])).toEqual({ "WO-02-001": "in_review" });
  });

  it("maps done → verified", () => {
    expect(toWoStates([wo("WO-02-002", "done")])).toEqual({ "WO-02-002": "verified" });
  });

  it("maps fail → blocked", () => {
    expect(toWoStates([wo("WO-02-003", "fail")])).toEqual({ "WO-02-003": "blocked" });
  });

  it("maps in_progress and todo → building", () => {
    expect(toWoStates([wo("WO-02-004", "in_progress"), wo("WO-02-005", "todo")])).toEqual({
      "WO-02-004": "building",
      "WO-02-005": "building",
    });
  });

  it("returns an empty map for no work orders", () => {
    expect(toWoStates([])).toEqual({});
  });

  it("keys every work order by its id", () => {
    const map = toWoStates([wo("WO-02-001", "review"), wo("WO-02-002", "done")]);
    expect(Object.keys(map).sort()).toEqual(["WO-02-001", "WO-02-002"]);
  });
});
