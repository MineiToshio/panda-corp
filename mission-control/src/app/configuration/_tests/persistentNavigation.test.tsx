import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfigurationShell } from "@/app/configuration/ConfigurationShell";

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
function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("persistent global navigation", () => {
  it("restores a standard's detail representation in configuration", () => {
    visit("/configuration/standards/quality.md?standardView=detail");
    render(<ConfigurationShell skills={skills} standards={standards} />);
    expect(screen.getByTestId("standard-markdown-body")).toHaveTextContent("Full quality body");
    fireEvent.click(screen.getByRole("tab", { name: "Resumen" }));
    expect(new URLSearchParams(window.location.search).get("standardView")).toBe("summary");
    visit("/configuration/skills/spec");
    expect(screen.getByTestId("skill-detail")).toBeInTheDocument();
  });
});
