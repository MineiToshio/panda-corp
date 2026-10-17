import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkspace, resolveWorkspaceTab } from "@/app/projects/[slug]/ProjectWorkspace";
import { TabBar } from "../tabbar";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("project=selected&tab=work-orders&wo=WO-01-001"),
}));

const status = { present: false, malformed: false, status: null } as const;
const project = path.resolve("e2e/fixtures/factory-root/mission-control");
const selection = {
  activeTab: "spec",
  docParam: undefined,
  woParam: undefined,
  woTabParam: "full",
} as const;

describe("workspace shared Spec", () => {
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
    const query = new URLSearchParams(link.getAttribute("href") ?? "");
    expect(query.get("project")).toBe("Fixture");
    expect(query.get("tab")).toBe("documents");
    expect(query.get("doc")).toBeTruthy();
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
    expect(screen.getByText("Todavía no hay una especificación publicada.")).toBeVisible();
    expect(screen.queryByRole("article", { name: "Resumen del spec" })).not.toBeInTheDocument();
  });
});
