/**
 * The weekly flow is two independent halves (FRD-23 REQ-23-001): the WO-verified series (per
 * project, sealed by the `docs/frds` history) and the ideas-per-week series (factory-wide,
 * `factory/ideas` is gitignored, so always live). `composeWeeklyFlow` is the only join.
 */

import { describe, expect, it } from "vitest";
import {
  composeWeeklyFlow,
  deriveIdeasSeries,
  deriveWeeklyFlow,
  deriveWoVerifiedSeries,
  isoWeekKey,
} from "../flowSeries";

describe("deriveWoVerifiedSeries / deriveIdeasSeries: the two halves of the weekly flow", () => {
  it("the WO half buckets by ISO week, exposes its peak and knows nothing about ideas", () => {
    const result = deriveWoVerifiedSeries([
      "2026-06-18T10:00:00Z",
      "2026-06-18T11:00:00Z",
      "2026-06-25T10:00:00Z",
      null,
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.woVerified).toHaveLength(2);
    expect(result.value.peakWeek).toBe(2);
    expect(Object.keys(result.value).sort()).toEqual(["peakWeek", "woVerified"]);
  });

  it("the WO half fails loud on an unparseable date", () => {
    expect(deriveWoVerifiedSeries(["garbage"])).toEqual({ ok: false, reason: "unparseable" });
  });

  it("the ideas half buckets by ISO week and tallies cards without `created`", () => {
    const result = deriveIdeasSeries(["2026-06-11T08:00:00Z", null, null]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ideasCaptured).toEqual([
      { isoWeek: isoWeekKey(new Date("2026-06-11T08:00:00Z")), count: 1 },
    ]);
    expect(result.value.ideasWithoutCreated).toBe(2);
  });

  it("the ideas half fails loud on an unparseable date", () => {
    expect(deriveIdeasSeries(["garbage"])).toEqual({ ok: false, reason: "unparseable" });
  });

  it("composeWeeklyFlow joins the halves into exactly what deriveWeeklyFlow produces", () => {
    const verifiedAt = ["2026-06-18T10:00:00Z"];
    const ideasCreated = ["2026-06-11T08:00:00Z", null];
    const wo = deriveWoVerifiedSeries(verifiedAt);
    const ideas = deriveIdeasSeries(ideasCreated);
    if (!wo.ok || !ideas.ok) throw new Error("fixture must derive");
    expect(deriveWeeklyFlow({ verifiedAt, ideasCreated })).toEqual({
      ok: true,
      value: composeWeeklyFlow(wo.value, ideas.value),
    });
  });
});
