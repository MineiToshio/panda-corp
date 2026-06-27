import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PendingItem } from "@/lib/pendingMerge/pendingMerge";
import { PendingMergeBlock } from "../PendingMergeBlock";

const item = (over: Partial<PendingItem> = {}): PendingItem => ({
  branch: "feat",
  worktree: "/wt/feat",
  ahead: 2,
  ageHours: 1,
  status: "in-progress",
  task: null,
  ...over,
});

describe("PendingMergeBlock (FRD-21 Resumen section)", () => {
  it("shows an 'al día' state when there is no un-merged work", () => {
    render(<PendingMergeBlock result={{ kind: "empty" }} />);
    expect(screen.getByTestId("pending-merge-block-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("pending-merge-block-row")).not.toBeInTheDocument();
  });

  it("shows an explicit error state when git is unreadable (never a silent al-día, DR-078)", () => {
    render(<PendingMergeBlock result={{ kind: "error", reason: "boom" }} />);
    expect(screen.getByTestId("pending-merge-block-error")).toBeInTheDocument();
    expect(screen.queryByTestId("pending-merge-block-empty")).not.toBeInTheDocument();
  });

  it("lists each un-merged worktree with its branch + status as text (REQ-21-004)", () => {
    render(
      <PendingMergeBlock
        result={{ kind: "ok", items: [item({ branch: "feat-x", status: "stale", ageHours: 9 })] }}
      />,
    );
    const row = screen.getByTestId("pending-merge-block-row");
    expect(row).toHaveTextContent("feat-x");
    expect(screen.getByTestId("pending-merge-block-status")).toHaveTextContent("estancado");
  });
});
