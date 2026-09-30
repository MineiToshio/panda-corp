/**
 * The LIVE PortfolioPage shows the last-sync chip (REQ-03-007).
 *
 * Canary defect #4: the chip existed only on a component no route mounted, so it was visible
 * nowhere in the running app. Rendering the real async page (not the rail in isolation) is what
 * proves the chip is reachable on the surface the owner sees.
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";

const ALPHA: ProjectListItem = {
  name: "alpha",
  path: "/p/alpha",
  status: { present: true, malformed: false, status: { phase: "implementation", running: true } },
  exists: true,
  stage: "implementation",
  running: true,
  lastSync: "2026-09-22",
};

vi.mock("@/lib/portfolio/portfolio", () => ({
  railProjects: () => [ALPHA],
}));

import PortfolioPage from "../page";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-24T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PortfolioPage — last-sync chip on the mounted rail", () => {
  it("AC-03-007.3 — the project's row in the page shows the relative last sync", async () => {
    render(await PortfolioPage({ searchParams: Promise.resolve({}) }));

    const row = screen.getByRole("article", { name: "Proyecto: alpha" });
    expect(within(row).getByTestId("portfolio-row-last-sync").textContent).toBe(
      "sync: hace 2 días",
    );
  });
});
