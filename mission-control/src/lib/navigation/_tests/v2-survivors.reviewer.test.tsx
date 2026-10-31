import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TabBar } from "@/app/projects/[slug]/_components/tabbar";
import { readyFixture } from "@/components/modules/DataModelViewer/_tests/fixture";
import { waitForLayout } from "@/components/modules/DataModelViewer/_tests/waitForLayout";
import { DataModelViewer } from "@/components/modules/DataModelViewer/DataModelViewer";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

describe("FRD-25 boundary probes closing surviving mutants (LESSON-0185)", () => {
  it("normalizes the retired timeline view to the default FRD view", () => {
    expect(
      new URL(
        normalizeLegacyNavigation("/portfolio/second/observability?view=timeline#goal"),
        "http://localhost",
      ).searchParams.get("view"),
    ).toBe("frd");
  });

  it("AC-25-001.1: choosing a model mode writes the canonical spelling", async () => {
    window.history.replaceState({}, "", "/portfolio/second/architecture?entity=entry");
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    fireEvent.click(screen.getByRole("button", { name: /^Esquema$/ }));
    expect(new URLSearchParams(window.location.search).get("model")).toBe("Esquema");
    fireEvent.click(screen.getByRole("button", { name: /^Diagrama$/ }));
    expect(new URLSearchParams(window.location.search).get("model")).toBe("Diagrama");
  });

  it("AC-25-009.1: a tab change discards the open work order and its representation", () => {
    window.history.replaceState(
      {},
      "",
      "/portfolio/second/observability?wo=WO-01-001&woview=full&keep=1",
    );
    render(
      <TabBar
        activeTab="observabilidad"
        navigationBaseHref="/portfolio/second/observability?wo=WO-01-001&woview=full&keep=1"
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Spec" }));
    expect(push).toHaveBeenCalledWith("/portfolio/second/spec?keep=1");
  });
});
