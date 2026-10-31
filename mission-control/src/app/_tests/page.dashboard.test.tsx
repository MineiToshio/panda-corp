import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import { render, screen, within } from "@testing-library/react";
import { renderToPipeableStream } from "react-dom/server.node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmbudoCard } from "@/app/(dashboard)/_components/EmbudoCard";
import { EnMarchaCard } from "@/app/(dashboard)/_components/EnMarchaCard";
import { FlightGroup } from "@/app/(dashboard)/_components/FlightGroup";
import HomePage from "@/app/page";
import { PROJECT } from "@/components/modules/ProjectCard/_tests/fixture";
import type { IdeaCard } from "@/lib/ideas/ideas";
import { countLaunched } from "@/lib/ideas/ideas";
import { deriveIdeaFunnel, ideaFunnel } from "@/lib/inicio/funnel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
beforeEach(() => {
  vi.stubEnv("PANDACORP_FACTORY_ROOT", path.resolve("e2e/fixtures/factory-root"));
});
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("Inicio command center", () => {
  it("AC-18-022.1: streams each block in column order under one page heading, with no page main", async () => {
    expect(() => ideaFunnel()).not.toThrow();
    // Inspect the complete SSR output, including chunks whose insertion scripts run only in browsers.
    const html = await new Promise<string>((resolve, reject) => {
      const output = new PassThrough();
      let result = "";
      output.on("data", (chunk) => {
        result += chunk.toString();
      });
      output.on("end", () => resolve(result));
      const { pipe } = renderToPipeableStream(<HomePage />, {
        onAllReady() {
          pipe(output);
        },
        onError: reject,
      });
    });
    // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted React SSR output, used only to inspect the streamed server tree.
    render(<div dangerouslySetInnerHTML={{ __html: html }} />);
    expect(screen.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    const headings = screen
      .getAllByRole("heading", { level: 2, hidden: true })
      .map((node) => node.textContent?.replace(/^Tu turno\d+$/, "Tu turno"));
    expect(headings).toEqual(
      expect.arrayContaining([
        "Tu turno",
        "Tu cartera",
        "Pulso",
        "Gremio",
        "Embudo de ideas",
        "Árboles de trabajo",
      ]),
    );
    expect(headings.indexOf("Tu turno")).toBeLessThan(headings.indexOf("Tu cartera"));
    expect(headings.indexOf("Tu cartera")).toBeLessThan(headings.indexOf("Pulso"));
    expect(headings.indexOf("Pulso")).toBeLessThan(headings.indexOf("Gremio"));
    expect(headings.indexOf("Gremio")).toBeLessThan(headings.indexOf("Embudo de ideas"));
    expect(headings.at(-1)).toBe("Árboles de trabajo");
    expect(screen.queryByText("Desde tu última visita")).not.toBeInTheDocument();
    const css = fs.readFileSync(
      path.resolve("src/app/(dashboard)/_components/Home.module.css"),
      "utf8",
    );
    expect(css).toMatch(/max-width: 1023px/);
    expect(html).toContain("home-grid");
  });
  it("AC-18-022.3: native groups start closed, toggle and navigate to their scoped work", () => {
    const group = {
      kind: "review" as const,
      rows: [
        {
          id: "WO-01-001",
          project: "Example",
          title: "WO-01-001 · Feature",
          href: "/portfolio/example/work-orders/WO-01-001/summary",
        },
      ],
    };
    render(<FlightGroup group={group} />);
    const title = screen.getByText("Esperan la revisión de su FRD");
    const details = title.closest("details");
    expect(details).not.toHaveAttribute("open");
    title.click();
    expect(details).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Abrir work order" })).toHaveAttribute(
      "href",
      group.rows[0]?.href,
    );
  });
  it("AC-18-022.3: an empty in-flight card is absent", () => {
    render(<EnMarchaCard groups={[]} />);
    expect(screen.queryByRole("heading", { name: "En marcha" })).not.toBeInTheDocument();
  });
  it("AC-18-022.4 REQ-18-014: phases derive from the board and launched uses the shared bridge, with discards separate", () => {
    const ideas: IdeaCard[] = [
      { slug: "research", title: "Research", status: "recommended", body: "" },
      { slug: "linked", title: "Linked", status: "in-pipeline", project: PROJECT.path, body: "" },
      { slug: "launch", title: "Launch", status: "shipped", body: "" },
      { slug: "discard", title: "Discard", status: "discarded", body: "" },
    ];
    const projects = [
      {
        ...PROJECT,
        source: {
          ...PROJECT.source,
          status: {
            present: true as const,
            malformed: false as const,
            status: { phase: "implementation" as const },
          },
        },
      },
    ];
    const funnel = deriveIdeaFunnel(ideas, projects);
    expect(funnel.rows.find((row) => row.phase === "release")?.count).toBe(
      countLaunched(
        ideas,
        projects.map((project) => project.source.status),
      ),
    );
    expect(funnel.rows.find((row) => row.phase === "implementation")?.count).toBe(1);
    expect(funnel.rows.find((row) => row.phase === "discovered")?.count).toBe(1);
    render(<EmbudoCard funnel={funnel} />);
    expect(screen.getByText("1 descartadas")).toBeVisible();
    expect(screen.getAllByRole("progressbar")).toHaveLength(6);
    expect(
      within(screen.getByRole("link", { name: "Abrir tablero" })).queryByRole("button"),
    ).not.toBeInTheDocument();
  });
});
