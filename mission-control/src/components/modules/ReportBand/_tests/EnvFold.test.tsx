import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { EnvFold } from "../EnvRow";

afterEach(cleanup);

it("folds even a single variable group and reveals its description on demand", () => {
  render(
    <EnvFold
      group="Database"
      entries={[
        { name: "DATABASE_URL", comment: "Connection", section: "Database", described: true },
      ]}
    />,
  );
  const summary = screen.getByText("Database");
  expect(screen.getByText("Connection")).not.toBeVisible();
  fireEvent.click(summary);
  expect(screen.getByText("Connection")).toBeVisible();
});

it("opens the first environment group and exposes its missing-description warning", () => {
  render(
    <EnvFold
      group="Database"
      defaultOpen
      entries={[{ name: "DATABASE_URL", comment: "", described: false }]}
    />,
  );
  expect(screen.getByText("DATABASE_URL")).toBeVisible();
  expect(screen.getByText("1 de 1 sin descripción")).toBeVisible();
});
