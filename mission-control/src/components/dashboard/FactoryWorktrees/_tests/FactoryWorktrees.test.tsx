import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FactoryWorktrees } from "../FactoryWorktrees";

vi.mock("@/lib/pendingMerge/worktreesByRepo", () => ({
  getWorktreesByRepoSync: vi.fn(() => [
    { kind: "error", name: "Fixture", path: "/fixture", reason: "git failed" },
  ]),
}));
it("AC-21-007.1: mounts the shared repository reader and explicit error state", () => {
  render(<FactoryWorktrees />);
  expect(screen.getByRole("heading", { name: "Árboles de trabajo" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Fixture");
});
