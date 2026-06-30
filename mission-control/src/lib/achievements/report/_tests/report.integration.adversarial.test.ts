/**
 * ADVERSARIAL integration test (reviewer-authored, FRD-10 gate, DR-015).
 *
 * The implementers' tests drive the PURE cores with hand-built fixtures. This one
 * exercises the REAL readers end-to-end against the LIVE factory data the running app
 * reads, proving the honesty contract (DR-078, REQ-10-020) holds with reality — not a
 * fabricated zero, not a silent [].
 *
 * It deliberately probes the seams the unit tests do not:
 *  - the git-backed readers either return a REAL value OR an explicit absent (never a bare []);
 *  - funnelAndFlow over the real ideas/statuses never invents a conversion (0..100, finite);
 *  - buildInformeData composes the live readers without throwing and keeps every unwired
 *    figure (lead-time, quality telemetry) as a literal null — the cross-WO honesty seam.
 */

import { describe, expect, it } from "vitest";
import { buildInformeData } from "@/app/achievements/Informe/informeData";
import { readEvents } from "@/lib/events/events";
import { getGuildState } from "@/lib/gamification/guildState";
import { readIdeas } from "@/lib/ideas/ideas";
import { signalsFor } from "../../signals";
import { weeklyFlow } from "../flowSeries";
import { funnelAndFlow } from "../funnel";
import { lessonCounts } from "../lessons";
import { phaseTransitions } from "../phaseTransitions";
import { usageMix } from "../usage";

const PROJECT_PATH = process.cwd();

describe("report · live readers honour the fail-loud contract (DR-078)", () => {
  it("weeklyFlow returns a discriminated result — a real value OR explicit absent, never a bare []", () => {
    const result = weeklyFlow(PROJECT_PATH);
    expect(typeof result.ok).toBe("boolean");
    if (result.ok) {
      // Every bucket is a real, finite, non-negative count.
      for (const b of result.value.woVerified) {
        expect(Number.isFinite(b.count)).toBe(true);
        expect(b.count).toBeGreaterThanOrEqual(0);
        expect(b.isoWeek).toMatch(/^\d{4}-\d{2}$/);
      }
      // peakWeek is the max of the series (or 0 on an empty series) — never fabricated.
      const max = result.value.woVerified.reduce((m, b) => Math.max(m, b.count), 0);
      expect(result.value.peakWeek).toBe(max);
      expect(result.value.ideasWithoutCreated).toBeGreaterThanOrEqual(0);
    } else {
      expect(["git-unavailable", "unparseable"]).toContain(result.reason);
    }
  });

  it("phaseTransitions returns a discriminated result and never fabricates a transition", () => {
    const result = phaseTransitions();
    expect(typeof result.ok).toBe("boolean");
    if (result.ok) {
      for (const t of result.value) {
        expect(t.project.length).toBeGreaterThan(0);
        expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(t.from).not.toBe(t.to); // a transition is a real change
        expect(typeof t.isReopen).toBe("boolean");
      }
    } else {
      expect(["git-unavailable", "unparseable"]).toContain(result.reason);
    }
  });

  it("lessonCounts is either real counts or an explicit null (no cableado), never a fabricated {0,0} when absent", () => {
    const lc = lessonCounts();
    if (lc !== null) {
      expect(lc.distilled).toBeGreaterThanOrEqual(0);
      expect(lc.captured).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(lc.distilled)).toBe(true);
      expect(Number.isFinite(lc.captured)).toBe(true);
    }
    // null is the explicit "no cableado" — also acceptable, the UI renders it as such.
  });
});

describe("report · funnel never invents a conversion over the REAL ideas/statuses", () => {
  it("conversionPct is finite, bounded 0..100, and 0 when there are no ideas", () => {
    const ideas = readIdeas();
    const { statuses } = getGuildState();
    const f = funnelAndFlow(ideas, statuses);

    expect(Number.isFinite(f.conversionPct)).toBe(true);
    expect(f.conversionPct).toBeGreaterThanOrEqual(0);
    expect(f.conversionPct).toBeLessThanOrEqual(100);
    expect(f.totalIdeas).toBe(ideas.length);
    if (ideas.length === 0) expect(f.conversionPct).toBe(0);

    // byStatus has EVERY bucket (never a missing key that reads as undefined → NaN downstream).
    for (const key of [
      "discovered",
      "recommended",
      "in-pipeline",
      "shipped",
      "discarded",
    ] as const) {
      expect(typeof f.byStatus[key]).toBe("number");
    }
    // The status tally sums to the total — no card silently dropped.
    const tallied = Object.values(f.byStatus).reduce((s, n) => s + n, 0);
    expect(tallied).toBe(f.totalIdeas);

    // launched ≤ total, conversion is exactly round(launched/total*100).
    expect(f.launched).toBeLessThanOrEqual(f.totalIdeas);
    if (f.totalIdeas > 0) {
      expect(f.conversionPct).toBe(Math.round((f.launched / f.totalIdeas) * 100));
    }
  });
});

describe("report · buildInformeData composes the LIVE readers without fabrication (cross-WO seam)", () => {
  it("assembles the six-band data and keeps every unwired figure as a literal null", () => {
    const ideas = readIdeas();
    const { statuses } = getGuildState();
    const eventsSnapshot = readEvents({ cap: 100_000 });
    const readerData = { ideas, statuses, eventsSnapshot } as const;

    const usageResult =
      eventsSnapshot.events.length === 0 && eventsSnapshot.lastEventAt === null
        ? ({ ok: false, reason: "git-unavailable" } as const)
        : ({ ok: true, value: usageMix(readerData) } as const);

    const data = buildInformeData({
      weeklyFlow: weeklyFlow(PROJECT_PATH),
      usage: usageResult,
      funnel: funnelAndFlow(ideas, statuses),
      transitions: phaseTransitions(),
      statuses,
      lessons: lessonCounts(),
      relaunches: signalsFor(readerData).relaunches,
    });

    // Honesty seam: lead-time + quality telemetry are ALWAYS the explicit null (no cableado).
    expect(data.pulse.leadTime).toBeNull();
    expect(data.signals.qualityTelemetry).toBeNull();

    // The verdict is a non-empty deterministic sentence; actions all carry a real command.
    expect(data.verdict.length).toBeGreaterThan(0);
    for (const a of data.actions) {
      expect(a.command).toMatch(/^\/pandacorp:(memory|release|recommend)$/);
      expect(a.label.length).toBeGreaterThan(0);
    }

    // The git-backed bands keep their discriminated shape (the UI branches on .ok).
    expect(typeof data.weeklyFlow.ok).toBe("boolean");
    expect(typeof data.transitions.ok).toBe("boolean");
    expect(typeof data.usage.ok).toBe("boolean");
  });
});
