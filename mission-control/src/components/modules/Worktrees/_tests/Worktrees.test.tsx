import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { WorktreesRepo } from "@/lib/pendingMerge/worktreesByRepo";
import { WorktreesCard } from "../WorktreesCard";

const repository: WorktreesRepo = {
  kind: "ok",
  name: "Proyecto",
  path: "/fixture/project",
  branches: [
    {
      name: "codex/change",
      subject: "feat: complete change",
      origin: "codex",
      ageHours: 50,
      ahead: 2,
      uncommitted: 3,
      worktree: "/fixture/work",
    },
  ],
  leftovers: 1,
  locked: 1,
  state: "reviewSoon",
};
it("AC-21-007.2: the repository hook keeps its identity when the display name changes", () => {
  render(<WorktreesCard rows={[{ ...repository, id: "factory", name: "Renamed factory" }]} />);
  expect(screen.getByRole("button", { name: "Renamed factory" })).toHaveAttribute(
    "data-wt-repo",
    "factory",
  );
});
it("AC-21-007.1, AC-21-007.3: card exposes states, legend, disabled clean/error rows and copyable command", async () => {
  const user = userEvent.setup();
  render(
    <WorktreesCard
      rows={[
        repository,
        {
          kind: "ok",
          name: "Clean",
          path: "/clean",
          branches: [],
          leftovers: 0,
          locked: 0,
          state: "clean",
        },
        { kind: "error", name: "Unread", path: "/unread", reason: "Malformed git worktree list" },
      ]}
    />,
  );
  expect(screen.getByRole("heading", { name: "Árboles de trabajo" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Clean" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Unread" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Malformed git worktree list");
  expect(screen.getByText("No se pudo leer")).toBeVisible();
  expect(screen.getByRole("button", { name: "Copiar /pandacorp:worktrees" })).toBeVisible();
  await user.click(screen.getByText("¿Cómo se decide el estado?"));
  expect(screen.getByText(/3 o más sobrantes/)).toBeVisible();
});
it("AC-21-007.2: row opens branch details, traps focus, Escape closes and restores trigger", async () => {
  const user = userEvent.setup();
  render(<WorktreesCard rows={[repository]} />);
  const trigger = screen.getByRole("button", { name: "Proyecto" });
  await user.click(trigger);
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("feat: complete change");
  expect(dialog).toHaveTextContent(
    "Sesión de Codex · hace 2 días · 2 commits fuera de main · 3 sin guardar",
  );
  expect(dialog).toHaveTextContent("codex/change");
  const close = within(dialog).getByRole("button", { name: "Cerrar modal" });
  close.focus();
  await user.tab({ shift: true });
  expect(within(dialog).getByRole("button", { name: "Copiar /pandacorp:worktrees" })).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("AC-21-008.1: a card that streams in after the hash navigation scrolls itself into view", () => {
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  window.history.replaceState(null, "", "/#worktrees-card");
  render(<WorktreesCard rows={[repository]} />);
  expect(scroll).toHaveBeenCalledTimes(1);
  window.history.replaceState(null, "", "/");
  render(<WorktreesCard rows={[repository]} />);
  expect(scroll).toHaveBeenCalledTimes(1);
});
