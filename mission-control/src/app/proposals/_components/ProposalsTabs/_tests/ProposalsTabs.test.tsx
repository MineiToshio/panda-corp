import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProposalsTabs } from "../ProposalsTabs";

describe("ProposalsTabs", () => {
  const panels = {
    memoryPanel: <div>MEMORY PANEL CONTENT</div>,
    backlogPanel: <div>BACKLOG PANEL CONTENT</div>,
  };

  it("shows the Memoria panel by default and hides the Backlog panel", () => {
    render(<ProposalsTabs {...panels} backlogOpenCount={3} />);
    const memoria = screen.getByRole("tab", { name: /memoria/i });
    expect(memoria).toHaveAttribute("aria-selected", "true");
    // Backlog panel is mounted but hidden.
    const backlogPanel = screen.getByText("BACKLOG PANEL CONTENT").closest("[role='tabpanel']");
    expect(backlogPanel).toHaveAttribute("hidden");
  });

  it("switches to the Backlog panel when its tab is clicked", async () => {
    const user = userEvent.setup();
    render(<ProposalsTabs {...panels} backlogOpenCount={3} />);
    await user.click(screen.getByRole("tab", { name: /backlog/i }));
    expect(screen.getByRole("tab", { name: /backlog/i })).toHaveAttribute("aria-selected", "true");
    const backlogPanel = screen.getByText("BACKLOG PANEL CONTENT").closest("[role='tabpanel']");
    expect(backlogPanel).not.toHaveAttribute("hidden");
  });

  it("shows the open-count badge on the Backlog tab", () => {
    render(<ProposalsTabs {...panels} backlogOpenCount={7} />);
    expect(screen.getByRole("tab", { name: /backlog/i })).toHaveTextContent("7");
  });
});
