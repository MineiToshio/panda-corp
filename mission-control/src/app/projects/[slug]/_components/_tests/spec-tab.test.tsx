import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkspace, resolveWorkspaceTab } from "@/app/projects/[slug]/ProjectWorkspace";
import { TabSpec } from "../tab-spec";
import { TabBar } from "../tabbar";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("project=selected&tab=work-orders&wo=WO-01-001"),
}));

const status = { present: false, malformed: false, status: null } as const;
const project = path.resolve("e2e/fixtures/factory-root/mission-control");
vi.mock("@/lib/portfolio/portfolio", () => ({
  allProjects: () => [
    { name: "Fixture", path: project, stage: "architecture", status, exists: true },
    {
      name: "Unpublished",
      path: path.join(project, "no-spec-project"),
      stage: "product",
      status,
      exists: false,
    },
  ],
  readPortfolio: () => [],
}));
const selection = {
  activeTab: "spec",
  docParam: undefined,
  woParam: undefined,
  woTabParam: "full",
} as const;

describe("workspace shared Spec", () => {
  it("keeps both unpublished lines in order in one notice without FRDs", () => {
    render(<TabSpec body="" title="Unpublished" project="unpublished" nodes={[]} frds={[]} />);
    const notice = screen.getByRole("status");
    const title = within(notice).getByText("El spec todavía no está publicado.");
    const body = within(notice).getByText("Su PRD y sus FRDs reales siguen disponibles.");
    expect(title.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("accepts a Spec deep link and keeps Summary as the default", () => {
    expect(resolveWorkspaceTab("spec")).toBe("spec");
    expect(resolveWorkspaceTab(undefined)).toBe("summary");
  });

  it("retains project and clears work-order detail when selecting Spec", () => {
    render(<TabBar activeTab="summary" />);
    fireEvent.click(screen.getByRole("tab", { name: "Spec" }));
    const query = new URLSearchParams(push.mock.calls[0]?.[0]);
    expect(query.get("project")).toBe("selected");
    expect(query.get("tab")).toBe("spec");
    expect(query.has("wo")).toBe(false);
  });

  it("reads the published digest through the shared board Spec component", () => {
    render(
      <ProjectWorkspace
        item={{ name: "Fixture", path: project, stage: "architecture", status, exists: true }}
        selection={selection}
      />,
    );
    expect(screen.getByRole("article", { name: "Resumen del spec" })).toHaveTextContent(
      "Mission Control Spec",
    );
    expect(screen.getByRole("article", { name: "Resumen del spec" })).toHaveTextContent(
      "FRDs · las piezas del v1 (1)",
    );
    const link = screen.getByRole("link", { name: "Documento del producto" });
    expect(link).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/portfolio\/fixture\/documents\//),
    );
  });

  it("shows a useful pending state without inventing a digest", () => {
    render(
      <ProjectWorkspace
        item={{
          name: "Unpublished",
          path: path.join(project, "no-spec-project"),
          stage: "product",
          status,
          exists: false,
        }}
        selection={selection}
      />,
    );
    expect(screen.getByText("El spec todavía no está publicado.")).toBeVisible();
    expect(screen.getByText("Su PRD y sus FRDs reales siguen disponibles.")).toBeVisible();
  });
});
