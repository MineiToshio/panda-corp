import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { WorkspaceProject } from "../../../_panels/workspaceProject";
import { WoDetail } from "../WoDetail";

vi.mock("@/lib/work-orders/work-orders", () => ({
  readWorkOrderDetail: () => ({ kind: "not-found" }),
}));
it("AC-05-008.4 missing order remains inside the workspace with a filter-preserving return link", () => {
  const project = { projectPath: "/missing", slug: "demo", name: "Demo" } as WorkspaceProject;
  render(
    <WoDetail
      project={project}
      woId="WO-99-999"
      view="Resumen"
      navigationBaseHref="/portfolio/demo/observability?view=tablero&state=review&wo=WO-99-999"
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Esta work order no está publicada" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("WO-99-999 no aparece entre las work orders de Demo."),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ver work orders" })).toHaveAttribute(
    "href",
    "/portfolio/demo/observability?view=tablero&state=review",
  );
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
});
