import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { BacklogItem, BacklogReadResult } from "@/lib/backlog/backlog";
import { BacklogPanel } from "../BacklogPanel";

function makeItem(over: Partial<BacklogItem>): BacklogItem {
  return {
    id: "BL-0001",
    type: "bug",
    area: "build-engine",
    title: "A defect",
    status: "open",
    severity: null,
    source: "",
    closes: "",
    links: [],
    opened: "2026-06-30",
    closed: null,
    body: "## Problem\nSomething is wrong.",
    ...over,
  };
}

function result(over: Partial<BacklogReadResult>): BacklogReadResult {
  return { items: [], errors: [], ...over };
}

describe("BacklogPanel", () => {
  it("groups items by status with a section per non-empty group", () => {
    render(
      <BacklogPanel
        result={result({
          items: [
            makeItem({ id: "BL-0001", title: "Open one", status: "open" }),
            makeItem({ id: "BL-0002", title: "Doing one", status: "doing" }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Abiertos")).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
    // No "done" items → no "Hechos" group rendered.
    expect(screen.queryByText("Hechos")).not.toBeInTheDocument();
    expect(screen.getByText("Open one")).toBeInTheDocument();
    expect(screen.getByText("Doing one")).toBeInTheDocument();
  });

  it("renders a fail-loud error banner when the reader reports errors (DR-078)", () => {
    render(
      <BacklogPanel
        result={result({
          items: [makeItem({})],
          errors: [{ file: "BL-0009-broken.md", reason: "malformed YAML frontmatter" }],
        })}
      />,
    );
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("BL-0009-broken.md");
    expect(banner).toHaveTextContent("malformed YAML frontmatter");
  });

  it("renders an empty state when there are no items and no errors", () => {
    render(<BacklogPanel result={result({})} />);
    expect(screen.getByTestId("backlog-empty")).toBeInTheDocument();
  });

  it("opens a detail modal with the item's rendered body when a card is clicked (REQ-22-005)", async () => {
    const user = userEvent.setup();
    render(
      <BacklogPanel
        result={result({
          items: [
            makeItem({
              id: "BL-0042",
              title: "Fix the thing",
              body: "## Problem\nThe widget explodes.\n\n## Fix plan\nStop the explosion.",
            }),
          ],
        })}
      />,
    );

    // Closed by default.
    expect(screen.queryByTestId("backlog-detail")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ver detalle del item BL-0042/i }));

    // Modal open with the item id as title + the body rendered.
    expect(screen.getByTestId("backlog-detail")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("BL-0042");
    const body = screen.getByTestId("backlog-detail-body");
    expect(body).toHaveTextContent("The widget explodes.");
    // The `## Heading` sections become distinct titled section headers (not raw '##').
    for (const label of ["Problem", "Fix plan"]) {
      expect(within(body).getByText(label)).toBeInTheDocument();
    }
  });

  it("closes the detail modal on Escape", async () => {
    const user = userEvent.setup();
    render(<BacklogPanel result={result({ items: [makeItem({ id: "BL-0007" })] })} />);
    await user.click(screen.getByRole("button", { name: /ver detalle del item BL-0007/i }));
    expect(screen.getByTestId("backlog-detail")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("backlog-detail")).not.toBeInTheDocument();
  });
});
