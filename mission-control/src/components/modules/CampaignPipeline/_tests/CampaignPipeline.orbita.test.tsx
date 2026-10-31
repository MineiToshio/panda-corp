import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignPipeline } from "../CampaignPipeline";
import { PHASES } from "../phases";

/** CmdRow splits a command across text nodes, so the whole command is matched on its element. */
const commandText =
  (command: string) =>
  (_: string, element: Element | null): boolean =>
    element?.tagName === "CODE" && element.textContent === command;

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  window.history.replaceState(null, "", "/board/sample/campaign");
});
describe("Órbita campaign", () => {
  it("AC-02-010.1 AC-02-010.3 AC-02-010.12 AC-02-016.6 exposes six ordered rooms, delivered corridors and a six segment strip", () => {
    render(<CampaignPipeline slug="sample" activePhase={3} />);
    const map = screen.getByRole("group", { name: "El viaje de esta idea por las 6 fases" });
    const rooms = within(map).getAllByRole("button");
    expect(rooms.map((room) => room.getAttribute("data-phase"))).toEqual(
      PHASES.map((phase) => phase.key),
    );
    expect(rooms[0]).toHaveAccessibleName("1. Investigación: entregado");
    expect(rooms[3]).toHaveAccessibleName("4. Arquitectura: en curso");
    expect(rooms[5]).toHaveAccessibleName("6. Lanzamiento: en espera");
    expect(
      screen.getByRole("img", { name: "3 de 6 fases entregadas; en curso: Arquitectura" }).children,
    ).toHaveLength(6);
    expect(screen.getByText("research.md", { selector: ".handoff" })).toHaveAttribute(
      "data-delivered",
      "true",
    );
  });
  it("AC-02-010.4 AC-02-010.7 AC-02-010.11 AC-02-016.6 pins the active sheet, switches with rooms and arrows, and restores URL phase", async () => {
    const user = userEvent.setup();
    render(<CampaignPipeline slug="sample" activePhase={0} />);
    expect(screen.getByRole("region", { name: "Investigación" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "1. Investigación: en curso" }));
    expect(screen.getByRole("region", { name: "Investigación" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Fase siguiente: Producto" }));
    expect(window.location.search).toContain("phase=product");
    await user.click(screen.getByRole("button", { name: "5. Construcción: en espera" }));
    const sheet = screen.getByRole("region", { name: "Construcción" });
    expect(within(sheet).getByText("Lee")).toBeVisible();
    for (const member of PHASES[4]?.team ?? [])
      expect(within(sheet).getByText(member.label)).toBeVisible();
    expect(
      within(sheet).queryByRole("link", { name: "Entrar a La Fragua" }),
    ).not.toBeInTheDocument();
    await act(async () => {
      const restored = new Promise<void>((resolve) =>
        window.addEventListener("popstate", () => resolve(), { once: true }),
      );
      window.history.back();
      await restored;
    });
    expect(screen.getByRole("region", { name: "Producto" })).toBeVisible();
  });
  it("AC-02-010.9 AC-02-010.10 AC-02-010.6 renders interpolated, copy-only commands and three spec disclosure modes", async () => {
    const user = userEvent.setup();
    render(<CampaignPipeline slug="sample" activePhase={0} />);
    const sheet = screen.getByRole("region", { name: "Investigación" });
    expect(within(sheet).getByText(commandText("/pandacorp:spec sample"))).toBeVisible();
    expect(within(sheet).getByText(commandText("/pandacorp:explore sample"))).toBeVisible();
    expect(within(sheet).queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(
      screen.getByText("Cuántas preguntas te hago antes de generar la documentación"),
    );
    for (const flag of ["--ask", "--auto", "--infer"])
      expect(within(sheet).getByText(commandText(`/pandacorp:spec sample ${flag}`))).toBeVisible();
    const clipboard = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboard },
      configurable: true,
    });
    await user.click(
      within(sheet).getByRole("button", { name: "Copiar /pandacorp:spec sample --ask" }),
    );
    expect(clipboard).toHaveBeenCalledWith("/pandacorp:spec sample --ask");
    await user.click(screen.getByRole("button", { name: "2. Producto: en espera" }));
    expect(screen.queryByText("/pandacorp:explore sample")).not.toBeInTheDocument();
  });
  it("AC-02-010.5 AC-11-005.3 shares the mode picker and exposes a real forge link only after reaching build", async () => {
    const user = userEvent.setup();
    render(
      <CampaignPipeline
        slug="sample"
        project="linked-project"
        activePhase={5}
        forgeHref="/projects/sample/resumen"
      />,
    );
    await user.click(screen.getByRole("button", { name: "5. Construcción: entregado" }));
    expect(screen.getByRole("link", { name: "Entrar a La Fragua" })).toHaveAttribute(
      "href",
      "/projects/sample/resumen",
    );
    await user.click(screen.getByText("Elegir modo de construcción"));
    expect(screen.getByRole("group", { name: /Modo de construcción/ })).toBeVisible();
  });
  it("uses project mode memory for architecture and build, with session-only modes for unlinked ideas", async () => {
    const user = userEvent.setup();
    localStorage.clear();
    const view = render(
      <CampaignPipeline slug="idea-name" project="linked-project" activePhase={3} />,
    );
    await user.click(screen.getByText("Elegir modo de construcción"));
    await user.click(screen.getByRole("button", { name: /Potente/ }));
    expect(localStorage.getItem("mc:build-mode:linked-project")).toBe("powerful");
    expect(localStorage.getItem("mc:build-mode:idea-name")).toBeNull();
    await user.click(screen.getByRole("button", { name: "5. Construcción: en espera" }));
    expect(screen.getByTestId("build-mode-picker")).toBeInTheDocument();
    view.unmount();
    window.history.replaceState(null, "", "/board/idea-name/campaign");
    render(<CampaignPipeline slug="idea-name" activePhase={3} />);
    expect(screen.getByTestId("build-mode-picker")).toBeInTheDocument();
    await user.click(screen.getByText("Elegir modo de construcción"));
    await user.click(screen.getByRole("button", { name: /Potente/ }));
    expect(
      screen.getByText(
        (_text, element) =>
          element?.tagName === "CODE" && element.textContent === "/pandacorp:implement powerful",
      ),
    ).toBeVisible();
    expect(localStorage.getItem("mc:build-mode:idea-name")).toBeNull();
    expect(localStorage.getItem("mc:build-mode:undefined")).toBeNull();
  });
  it.each([
    "a$&b",
    "prefix-$`-suffix",
    "a$'b",
  ])("AC-02-010.9 interpolates %s literally into every factory command", (slug) => {
    render(<CampaignPipeline slug={slug} activePhase={0} />);
    expect(screen.getByText(commandText(`/pandacorp:spec ${slug}`))).toBeVisible();
    expect(screen.getByText(commandText(`/pandacorp:explore ${slug}`))).toBeVisible();
  });
  it("AC-02-010.8 includes private HTML artifacts and the whole current teams", () => {
    const design = PHASES.find((phase) => phase.key === "design");
    expect(design?.description).toContain("HTML");
    expect(design?.description).toContain("Artifacts privados");
    expect(PHASES[4]?.team.map((member) => member.role)).toEqual([
      "implementer",
      "reviewer",
      "analytics",
      "security-auditor",
    ]);
  });
  it("AC-02-010.11 makes reduced-motion cast static and gates live markers on running", () => {
    const match = vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    const view = render(<CampaignPipeline slug="sample" activePhase={4} running />);
    expect(screen.getByTestId("campaign-cast-build")).toHaveAttribute("data-motion", "static");
    expect(screen.getAllByTestId("campaign-sprite-halo")).toHaveLength(1);
    view.rerender(<CampaignPipeline slug="sample" activePhase={4} />);
    expect(screen.queryByTestId("campaign-sprite-halo")).not.toBeInTheDocument();
    match.mockRestore();
  });
});
