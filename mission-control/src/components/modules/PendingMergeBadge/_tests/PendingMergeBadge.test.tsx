import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PendingItem } from "@/lib/pendingMerge/pendingMerge";
import { PendingMergeBadge } from "../PendingMergeBadge";

const item = (over: Partial<PendingItem> = {}): PendingItem => ({
  branch: "feat",
  worktree: "/wt/feat",
  ahead: 2,
  ageHours: 1,
  status: "in-progress",
  task: null,
  ...over,
});

describe("PendingMergeBadge", () => {
  it("renders nothing when there is no pending work (calm, not a nag)", () => {
    const { container } = render(<PendingMergeBadge result={{ kind: "empty" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the count when there is pending work", () => {
    render(<PendingMergeBadge result={{ kind: "ok", items: [item({})] }} />);
    const badge = screen.getByTestId("pending-merge-badge");
    expect(badge).toHaveAttribute("data-state", "pending");
    expect(screen.getByTestId("pending-merge-count")).toHaveTextContent("1");
  });

  it("uses the alert (stale) state when any item is stale — by attribute, not color alone", () => {
    render(
      <PendingMergeBadge
        result={{ kind: "ok", items: [item({ status: "stale", ageHours: 9 })] }}
      />,
    );
    expect(screen.getByTestId("pending-merge-badge")).toHaveAttribute("data-state", "stale");
  });

  it("opens a panel listing each item on click (with its status as text, REQ-21-003)", () => {
    render(
      <PendingMergeBadge
        result={{ kind: "ok", items: [item({ branch: "feat-x", status: "stale", ageHours: 9 })] }}
      />,
    );
    expect(screen.queryByTestId("pending-merge-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("pending-merge-badge"));
    expect(screen.getByTestId("pending-merge-modal")).toBeInTheDocument();
    const row = screen.getByTestId("pending-merge-row");
    expect(row).toHaveTextContent("feat-x");
    expect(screen.getByTestId("pending-merge-row-status")).toHaveTextContent("estancado");
  });

  it("renders an explicit error chip when git is unreadable (never a silent al-día)", () => {
    render(<PendingMergeBadge result={{ kind: "error", reason: "boom" }} />);
    expect(screen.getByTestId("pending-merge-badge")).toHaveAttribute("data-state", "error");
  });
});
