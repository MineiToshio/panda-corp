import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManualShell } from "@/app/manual/ManualShell";
import type { SkillRef } from "@/lib/reference/reference";
import type { Standard } from "@/lib/standards/standards";

const skills: SkillRef[] = [
  { slug: "spec", description: "Document the MVP", runsIn: "factory", body: "Skill body" },
];
const standards: Standard[] = [
  {
    id: "quality.md",
    title: "Quality",
    body: "Full quality body",
    domain: "Quality",
    severity: "MUST",
    enforcement: "CI",
    summary: ["Summary quality"],
  },
];
const manualProps = {
  pages: [
    {
      group: "tutorial",
      slug: "start-here",
      title: "Start here",
      order: 1,
      body: "Authored opening",
    },
  ],
  skills,
  agents: [],
  rules: [],
  standards,
};

function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("persistent global navigation", () => {
  it("restores manual reference detail and its back control changes the URL", () => {
    visit("/manual/reference/commands/spec");
    render(<ManualShell {...manualProps} />);
    expect(screen.getByTestId("skill-detail")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(window.location.pathname).toBe("/manual/reference/commands");
    expect(screen.queryByTestId("skill-detail")).not.toBeInTheDocument();
    visit("/manual/tutorial/start-here");
    expect(screen.getByText("Authored opening")).toBeInTheDocument();
  });

  it("replaces the manual root with its resolved default page", () => {
    visit("/manual");
    const length = window.history.length;
    render(<ManualShell {...manualProps} />);
    expect(window.location.pathname).toBe("/manual/tutorial/start-here");
    expect(window.history.length).toBe(length);
  });

  it("keeps unavailable manual targets explicit", () => {
    visit("/manual/guides/no-such-page");
    render(<ManualShell {...manualProps} />);
    expect(screen.getByRole("status")).toHaveTextContent("no está disponible");
    expect(screen.queryByText("Authored opening")).not.toBeInTheDocument();
  });
});
