import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { TabCommands } from "../tab-commands";

it("AC-11-005.2: scopes FRD, work order and change commands and resets on clearing", async () => {
  const user = userEvent.setup();
  render(
    <TabCommands
      phase="product"
      slug="project"
      targets={[
        { value: "FRD-01", label: "FRD-01 · Feature" },
        { value: "WO-01-001", label: "WO-01-001 · Work" },
        { value: "change:fix", label: "Cambio · Fix" },
      ]}
    />,
  );
  const select = screen.getByRole("combobox", { name: "Objetivo del build" });
  expect(screen.getByText("/pandacorp:implement <id>")).toBeInTheDocument();
  for (const target of ["FRD-01", "WO-01-001", "change:fix"]) {
    await user.selectOptions(select, target);
    expect(
      screen.getByRole("button", { name: `Copiar /pandacorp:implement ${target}` }),
    ).toBeInTheDocument();
  }
  await user.selectOptions(select, "");
  expect(screen.getByText("/pandacorp:implement <id>")).toBeInTheDocument();
  expect(screen.queryByRole("main")).not.toBeInTheDocument();
});
