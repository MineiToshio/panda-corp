import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgentsCatalog } from "../_components/AgentsCatalog";
import { RulesCatalog } from "../_components/RulesCatalog";
import { SkillsCatalog } from "../_components/SkillsCatalog";

afterEach(cleanup);

it("keeps internal engines informational and owner commands copyable", () => {
  render(
    <SkillsCatalog
      skills={[
        {
          slug: "engine",
          description: "Internal engine. Complete details.",
          body: "",
          internal: true,
          runsIn: "project",
        },
        {
          slug: "spec",
          description: "Document the project. Complete details.",
          body: "",
          internal: false,
          runsIn: "project",
        },
      ]}
      query=""
      type="all"
      onType={vi.fn()}
      onOpen={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Copiar /pandacorp:engine" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copiar /pandacorp:spec" })).toBeInTheDocument();
});

it("shows compact agent summaries and only explicit effort outside the full dialog", () => {
  render(
    <AgentsCatalog
      agents={[
        {
          id: "mech",
          name: "Mech",
          model: "inherit",
          description: "Runs commands. Full definition remains in the dialog.",
          body: "",
        },
      ]}
      query=""
      onOpen={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: /Mech/ })).toHaveTextContent("Runs commands.");
  expect(screen.queryByText(/Full definition remains/)).not.toBeInTheDocument();
  expect(screen.queryByText("esfuerzo por defecto")).not.toBeInTheDocument();
});

it("reveals a rule default only after expanding its summary", () => {
  render(
    <RulesCatalog
      rules={[
        {
          id: "DR-001",
          patron: "A decision",
          default: "The complete default",
          requiereHumano: false,
        },
      ]}
      query=""
      approval="all"
      selected=""
      onApproval={vi.fn()}
      onOpen={vi.fn()}
    />,
  );
  expect(screen.queryByText("The complete default")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /DR-001/ })).toHaveAttribute("aria-expanded", "false");
});
