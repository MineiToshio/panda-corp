import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PendingItem, PendingResult } from "@/lib/pendingMerge/pendingMerge";
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

  it("shows the count and links to the work-orders view when there is pending work", () => {
    const result: PendingResult = { kind: "ok", items: [item({})] };
    render(<PendingMergeBadge result={result} />);
    const badge = screen.getByTestId("pending-merge-badge");
    expect(badge).toHaveAttribute("data-state", "pending");
    expect(screen.getByTestId("pending-merge-count")).toHaveTextContent("1");
  });

  it("uses the alert (stale) state when any item is stale — conveyed by attribute, not color alone", () => {
    const result: PendingResult = {
      kind: "ok",
      items: [item({ status: "stale", ageHours: 9 })],
    };
    render(<PendingMergeBadge result={result} />);
    expect(screen.getByTestId("pending-merge-badge")).toHaveAttribute("data-state", "stale");
  });

  it("renders an explicit error chip when git is unreadable (never a silent al-día)", () => {
    render(<PendingMergeBadge result={{ kind: "error", reason: "boom" }} />);
    expect(screen.getByTestId("pending-merge-badge")).toHaveAttribute("data-state", "error");
  });
});
