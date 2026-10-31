import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { TabCommands } from "../tab-commands";

beforeEach(() => localStorage.clear());
it.each([
  "product",
  "design",
  "architecture",
  "implementation",
  "release",
  undefined,
] as const)("REQ-04-006: all four cards and target select exist in phase %s", (phase) => {
  render(<TabCommands phase={phase} slug="project" />);
  for (const name of [
    "Siguiente paso",
    "Modo de construcción",
    "Construir un objetivo concreto",
    "Cambios y decisiones",
  ])
    expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Objetivo del build" })).toBeInTheDocument();
  for (const command of ["/pandacorp:change", "/pandacorp:decide", "/pandacorp:new-version"])
    expect(screen.getAllByRole("button", { name: `Copiar ${command}` }).length).toBeGreaterThan(0);
  expect(
    screen.getByText(
      "Los comandos se copian para pegarlos en Claude Code. Mission Control nunca los ejecuta.",
    ),
  ).toBeInTheDocument();
  if (!phase)
    expect(screen.getByText("No hay comandos de fase para este proyecto.")).toBeInTheDocument();
});
it("REQ-04-006: shared next step leads, and command duplicates appear once in its card", () => {
  render(
    <TabCommands
      phase="architecture"
      slug="project"
      nextStep={{ command: "/pandacorp:implement", sentence: "Build next" }}
    />,
  );
  const card = screen.getByRole("heading", { name: "Siguiente paso" }).closest("section");
  expect(card).toHaveTextContent("Build next");
  expect(
    within(card as HTMLElement).getAllByRole("button", {
      name: "Copiar /pandacorp:implement",
    }),
  ).toHaveLength(1);
});
it("AC-11-005.1: mounted shared picker remembers mode per project without scoping target commands by mode", async () => {
  const user = userEvent.setup();
  const { unmount } = render(
    <TabCommands
      phase="implementation"
      slug="project"
      targets={[{ value: "FRD-01", label: "FRD-01" }]}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Potente/ }));
  expect(screen.getByRole("button", { name: /Potente/ })).toHaveAttribute("aria-pressed", "true");
  await user.selectOptions(screen.getByRole("combobox"), "FRD-01");
  expect(
    screen.getByRole("button", { name: "Copiar /pandacorp:implement FRD-01" }),
  ).toBeInTheDocument();
  unmount();
  render(<TabCommands phase="implementation" slug="project" />);
  expect(screen.getByRole("button", { name: /Potente/ })).toHaveAttribute("aria-pressed", "true");
});
it("AC-11-005.2: unknown target values cannot become command arguments", () => {
  render(
    <TabCommands
      phase={undefined}
      slug="project"
      targets={[{ value: "FRD-01", label: "FRD-01" }]}
    />,
  );
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "evil" } });
  expect(
    screen.getByRole("button", { name: "Copiar /pandacorp:implement <id>" }),
  ).toBeInTheDocument();
});
it("AC-11-005.2: changed project clears the view-local target", async () => {
  const user = userEvent.setup();
  const targets = [{ value: "FRD-01", label: "FRD-01" }];
  const { rerender } = render(<TabCommands phase={undefined} slug="one" targets={targets} />);
  await user.selectOptions(screen.getByRole("combobox"), "FRD-01");
  rerender(<TabCommands phase={undefined} slug="two" targets={targets} />);
  expect(screen.getByRole("combobox")).toHaveValue("");
});

it.each([
  null,
  "",
  "   ",
])("REQ-04-006: duplicate with blank sentence %s retains phase guidance", (sentence) => {
  render(
    <TabCommands
      phase="architecture"
      slug="project"
      nextStep={{ command: "/pandacorp:implement", sentence }}
    />,
  );
  expect(screen.getByText("Inicia la implementación del proyecto")).toBeInTheDocument();
});
