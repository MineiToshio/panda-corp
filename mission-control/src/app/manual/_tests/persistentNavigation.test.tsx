import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfigurationShell } from "@/app/configuration/ConfigurationShell";
import { BacklogPanel } from "@/app/proposals/_components/BacklogPanel/BacklogPanel";
import { PromotionsQueuePanel } from "@/app/proposals/_components/PromotionsQueuePanel/PromotionsQueuePanel";
import { ProposalsTabs } from "@/app/proposals/_components/ProposalsTabs/ProposalsTabs";
import { isShellExempt } from "@/components/modules/AppShell/shellScope";
import { isNavActive } from "@/components/modules/Nav/navTab";
import type { Lesson } from "@/lib/memory/memory";
import type { SkillRef } from "@/lib/reference/reference";
import type { Standard } from "@/lib/standards/standards";
import { ManualShell } from "../ManualShell";

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
  it("restores a directly pasted proposals tab and follows history changes", () => {
    visit("/proposals/backlog");
    render(<ProposalsTabs memoryPanel="MEMORY" backlogPanel="BACKLOG" backlogOpenCount={2} />);
    expect(screen.getByRole("tab", { name: /backlog/i })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: /memoria/i }));
    expect(window.location.pathname).toBe("/proposals/memory");
    visit("/proposals/backlog");
    expect(screen.getByRole("tab", { name: /backlog/i })).toHaveAttribute("aria-selected", "true");
  });

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

  it("restores a standard's detail representation in configuration", () => {
    visit("/configuration/standards/quality.md?standardView=detail");
    render(<ConfigurationShell skills={skills} standards={standards} />);
    expect(screen.getByTestId("standard-markdown-body")).toHaveTextContent("Full quality body");
    fireEvent.click(screen.getByRole("tab", { name: "Resumen" }));
    expect(new URLSearchParams(window.location.search).get("standardView")).toBe("summary");
    visit("/configuration/skills/spec");
    expect(screen.getByTestId("skill-detail")).toBeInTheDocument();
  });

  it("keeps unavailable manual targets explicit", () => {
    visit("/manual/guides/no-such-page");
    render(<ManualShell {...manualProps} />);
    expect(screen.getByRole("status")).toHaveTextContent("no está disponible");
    expect(screen.queryByText("Authored opening")).not.toBeInTheDocument();
  });

  it("restores a promotion from its collection path and clears it on close", () => {
    const lesson: Lesson = {
      id: "LESSON-0001",
      type: "pattern",
      domain: "quality",
      context: "A useful lesson",
      status: "active",
      promotion: "proposed",
      source: "test",
      links: [],
      projects: [],
      appliedIn: [],
      body: "Lesson body",
      trigger: "",
      evalGate: "corroborated",
    };
    visit("/proposals/memory/promotions/LESSON-0001");
    render(<PromotionsQueuePanel lessons={[lesson]} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("LESSON-0001");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/proposals/memory");
  });

  it("restores a completed backlog item and status disclosure independently", () => {
    visit("/proposals/backlog/BL-0001?backlogGroups=done");
    render(
      <BacklogPanel
        result={{
          errors: [],
          items: [
            {
              id: "BL-0001",
              type: "bug",
              area: "plugin",
              title: "Completed defect",
              status: "done",
              severity: null,
              source: "",
              closes: "",
              links: [],
              opened: "2026-10-17",
              closed: "2026-10-17",
              body: "Resolved issue",
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("BL-0001");
    expect(screen.getByTestId("backlog-toggle-done")).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(window.location.pathname).toBe("/proposals/backlog");
    expect(new URLSearchParams(window.location.search).get("backlogGroups")).toBe("done");
  });

  it("matches only complete navigation prefixes and exempts nested configuration", () => {
    expect(isNavActive("/manual/reference/agents/reviewer", "/manual")).toBe(true);
    expect(isNavActive("/manual-other", "/manual")).toBe(false);
    expect(isNavActive("/manual", "/")).toBe(false);
    expect(isShellExempt("/configuration/skills/spec")).toBe(true);
    expect(isShellExempt("/configuration-other")).toBe(false);
  });
});
