/**
 * WO-10-015 — Informe operativo: the six-band sober report (RED → GREEN → refactor).
 *
 * Traceability:
 *   AC-10-015.1 — pulse band: verdict + KPI row incl. lead-time "—"/"no cableado"
 *   AC-10-015.2 — time-series band (woVerified + ideas per week), no raw-event-count view
 *   AC-10-015.3 — usage band: workflows + effort; absent stream → "no cableado" (fail-loud)
 *   AC-10-015.4 — funnel + transitions, reopen flagged by icon AND the word
 *   AC-10-015.5 — health band: projects-by-phase + signals incl. "no cableado" telemetry
 *   AC-10-015.6 — next-actions each carry their command string
 *   AC-10-015.8 — sober register: no RPG lore/levels/glow words; Spanish labels
 *
 * Blueprint: CMP-10-informe (FRD-10 blueprint §4)
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type {
  FunnelFlow,
  PhaseTransition,
  UsageMix,
  WeeklyFlow,
} from "@/lib/achievements/report/types";
import type { NextAction } from "@/lib/achievements/report/verdict";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import { Informe } from "../Informe";
import type { InformeData } from "../informeData";

afterEach(cleanup);

// ── Fixture builder ──────────────────────────────────────────────────────────

function buildFunnel(over: Partial<FunnelFlow> = {}): FunnelFlow {
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

function buildWeeklyFlow(over: Partial<WeeklyFlow> = {}): WeeklyFlow {
  return {
    woVerified: [
      { isoWeek: "2026-25", count: 78 },
      { isoWeek: "2026-26", count: 8 },
      { isoWeek: "2026-27", count: 5 },
    ],
    ideasCaptured: [
      { isoWeek: "2026-24", count: 3 },
      { isoWeek: "2026-26", count: 15 },
    ],
    peakWeek: 78,
    ideasWithoutCreated: 0,
    ...over,
  };
}

function buildUsage(over: Partial<UsageMix> = {}): UsageMix {
  return {
    workflows: [
      { name: "deep-research", count: 1494 },
      { name: "pandacorp-build", count: 850 },
      { name: "auditorías / research", count: 400 },
    ],
    effort: [
      { level: "high", count: 1384 },
      { level: "xhigh", count: 937 },
      { level: "max", count: 700 },
      { level: "medium", count: 3 },
    ],
    ...over,
  };
}

const TRANSITIONS: readonly PhaseTransition[] = [
  {
    project: "mission-control",
    date: "2026-06-16",
    from: "architecture",
    to: "implementation",
    isReopen: false,
  },
  {
    project: "mission-control",
    date: "2026-06-18",
    from: "implementation",
    to: "release",
    isReopen: false,
  },
  {
    project: "mission-control",
    date: "2026-06-19",
    from: "release",
    to: "implementation",
    isReopen: true,
  },
  {
    project: "mission-control",
    date: "2026-06-21",
    from: "implementation",
    to: "release",
    isReopen: false,
  },
];

const ACTIONS: readonly NextAction[] = [
  { label: "Destila 131 notas capturadas en lecciones", command: "/pandacorp:memory" },
  {
    label: "Acompaña hasta el lanzamiento 1 construcción en marcha",
    command: "/pandacorp:release",
  },
  { label: "Da criterio a los descartes", command: "/pandacorp:recommend" },
];

function buildData(over: Partial<InformeData> = {}): InformeData {
  return {
    verdict: "Fábrica en marcha: 1 lanzado y 1 en construcción.",
    pulse: {
      woPerWeek: 5,
      woPrevWeek: 8,
      wip: 1,
      wipLabel: "personal-page-v2 · diseño",
      conversionPct: 6,
      launched: 1,
      totalIdeas: 18,
      leadTime: null,
    },
    weeklyFlow: { ok: true, value: buildWeeklyFlow() },
    usage: { ok: true, value: buildUsage() },
    funnel: buildFunnel(),
    transitions: { ok: true, value: [...TRANSITIONS] },
    projectsByPhase: [
      { project: "mission-control", phase: "release" },
      { project: "personal-page-v2", phase: "design" },
    ],
    signals: {
      distilledLessons: 2,
      capturedLessons: 131,
      relaunches: 5,
      discardsWithoutReason: 10,
      qualityTelemetry: null,
    },
    actions: [...ACTIONS],
    ...over,
  };
}

// ── AC-10-015.1 — pulse band ─────────────────────────────────────────────────

describe("Informe · pulse band (AC-10-015.1)", () => {
  it("renders the verdict sentence", () => {
    render(<Informe data={buildData()} />);
    expect(
      screen.getByText(/Fábrica en marcha: 1 lanzado y 1 en construcción/),
    ).toBeInTheDocument();
  });

  it("renders the KPI row (WO/week + delta, WIP, conversion)", () => {
    render(<Informe data={buildData()} />);
    const pulse = screen.getByTestId("informe-pulse");
    expect(within(pulse).getByText("5")).toBeInTheDocument(); // WO/week
    expect(within(pulse).getByText(/5 vs 8/)).toBeInTheDocument(); // delta
    expect(within(pulse).getByText("6")).toBeInTheDocument(); // conversion
  });

  it("renders lead time as '—' with a 'no cableado' label, never a zero", () => {
    render(<Informe data={buildData()} />);
    const lead = screen.getByTestId("informe-lead-time");
    expect(within(lead).getByText("—")).toBeInTheDocument();
    expect(within(lead).getByText(/no cablead|sin cablear/i)).toBeInTheDocument();
    expect(within(lead).queryByText("0")).not.toBeInTheDocument();
  });
});

// ── AC-10-015.2 — time-series band ───────────────────────────────────────────

describe("Informe · time-series band (AC-10-015.2)", () => {
  it("renders the WO-verified-per-week series", () => {
    render(<Informe data={buildData()} />);
    const band = screen.getByTestId("informe-time");
    expect(within(band).getByText("78")).toBeInTheDocument();
    expect(within(band).getByText(/sem 25/)).toBeInTheDocument();
  });

  it("renders the ideas-captured-per-week series", () => {
    render(<Informe data={buildData()} />);
    const band = screen.getByTestId("informe-time");
    expect(within(band).getByText("15")).toBeInTheDocument();
    expect(within(band).getAllByText(/sem 26/).length).toBeGreaterThan(0);
  });

  it("renders 'no cableado' when the git series is absent (fail-loud)", () => {
    render(<Informe data={buildData({ weeklyFlow: { ok: false, reason: "git-unavailable" } })} />);
    const band = screen.getByTestId("informe-time");
    expect(within(band).getAllByText(/no cablead|sin cablear/i).length).toBeGreaterThan(0);
  });
});

// ── AC-10-015.3 — usage band ─────────────────────────────────────────────────

describe("Informe · usage band (AC-10-015.3)", () => {
  it("renders top workflows + effort mix", () => {
    render(<Informe data={buildData()} />);
    const band = screen.getByTestId("informe-usage");
    expect(within(band).getByText("deep-research")).toBeInTheDocument();
    expect(within(band).getByText("1494")).toBeInTheDocument();
    expect(within(band).getByText("high")).toBeInTheDocument();
    expect(within(band).getByText("1384")).toBeInTheDocument();
  });

  it("renders 'no cableado' error state when the event stream is absent (not an empty band)", () => {
    render(<Informe data={buildData({ usage: { ok: false, reason: "git-unavailable" } })} />);
    const band = screen.getByTestId("informe-usage");
    expect(within(band).getAllByText(/no cablead|sin cablear/i).length).toBeGreaterThan(0);
    expect(within(band).queryByText("deep-research")).not.toBeInTheDocument();
  });
});

// ── AC-10-015.4 — funnel + transitions ───────────────────────────────────────

describe("Informe · funnel & flow band (AC-10-015.4)", () => {
  it("renders the ideas→launched funnel", () => {
    render(<Informe data={buildData()} />);
    const band = screen.getByTestId("informe-funnel");
    expect(within(band).getByText("18")).toBeInTheDocument();
    expect(within(band).getByText("1")).toBeInTheDocument();
  });

  it("renders per-project phase transitions with the project name", () => {
    render(<Informe data={buildData()} />);
    const band = screen.getByTestId("informe-funnel");
    expect(within(band).getAllByText("mission-control").length).toBeGreaterThan(0);
    expect(within(band).getAllByText(/implementation/).length).toBeGreaterThan(0);
  });

  it("flags a reopen transition by the word 'Reapertura' (not color alone)", () => {
    render(<Informe data={buildData()} />);
    const band = screen.getByTestId("informe-funnel");
    const reopenRow = within(band).getByTestId("transition-reopen");
    expect(within(reopenRow).getByText(/reapertura/i)).toBeInTheDocument();
    // The reopen icon carries an accessible label/title too (icon + word, WCAG 1.4.1).
    expect(
      reopenRow.querySelector('[aria-label*="eapertura"], [title*="eapertura"]'),
    ).not.toBeNull();
  });

  it("renders 'no cableado' when the transitions series is absent", () => {
    render(<Informe data={buildData({ transitions: { ok: false, reason: "unparseable" } })} />);
    const band = screen.getByTestId("informe-funnel");
    expect(within(band).getByText(/no cablead|sin cablear/i)).toBeInTheDocument();
  });
});

// ── AC-10-015.5 — health band ────────────────────────────────────────────────

describe("Informe · health band (AC-10-015.5)", () => {
  it("renders projects-by-phase", () => {
    render(<Informe data={buildData()} />);
    const band = screen.getByTestId("informe-health");
    expect(within(band).getByText("personal-page-v2")).toBeInTheDocument();
    expect(within(band).getByText("design")).toBeInTheDocument();
  });

  it("renders process signals incl. lessons 2/131 and quality telemetry 'no cableado'", () => {
    render(<Informe data={buildData()} />);
    const band = screen.getByTestId("informe-health");
    expect(within(band).getByText("2 / 131")).toBeInTheDocument();
    const telemetry = within(band).getByTestId("signal-quality-telemetry");
    expect(within(telemetry).getByText(/no cablead|sin cablear/i)).toBeInTheDocument();
    expect(within(telemetry).queryByText("0")).not.toBeInTheDocument();
  });
});

// ── AC-10-015.6 — next-actions band ──────────────────────────────────────────

describe("Informe · next-actions band (AC-10-015.6)", () => {
  it("renders each action with its command string", () => {
    render(<Informe data={buildData()} />);
    const band = screen.getByTestId("informe-actions");
    expect(within(band).getByText("/pandacorp:memory")).toBeInTheDocument();
    expect(within(band).getByText("/pandacorp:release")).toBeInTheDocument();
    expect(within(band).getByText("/pandacorp:recommend")).toBeInTheDocument();
    expect(within(band).getByText(/Destila 131 notas/)).toBeInTheDocument();
  });
});

// ── AC-10-015.8 — sober register ─────────────────────────────────────────────

describe("Informe · sober register (AC-10-015.8)", () => {
  it("renders the six band headers in Spanish", () => {
    render(<Informe data={buildData()} />);
    expect(screen.getByText(/El pulso de la fábrica/i)).toBeInTheDocument();
    expect(screen.getByText(/En el tiempo, de verdad/i)).toBeInTheDocument();
    expect(screen.getByText(/Cómo usas la fábrica/i)).toBeInTheDocument();
    expect(screen.getByText(/Embudo y flujo/i)).toBeInTheDocument();
    expect(screen.getByText(/Estado y salud del proceso/i)).toBeInTheDocument();
    expect(screen.getByText(/Qué mover ahora/i)).toBeInTheDocument();
  });

  it("carries no RPG lore words (Nv/nivel/gremio/leyenda/glow) in the report bands", () => {
    const { container } = render(<Informe data={buildData()} />);
    const report = within(container).getByTestId("informe-report");
    const text = report.textContent ?? "";
    expect(text).not.toMatch(/\bNv \d/);
    expect(text).not.toMatch(/leyenda/i);
  });
});
