/**
 * Unit tests for FactoryWorktrees (CMP-18-factory-worktrees).
 *
 * Covers: empty, error, and ok (with stale/ready/in-progress items) states.
 * Tests render the correct visible text and data-testid anchors so assertions
 * remain behavior-oriented (not CSS/implementation-detail).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PendingItem, PendingResult } from "@/lib/pendingMerge/pendingMerge";
import { FactoryWorktrees } from "../FactoryWorktrees";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ITEM_STALE: PendingItem = {
  branch: "fix/auth-race",
  worktree: "/Users/Shared/review-worktrees/panda-corp-fix-auth-race",
  ahead: 3,
  ageHours: 5,
  status: "stale",
  task: "Fix auth race condition",
};

const ITEM_IN_PROGRESS: PendingItem = {
  branch: "feat/plugin-scope",
  worktree: "/Users/Shared/review-worktrees/panda-corp-feat-plugin-scope",
  ahead: 1,
  ageHours: 1,
  status: "in-progress",
  task: null,
};

const ITEM_READY: PendingItem = {
  branch: "chore/bump-deps",
  worktree: null,
  ahead: 2,
  ageHours: 0,
  status: "ready",
  task: null,
};

const RESULT_EMPTY: PendingResult = { kind: "empty" };
const RESULT_ERROR: PendingResult = { kind: "error", reason: "git: not a repository" };
const RESULT_OK_STALE: PendingResult = { kind: "ok", items: [ITEM_STALE] };
const RESULT_OK_MULTI: PendingResult = {
  kind: "ok",
  items: [ITEM_STALE, ITEM_IN_PROGRESS, ITEM_READY],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FactoryWorktrees", () => {
  describe("empty state", () => {
    it("renders section heading", () => {
      render(<FactoryWorktrees result={RESULT_EMPTY} />);
      expect(screen.getByTestId("factory-worktrees")).toBeInTheDocument();
    });

    it("renders empty panel — not error, not list", () => {
      render(<FactoryWorktrees result={RESULT_EMPTY} />);
      expect(screen.getByTestId("factory-worktrees-empty")).toBeInTheDocument();
      expect(screen.queryByTestId("factory-worktrees-error")).not.toBeInTheDocument();
      expect(screen.queryByTestId("factory-worktrees-list")).not.toBeInTheDocument();
    });

    it("shows al-día chip in the section head", () => {
      render(<FactoryWorktrees result={RESULT_EMPTY} />);
      expect(screen.getByTestId("factory-worktrees-al-dia")).toBeInTheDocument();
    });
  });

  describe("error state (fail-loud DR-078)", () => {
    it("renders error panel — not empty, not list", () => {
      render(<FactoryWorktrees result={RESULT_ERROR} />);
      expect(screen.getByTestId("factory-worktrees-error")).toBeInTheDocument();
      expect(screen.queryByTestId("factory-worktrees-empty")).not.toBeInTheDocument();
      expect(screen.queryByTestId("factory-worktrees-list")).not.toBeInTheDocument();
    });

    it("error and empty panels are visually distinct (different test ids)", () => {
      const { rerender } = render(<FactoryWorktrees result={RESULT_EMPTY} />);
      expect(screen.getByTestId("factory-worktrees-empty")).toBeInTheDocument();

      rerender(<FactoryWorktrees result={RESULT_ERROR} />);
      expect(screen.getByTestId("factory-worktrees-error")).toBeInTheDocument();
      expect(screen.queryByTestId("factory-worktrees-empty")).not.toBeInTheDocument();
    });
  });

  describe("ok state — single stale item", () => {
    it("renders the list and one row", () => {
      render(<FactoryWorktrees result={RESULT_OK_STALE} />);
      expect(screen.getByTestId("factory-worktrees-list")).toBeInTheDocument();
      expect(screen.getAllByTestId("factory-worktrees-row")).toHaveLength(1);
    });

    it("shows the branch name", () => {
      render(<FactoryWorktrees result={RESULT_OK_STALE} />);
      expect(screen.getByText("fix/auth-race")).toBeInTheDocument();
    });

    it("shows the task label when present", () => {
      render(<FactoryWorktrees result={RESULT_OK_STALE} />);
      expect(screen.getByTestId("factory-worktrees-task")).toHaveTextContent(
        "Fix auth race condition",
      );
    });

    it("shows status label 'estancado' for stale", () => {
      render(<FactoryWorktrees result={RESULT_OK_STALE} />);
      expect(screen.getByTestId("factory-worktrees-status")).toHaveTextContent("estancado");
    });

    it("shows count chip (not al-día) when items exist", () => {
      render(<FactoryWorktrees result={RESULT_OK_STALE} />);
      expect(screen.getByTestId("factory-worktrees-count")).toBeInTheDocument();
      expect(screen.queryByTestId("factory-worktrees-al-dia")).not.toBeInTheDocument();
    });
  });

  describe("ok state — multiple items", () => {
    it("renders a row for every item", () => {
      render(<FactoryWorktrees result={RESULT_OK_MULTI} />);
      expect(screen.getAllByTestId("factory-worktrees-row")).toHaveLength(3);
    });

    it("shows all three branch names", () => {
      render(<FactoryWorktrees result={RESULT_OK_MULTI} />);
      expect(screen.getByText("fix/auth-race")).toBeInTheDocument();
      expect(screen.getByText("feat/plugin-scope")).toBeInTheDocument();
      expect(screen.getByText("chore/bump-deps")).toBeInTheDocument();
    });

    it("no task label rendered for items without a task", () => {
      render(<FactoryWorktrees result={RESULT_OK_MULTI} />);
      // only ITEM_STALE has a task; the other two don't
      expect(screen.getAllByTestId("factory-worktrees-task")).toHaveLength(1);
    });

    it("shows distinct status labels", () => {
      render(<FactoryWorktrees result={RESULT_OK_MULTI} />);
      const statuses = screen
        .getAllByTestId("factory-worktrees-status")
        .map((el) => el.textContent);
      expect(statuses).toContain("estancado");
      expect(statuses).toContain("en curso");
      expect(statuses).toContain("listo, sin mergear");
    });
  });
});
