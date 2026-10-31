/**
 * WO-02-020 gate suite (reviewer, DR-015/DR-080). Oracle: frd.md REQ-02-010, AC-02-016.6,
 * AC-11-005.3 and the frozen prototype's `campaignView()`.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignPipeline } from "@/components/modules/CampaignPipeline/CampaignPipeline";
import { PHASES } from "@/components/modules/CampaignPipeline/phases";

const KEYS = ["research", "product", "design", "architecture", "build", "release"] as const;
const room = (key: string) => screen.getByTestId(`campaign-phase-${key}`);
const sheet = () => screen.getByTestId("campaign-phase-ficha");
const commands = () =>
  within(sheet())
    .getAllByTestId("ficha-command")
    .map((row) => row.textContent ?? "");

function mockReducedMotion(reduced: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduce"),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => window.history.replaceState(null, "", "/board/x/campaign"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("map, strip and states (AC-02-010.1/.3/.12, AC-02-016.6)", () => {
  it.each([
    [0, "0/6"],
    [3, "3/6"],
    [5, "5/6"],
  ] as const)("active %i: rooms in order, words on each, %s delivered, solid corridors", (active, label) => {
    render(<CampaignPipeline slug="x" activePhase={active} />);
    KEYS.forEach((key, index) => {
      const word = index < active ? "entregado" : index === active ? "en curso" : "en espera";
      expect(room(key)).toHaveAccessibleName(new RegExp(`^${index + 1}\\. .*: ${word}$`));
      expect(room(key)).toHaveTextContent(word);
    });
    expect(screen.getByTestId("campaign-pipeline")).toHaveTextContent(`${label} entregadas`);
    const corridors = screen.getByTestId("campaign-stage").getElementsByClassName("corridor");
    expect(corridors).toHaveLength(5);
    expect(Array.from(corridors).filter((c) => c.classList.contains("is-done"))).toHaveLength(
      active,
    );
    expect(screen.getByRole("img", { name: /de 6 fases entregadas/ })).toBeInTheDocument();
  });

  it("the hand-off lives on the corridor, never inside a room", () => {
    render(<CampaignPipeline slug="x" activePhase={2} />);
    for (const key of KEYS) expect(room(key)).not.toHaveTextContent(/research\.md|el código/);
    expect(screen.getByTestId("campaign-stage")).toHaveTextContent("blueprint + Build Plan");
  });
});

describe("pinned sheet (AC-02-010.4/.7/.11)", () => {
  it("re-activating the open room keeps it open; arrows stop at both ends", () => {
    render(<CampaignPipeline slug="x" activePhase={0} />);
    fireEvent.click(room("research"));
    expect(within(sheet()).getByRole("heading", { level: 3 })).toHaveTextContent("Investigación");
    expect(within(sheet()).queryByRole("button", { name: /Fase anterior/ })).toBeNull();
    fireEvent.click(room("release"));
    expect(sheet()).toHaveTextContent("Fase 6 de 6");
    expect(within(sheet()).queryByRole("button", { name: /Fase siguiente/ })).toBeNull();
    expect(within(sheet()).getByRole("button", { name: /Fase anterior/ })).toBeInTheDocument();
  });

  it.each([
    ["unknown"],
    ["0"],
    ["__proto__"],
    [""],
  ])("the unrecognised URL phase %j falls back to the active sheet", (phase) => {
    window.history.replaceState(null, "", `/board/x/campaign?phase=${phase}`);
    render(<CampaignPipeline slug="x" activePhase={3} />);
    expect(sheet()).toHaveTextContent("Fase 4 de 6");
  });

  it("every locked sheet keeps description, flow and its whole team", () => {
    render(<CampaignPipeline slug="x" activePhase={0} />);
    KEYS.forEach((key, index) => {
      fireEvent.click(room(key));
      const phase = PHASES[index];
      expect(within(sheet()).getByTestId("ficha-description")).toHaveTextContent(
        phase?.description ?? "missing",
      );
      expect(within(sheet()).getByTestId("ficha-lee")).toHaveTextContent(phase?.reads ?? "missing");
      expect(within(sheet()).getByTestId("ficha-escribe")).toHaveTextContent(
        phase?.writes ?? "missing",
      );
      expect(
        within(sheet())
          .getAllByTestId("ficha-team-member")
          .map((m) => m.querySelector(".tm-role")?.textContent),
      ).toEqual(
        {
          research: ["researcher"],
          product: ["product-manager"],
          design: ["designer", "copywriter"],
          architecture: ["architect"],
          build: ["implementer", "reviewer", "analytics", "security-auditor"],
          release: ["devops"],
        }[key],
      );
    });
  });
});

describe("commands (AC-02-010.9/.10)", () => {
  it("no sheet leaks <idea>, spec and explore carry the slug, in-project commands do not", () => {
    render(<CampaignPipeline slug="my-slug" activePhase={0} />);
    for (const key of KEYS) {
      fireEvent.click(room(key));
      expect(sheet()).not.toHaveTextContent("<idea>");
      for (const command of commands()) {
        const carriesSlug = /pandacorp:(spec|explore)/.test(command);
        expect(command.includes("my-slug")).toBe(carriesSlug);
      }
    }
  });

  it("explore is second in research and absent elsewhere", () => {
    render(<CampaignPipeline slug="x" activePhase={1} />);
    fireEvent.click(room("research"));
    expect(commands()[0]).toContain("/pandacorp:spec x");
    expect(commands()[1]).toContain("/pandacorp:explore x");
    for (const key of KEYS.slice(1)) {
      fireEvent.click(room(key));
      expect(sheet()).not.toHaveTextContent("/pandacorp:explore");
    }
  });

  it("every implement sheet offers the picker the frozen prototype draws (AC-02-010.9)", () => {
    render(<CampaignPipeline slug="x" activePhase={3} />);
    expect(commands()[0]).toContain("/pandacorp:implement");
    expect(within(sheet()).getByText("Elegir modo de construcción")).toBeInTheDocument();
  });

  it("the build sheet offers the shared picker and never a select (AC-11-005.3)", () => {
    render(<CampaignPipeline slug="x" activePhase={4} />);
    expect(
      within(sheet()).getByText("Elegir modo de construcción").closest("details"),
    ).toBeTruthy();
    expect(within(sheet()).getByTestId("build-mode-picker")).toBeInTheDocument();
    expect(within(sheet()).queryByRole("combobox")).toBeNull();
  });
});

describe("forge link (AC-02-010.5/.7)", () => {
  it("only from the build phase onward, only with forgeHref, only on the build sheet", () => {
    const view = render(<CampaignPipeline slug="x" activePhase={3} forgeHref="/f" />);
    fireEvent.click(room("build"));
    expect(screen.queryByRole("link", { name: "Entrar a La Fragua" })).toBeNull();
    view.unmount();
    render(<CampaignPipeline slug="x" activePhase={4} />);
    expect(screen.queryByRole("link", { name: "Entrar a La Fragua" })).toBeNull();
  });
});

describe("motion and live markers (AC-02-010.11, ambient roam amendment)", () => {
  it("the current cast roams while idle; halo and speech need a running agent", () => {
    mockReducedMotion(false);
    render(<CampaignPipeline slug="x" activePhase={0} />);
    expect(screen.getByTestId("campaign-cast-research")).toHaveAttribute("data-motion", "roaming");
    expect(screen.getByTestId("campaign-cast-product")).toHaveAttribute("data-motion", "static");
    expect(screen.queryByTestId("campaign-sprite-halo")).toBeNull();
    expect(screen.queryByTestId("campaign-sprite-speech")).toBeNull();
    cleanup();
    render(<CampaignPipeline slug="x" activePhase={1} running />);
    expect(screen.getByTestId("campaign-cast-research")).toHaveAttribute("data-motion", "idle");
    expect(screen.getByTestId("campaign-sprite-halo")).toBeInTheDocument();
  });

  it("reduced motion renders all static and never moves a sprite", () => {
    mockReducedMotion(true);
    vi.useFakeTimers();
    render(<CampaignPipeline slug="x" activePhase={2} running />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();
    for (const key of KEYS)
      expect(screen.getByTestId(`campaign-cast-${key}`)).toHaveAttribute("data-motion", "static");
    for (const sprite of screen.getAllByTestId("campaign-sprite"))
      expect(sprite.style.transform).toBe("");
  });

  it("a failed sprite and room image leave the words, never a broken image", () => {
    render(<CampaignPipeline slug="x" activePhase={0} />);
    for (const image of Array.from(room("research").getElementsByTagName("img")))
      fireEvent.error(image);
    expect(room("research").getElementsByTagName("img")).toHaveLength(0);
    expect(room("research")).toHaveTextContent("Investigación");
  });
});

describe("module boundaries (DoD)", () => {
  const dir = path.resolve("src/components/modules/CampaignPipeline");
  const sources = readdirSync(dir)
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => readFileSync(path.join(dir, file), "utf8"));

  it("imports nothing from party and never says Claude Design", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/modules\/party/);
      expect(source).not.toMatch(/Claude Design/);
    }
  });

  it("the read-only campaign has no fetch, server action or storage write of its own", () => {
    for (const source of sources) expect(source).not.toMatch(/fetch\(|localStorage|use server/);
  });
});
