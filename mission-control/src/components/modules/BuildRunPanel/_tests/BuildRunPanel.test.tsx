import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BuildRunPanel } from "../BuildRunPanel";
import { performance, run, unit } from "./fixture";

describe("Day 1 build panel, FRD-04/12", () => {
  it("AC-04-020.1 separates the ceiling from live LLM units and keeps running work during disk wait", () => {
    render(<BuildRunPanel run={run()} />);
    expect(screen.getByRole("heading", { name: "Build en curso" })).toBeVisible();
    expect(screen.getAllByRole("definition")).toHaveLength(3);
    expect(screen.getByText("3", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("2", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("disco", { selector: "dd" })).toBeVisible();
    expect(
      screen.getByText("Esperando espacio en disco. El trabajo existente puede continuar."),
    ).toBeVisible();
    expect(screen.getByText("En ejecución (2)")).toBeVisible();
  });
  it("AC-04-020.2 keeps gates and parked questions explicit with exact decide IDs", () => {
    const data = run();
    if (!data.state) throw new Error("fixture");
    data.state.status = "waiting_gate";
    data.live = false;
    data.state.units = [
      unit({ state: "waiting_gate", waiting_gate: "production" }),
      unit({ id: "parked", state: "parked", pending_answer: "d-R1", parked: "owner_question" }),
    ];
    render(
      <BuildRunPanel
        run={data}
        decisions={[
          {
            id: "d-R1",
            engineId: true,
            title: "Elegir alcance",
            date: null,
            status: "pending",
            resolved: false,
          },
        ]}
      />,
    );
    expect(screen.getAllByText("Aprobación pendiente: Producción")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Copiar.*decide d-R1/ })).toBeVisible();
    expect(screen.getAllByText("lane/run-a/u-build")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /aprobar/i })).not.toBeInTheDocument();
  });
  it("AC-04-020.3 shows missing and malformed sources without claiming live progress", () => {
    const data = {
      ...run(),
      present: false,
      state: null,
      live: false,
      errors: [{ path: "state.json", reason: "schema inválido" }],
    };
    render(<BuildRunPanel run={data} />);
    expect(screen.getByText("Sin build")).toBeVisible();
    expect(screen.getByText("state.json")).toBeVisible();
    expect(screen.getByText(/schema inválido/)).toBeVisible();
    expect(screen.getByText("Sin datos aún")).toBeVisible();
  });
  it("AC-12-007.1/2/3 shows retrospective metrics, nulls and basename ambiguity", () => {
    render(<BuildRunPanel run={{ ...run(), performance: [performance()] }} />);
    expect(screen.getByText(/Identificación solo por nombre de carpeta/)).toBeVisible();
    fireEvent.click(screen.getByText("run-a · finished · 2026-11-12T12:00:00Z"));
    const table = screen.getByRole("table", { name: "Unidades por estado" });
    expect(within(table).getByRole("cell", { name: "Sin datos" })).toBeVisible();
    expect(
      screen.getByRole("table", { name: "Muestras de concurrencia, no una traza completa" }),
    ).toBeVisible();
    expect(screen.getByText("RAM disponible (GiB), mín. / máx.")).toBeVisible();
    expect(screen.getByText("120", { selector: "dd" })).toBeVisible();
  });
});

it("keeps branch verification and stale execution distinct from delivery", () => {
  const data = run();
  if (!data.state) throw new Error("fixture");
  data.live = false;
  data.state.units = [unit({ state: "verified" })];
  render(
    <BuildRunPanel
      run={data}
      handbackDrafts={[".pandacorp/run/build/handback/engine-backlog-run-a.md"]}
    />,
  );
  expect(screen.getByText(/Sin señal/)).toBeVisible();
  expect(screen.getByText("Verificado en rama, pendiente de llegar a main")).toBeVisible();
  expect(screen.getByText(/Borrador local de fallo del motor/)).toBeVisible();
  expect(screen.queryByText("En main (1)")).not.toBeInTheDocument();
});
