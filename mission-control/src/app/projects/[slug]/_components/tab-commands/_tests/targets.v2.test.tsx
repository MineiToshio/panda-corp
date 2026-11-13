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
        { value: "change:fix", label: "Cambio · Fix", status: "draft" },
      ]}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Objetivo: FRD o tarjeta" }));
  const select = screen.getByRole("combobox", { name: "Objetivo del build" });
  expect(screen.queryByRole("button", { name: /^Copiar .*<id>/ })).toBeNull();
  for (const target of ["FRD-01", "change:fix"]) {
    await user.selectOptions(select, target);
    expect(
      screen.getByRole("button", { name: `Copiar /pandacorp:implement ${target}` }),
    ).toBeInTheDocument();
  }
  await user.selectOptions(select, "");
  expect(screen.queryByRole("button", { name: /^Copiar .*<id>/ })).toBeNull();
  expect(screen.queryByRole("main")).not.toBeInTheDocument();
});
