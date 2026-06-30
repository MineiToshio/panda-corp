/**
 * WO-10-015 — buildInformeData pure assembly (RED → GREEN).
 *
 * Asserts the Informe data is composed honestly from the WO-10-014 reader outputs:
 *   - lead-time + quality telemetry are carried as `null` (never a fabricated zero);
 *   - WO/week + previous come from the tail of the flow series;
 *   - projects-by-phase + WIP label are derived from statuses;
 *   - verdict/actions come from the pure rule functions.
 *
 * Traceability: AC-10-015.1 / .5 (honesty), supports REQ-10-020..025.
 */

import { describe, expect, it } from "vitest";
import type { FunnelFlow, Phase } from "@/lib/achievements/report/types";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import type { StatusResult } from "@/lib/status/status";
import { buildInformeData, type InformeInputs } from "../informeData";

function funnel(over: Partial<FunnelFlow> = {}): FunnelFlow {
  const byStatus: Record<IdeaStatus, number> = {
    discovered: 6,
    recommended: 0,
    "in-pipeline": 2,
    shipped: 0,
    discarded: 10,
  };
  return {
    totalIdeas: 18,
    byStatus,
    launched: 1,
    conversionPct: 6,
    wip: 1,
    discardsWithoutReason: 10,
    ...over,
  };
}

function status(project: string, phase: Phase): StatusResult {
  return {
    present: true,
    malformed: false,
    status: { project, phase },
  };
}

function inputs(over: Partial<InformeInputs> = {}): InformeInputs {
  return {
    weeklyFlow: {
      ok: true,
      value: {
        woVerified: [
          { isoWeek: "2026-25", count: 78 },
          { isoWeek: "2026-26", count: 8 },
          { isoWeek: "2026-27", count: 5 },
        ],
        ideasCaptured: [{ isoWeek: "2026-26", count: 15 }],
        peakWeek: 78,
        ideasWithoutCreated: 0,
      },
    },
    usage: { ok: true, value: { workflows: [], effort: [] } },
    funnel: funnel(),
    transitions: { ok: true, value: [] },
    statuses: [status("mission-control", "release"), status("personal-page-v2", "design")],
    lessons: { distilled: 2, captured: 131 },
    relaunches: 5,
    ...over,
  };
}

describe("buildInformeData", () => {
  it("derives WO/week and the previous week from the flow-series tail", () => {
    const data = buildInformeData(inputs());
    expect(data.pulse.woPerWeek).toBe(5);
    expect(data.pulse.woPrevWeek).toBe(8);
  });

  it("carries lead-time and quality telemetry as null (never a fabricated zero)", () => {
    const data = buildInformeData(inputs());
    expect(data.pulse.leadTime).toBeNull();
    expect(data.signals.qualityTelemetry).toBeNull();
  });

  it("derives projects-by-phase and a WIP label from the statuses", () => {
    const data = buildInformeData(inputs());
    expect(data.projectsByPhase.map((p) => p.project)).toContain("personal-page-v2");
    expect(data.pulse.wipLabel).toMatch(/personal-page-v2/);
  });

  it("surfaces the lesson counts in the health signals", () => {
    const data = buildInformeData(inputs());
    expect(data.signals.distilledLessons).toBe(2);
    expect(data.signals.capturedLessons).toBe(131);
  });

  it("carries lessons as null when the memory source is absent", () => {
    const data = buildInformeData(inputs({ lessons: null }));
    expect(data.signals.distilledLessons).toBeNull();
    expect(data.signals.capturedLessons).toBeNull();
  });

  it("produces a non-empty verdict and at least one next action with a command", () => {
    const data = buildInformeData(inputs());
    expect(data.verdict.length).toBeGreaterThan(0);
    expect(data.actions.length).toBeGreaterThan(0);
    expect(data.actions[0]?.command).toMatch(/^\/pandacorp:/);
  });

  it("zeroes the WO week counts when the flow series is absent (fail-loud upstream)", () => {
    const data = buildInformeData(inputs({ weeklyFlow: { ok: false, reason: "git-unavailable" } }));
    expect(data.pulse.woPerWeek).toBe(0);
    expect(data.pulse.woPrevWeek).toBe(0);
    expect(data.weeklyFlow.ok).toBe(false);
  });
});
