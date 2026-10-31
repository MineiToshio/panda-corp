import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ColumnChart } from "../_components/charts/ColumnChart";
import { LineChart } from "../_components/charts/LineChart";
import { RadarChart } from "../_components/charts/RadarChart";

afterEach(cleanup);
it("AC-10-028.1 compact radar exposes all six observed axes", () => {
  render(
    <RadarChart
      axes={{
        produccion: 60,
        velocidad: 40,
        calidad: 75,
        constancia: 50,
        ideacion: 80,
        alcance: 30,
      }}
    />,
  );
  expect(
    screen.getByRole("img", {
      name: /producción 60.*velocidad 40.*calidad 75.*constancia 50.*ideación 80.*alcance 30/,
    }),
  ).toBeInTheDocument();
});
it("statistics chart seam exposes series names and actual values", () => {
  const points = [
    { label: "Week one", value: 2 },
    { label: "Week two", value: 5 },
  ];
  render(
    <>
      <ColumnChart points={points} label="Orders" />
      <LineChart points={points} label="Ideas" />
    </>,
  );
  expect(screen.getByRole("img", { name: "Orders" })).toHaveTextContent("Week two: 5");
  expect(screen.getByRole("img", { name: "Ideas" })).toHaveTextContent("Week one: 2 · Week two: 5");
});

it("the retained statistics radar still renders the observed axes until its dedicated replacement", async () => {
  const { StatRadar } = await import("../StatsPanel");
  const props: import("../StatsPanel").StatRadarProps = {
    axes: { produccion: 60, velocidad: 40, calidad: 75, constancia: 50, ideacion: 80, alcance: 30 },
  };
  render(<StatRadar {...props} />);
  expect(screen.getByRole("img", { name: "Radar de atributos del gremio" })).toBeInTheDocument();
  expect(screen.getByText("Ideación")).toBeInTheDocument();
});
