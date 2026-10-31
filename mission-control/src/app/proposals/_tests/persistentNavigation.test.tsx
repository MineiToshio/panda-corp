import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PromotionsQueuePanel } from "@/app/proposals/_components/PromotionsQueuePanel/PromotionsQueuePanel";
import { ProposalsTabs } from "@/app/proposals/_components/ProposalsTabs/ProposalsTabs";

import type { Lesson } from "@/lib/memory/memory";

function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("persistent global navigation", () => {
  it("restores a directly pasted proposals tab and follows history changes", () => {
    visit("/proposals/backlog");
    render(
      <ProposalsTabs
        summaryPanel="SUMMARY"
        memoryPanel="MEMORY"
        backlogPanel="BACKLOG"
        backlogOpenCount={2}
      />,
    );
    expect(screen.getByRole("tab", { name: /backlog/i })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: /memoria/i }));
    expect(window.location.pathname).toBe("/proposals/memory");
    visit("/proposals/backlog");
    expect(screen.getByRole("tab", { name: /backlog/i })).toHaveAttribute("aria-selected", "true");
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
});
