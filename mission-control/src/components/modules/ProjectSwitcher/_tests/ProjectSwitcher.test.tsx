import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { PROJECT } from "@/components/modules/ProjectCard/_tests/fixture";
import { ProjectSwitcher } from "../ProjectSwitcher";

it("AC-03-008.3: searchable dialog keeps overview order, focuses search, marks Actual and returns focus on Escape", async () => {
  const user = userEvent.setup();
  render(
    <ProjectSwitcher
      projects={[{ ...PROJECT, id: "recent", name: "Recent" }, PROJECT]}
      currentId="alpha"
    />,
  );
  const opener = screen.getByRole("button", { name: "Cambiar proyecto" });
  await user.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Cambiar de proyecto" });
  expect(dialog.tagName).toBe("DIALOG");
  expect(within(dialog).getByText("Portafolio")).toBeVisible();
  const search = within(dialog).getByRole("searchbox", { name: "Buscar proyecto" });
  expect(search).toHaveFocus();
  expect(
    within(dialog)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href")),
  ).toEqual(["/portfolio/recent/summary", "/portfolio/alpha/summary"]);
  expect(within(dialog).getByText("Actual")).toBeVisible();
  expect(within(dialog).getAllByText(/3 FRDs · 8 documentos · 2\/5 WO/)).toHaveLength(2);
  await user.type(search, "ALPHA");
  expect(within(dialog).getAllByRole("link")).toHaveLength(1);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  await user.click(opener);
  expect(screen.getByRole("searchbox")).toHaveValue("");
});

it("AC-03-008.3: picker describes projects without work orders and an empty search result", async () => {
  const user = userEvent.setup();
  render(
    <ProjectSwitcher
      projects={[{ ...PROJECT, counts: { ...PROJECT.counts, ordersVerified: 0, ordersTotal: 0 } }]}
      currentId="alpha"
    />,
  );
  await user.click(screen.getByRole("button", { name: "Cambiar proyecto" }));
  expect(screen.getByText(/3 FRDs · 8 documentos · sin WOs/)).toBeVisible();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  await user.type(screen.getByRole("searchbox"), "no-match");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByRole("searchbox")).toHaveFocus();
});

it("keeps summary intrinsic and marks only compact tabs for full phone width", () => {
  window.history.replaceState(null, "", "/portfolio/pandasaga/summary");
  render(<ProjectSwitcher projects={[]} currentId="pandasaga" />);
  expect(screen.getByRole("button", { name: "Cambiar proyecto" })).toHaveAttribute(
    "data-compact",
    "false",
  );
  act(() => {
    window.history.pushState(null, "", "/portfolio/pandasaga/architecture");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByRole("button", { name: "Cambiar proyecto" })).toHaveAttribute(
    "data-compact",
    "true",
  );
});
