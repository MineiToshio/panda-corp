import path from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadStatisticsData } from "../../_components/Stats/loadStatisticsData";
import { StatisticsTab } from "../../_components/Stats/StatisticsTab";

beforeEach(() => {
  const fixtures = path.resolve("docs/design/prototype/fixtures");
  vi.stubEnv("PANDACORP_FACTORY_ROOT", path.join(fixtures, "factory-root"));
  vi.stubEnv("MC_GIT_FIXTURE", path.join(fixtures, "git-state.json"));
  vi.stubEnv("MC_CLOCK", "2026-10-21T00:20:00Z");
  vi.stubEnv("PANDACORP_EVENTS_FILE", path.join(fixtures, "home/.claude/dashboard-events.ndjson"));
  vi.stubEnv("PANDACORP_CODEX_EVENTS_FILE", "");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

// Expectations transcribed from data/extras.js guild.stats, never generated from the loader.
describe("Statistics fixture-factory oracle", () => {
  it("AC-10-020.1 AC-10-020.2 AC-10-020.3: verdict and four real KPIs, with unwired lead time", () => {
    const data = loadStatisticsData();
    render(<StatisticsTab {...data} />);
    expect(data.informeData.verdict).toBe("Fábrica en marcha: 1 lanzado(s) y 4 en construcción.");
    expect(data.informeData.pulse).toMatchObject({
      woPerWeek: 2,
      woPrevWeek: 2,
      wip: 4,
      conversionPct: 5,
      launched: 1,
      totalIdeas: 22,
      leadTime: null,
    });
    expect(screen.getByText(data.informeData.verdict)).toBeVisible();
    const pulse = screen.getByTestId("informe-pulse");
    expect(within(pulse).getAllByRole("article")).toHaveLength(4);
    expect(within(pulse).getByText("↑ 2 vs 2 la previa")).toBeVisible();
    expect(within(pulse).getByRole("article", { name: "Lead time" })).toHaveTextContent(
      "— idea→release",
    );
    expect(within(pulse).getByText("no cableado")).toBeVisible();
  });
  it("AC-10-021.1 AC-10-021.2 AC-10-021.3: oracle weekly series, accessible charts and observable undated exclusions", () => {
    const data = loadStatisticsData();
    expect(data.informeData.weeklyFlow).toEqual({
      ok: true,
      value: {
        woVerified: [
          { isoWeek: "2026-25", count: 76 },
          { isoWeek: "2026-26", count: 10 },
          { isoWeek: "2026-27", count: 11 },
          { isoWeek: "2026-28", count: 8 },
          { isoWeek: "2026-36", count: 2 },
          { isoWeek: "2026-39", count: 2 },
        ],
        ideasCaptured: [
          { isoWeek: "2026-24", count: 3 },
          { isoWeek: "2026-26", count: 15 },
          { isoWeek: "2026-27", count: 2 },
          { isoWeek: "2026-28", count: 1 },
          { isoWeek: "2026-42", count: 1 },
        ],
        peakWeek: 76,
        ideasWithoutCreated: 0,
      },
    });
    const flow = data.informeData.weeklyFlow;
    if (!flow.ok) throw new Error("oracle unavailable");
    render(
      <StatisticsTab
        {...data}
        informeData={{
          ...data.informeData,
          weeklyFlow: { ok: true, value: { ...flow.value, ideasWithoutCreated: 2 } },
        }}
      />,
    );
    expect(
      screen.getByRole("img", { name: /sem 2026-25: 76 work orders.*sem 2026-39: 2 work orders/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: /sem 2026-24: 3 ideas.*sem 2026-42: 1 ideas/ }),
    ).toBeVisible();
    expect(screen.getByText(/Ideas capturadas por semana: 2/)).toHaveTextContent("Sin fecha");
    expect(screen.queryByText(/conteo de eventos|eventos por semana/i)).not.toBeInTheDocument();
  });
  it("AC-10-022.1 AC-10-022.2 AC-10-022.3: empty usage stays distinct from a coral read error and leaves other bands intact", () => {
    const data = loadStatisticsData();
    const view = render(<StatisticsTab {...data} />);
    expect(screen.getByText(/Sin eventos de uso en el registro todavía/)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    view.rerender(
      <StatisticsTab
        {...data}
        usageHealth={{ ok: false, kind: "invalid-json", source: "/fixture/events", line: 214 }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-tone", "coral");
    expect(screen.getByRole("alert")).toHaveTextContent("invalid-json: 214");
    expect(screen.getAllByText("Sin datos: el registro no se pudo leer.")).toHaveLength(2);
    expect(screen.getByText(data.informeData.verdict)).toBeVisible();
  });
  it("AC-10-023.1 AC-10-023.2 AC-10-023.3 AC-10-028.5: real funnel, reopening cues, exactly ten more transitions per press", () => {
    const data = loadStatisticsData();
    render(<StatisticsTab {...data} />);
    expect(data.informeData.funnel).toMatchObject({
      totalIdeas: 22,
      launched: 1,
      conversionPct: 5,
      wip: 4,
    });
    const list = screen.getByRole("list", { name: "Transiciones de fase por proyecto" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(within(list).getByText("Reapertura")).toHaveAttribute("data-tone", "amber");
    const reopened = within(list).getAllByRole("listitem")[9];
    expect(reopened).toHaveTextContent("06-19");
    expect(reopened).toHaveTextContent("Pandacorp (Mission Control)");
    expect(reopened).toHaveTextContent("↺");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 10 más · quedan 10" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(20);
    expect(screen.queryByRole("button", { name: /Mostrar/ })).not.toBeInTheDocument();
  });
  it("AC-10-024.1 AC-10-024.2 AC-10-025.1: oracle project phases, source-backed health and single copy-only action", () => {
    const data = loadStatisticsData();
    render(<StatisticsTab {...data} />);
    expect(data.informeData.projectsByPhase).toEqual([
      { project: "PersonalPage v2", phase: "release" },
      { project: "Funko Tracker", phase: "implementation" },
      { project: "Pandacorp", phase: "implementation" },
      { project: "PandaCast", phase: "architecture" },
      { project: "PandaSaga", phase: "architecture" },
    ]);
    expect(data.informeData.signals).toMatchObject({
      distilledLessons: 36,
      capturedLessons: 65,
      discardsWithoutReason: 7,
      qualityTelemetry: null,
    });
    expect(within(screen.getByTestId("informe-health")).getByText("36 / 65")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:release" })).toBeVisible();
    expect(within(screen.getByTestId("informe-actions")).getAllByRole("button")).toHaveLength(1);
  });
  it("AC-10-026.1 AC-10-026.2 AC-10-027.1 AC-10-028.5: six records, three eight-row ledgers, null and never-recorded states", () => {
    const data = loadStatisticsData();
    render(<StatisticsTab {...data} />);
    expect(data.statsScalars).toEqual({
      frds: 26,
      commits: 1762,
      decisions: 48,
      projects: 5,
      testsPassing: null,
    });
    const ledgers = ["Producción", "Calidad", "Ritmo y alcance"].map((name) =>
      screen.getByRole("region", { name }),
    );
    expect(ledgers).toHaveLength(3);
    for (const ledger of ledgers) expect(within(ledger).getAllByRole("listitem")).toHaveLength(8);
    expect(
      within(screen.getByRole("region", { name: "Atributos del gremio" })).getAllByRole("article"),
    ).toHaveLength(6);
    expect(data.statsRecords).toEqual({ peakWeek: 76, capturedLessons: 65, subagents: 0 });
    expect(screen.getByRole("article", { name: "Subagentes" })).toHaveTextContent("0");
    expect(screen.getByRole("article", { name: "Subagentes" })).not.toHaveTextContent(
      "sin datos aún",
    );
    expect(screen.getByRole("listitem", { name: "Tests en verde" })).toHaveTextContent(
      "— no cableado",
    );
    expect(screen.getByText(/No es un cero medido/)).toBeVisible();
  });
  it("source failures and empty transitions remain local honest states", () => {
    const data = loadStatisticsData();
    render(
      <StatisticsTab
        {...data}
        informeData={{
          ...data.informeData,
          weeklyFlow: { ok: false, reason: "git-unavailable" },
          transitions: { ok: true, value: [] },
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo leer la serie semanal.");
    expect(screen.getByText("Sin transiciones registradas.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Cómo usas la fábrica" })).toBeVisible();
  });

  it("AC-10-028.5: a list longer than two pages reveals ten, then the final remainder", () => {
    const data = loadStatisticsData();
    const transitions = data.informeData.transitions;
    if (!transitions.ok) throw new Error("oracle unavailable");
    const rows = [...transitions.value, ...transitions.value.slice(0, 5)];
    render(
      <StatisticsTab
        {...data}
        informeData={{ ...data.informeData, transitions: { ok: true, value: rows } }}
      />,
    );
    const list = screen.getByRole("list", { name: "Transiciones de fase por proyecto" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 10 más · quedan 15" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 5 más · quedan 5" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(25);
  });
});
