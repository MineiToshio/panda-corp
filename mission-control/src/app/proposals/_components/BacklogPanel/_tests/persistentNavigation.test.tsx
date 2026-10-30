import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BacklogPanel } from "@/app/proposals/_components/BacklogPanel/BacklogPanel";

function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("persistent global navigation", () => {
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
});
