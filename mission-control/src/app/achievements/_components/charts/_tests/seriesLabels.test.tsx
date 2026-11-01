import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColumnChart } from "../ColumnChart";
import { LineChart } from "../LineChart";

describe("visible weekly series evidence", () => {
  for (const Chart of [ColumnChart, LineChart]) {
    it(`${Chart.name} shortens visible weeks while retaining the full accessible series`, () => {
      const label = "sem 2026-25: 76 work orders · sem 2026-26: 10 work orders";
      render(
        <Chart
          label={label}
          points={[
            { label: "sem 2026-25", value: 76 },
            { label: "sem 2026-26", value: 10 },
          ]}
        />,
      );
      const chart = screen.getByRole("img", { name: label });
      expect(within(chart).getByText("sem 25", { selector: "text" })).toBeVisible();
      expect(within(chart).getByText("sem 26", { selector: "text" })).toBeVisible();
      expect(
        within(chart).queryByText("sem 2026-25", { selector: "text" }),
      ).not.toBeInTheDocument();
    });
    it(`${Chart.name} shows the week and value outside its accessible alternative`, () => {
      render(<Chart label="Observed series" points={[{ label: "sem 25", value: 76 }]} />);
      const chart = screen.getByRole("img", { name: "Observed series" });
      expect(within(chart).getByText("76", { selector: "text" })).toBeVisible();
      expect(within(chart).getByText("sem 25", { selector: "text" })).toBeVisible();
    });
  }
});
