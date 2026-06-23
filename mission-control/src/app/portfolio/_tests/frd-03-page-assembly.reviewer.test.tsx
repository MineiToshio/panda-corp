/**
 * FRD-03 REVIEWER — adversarial assembly test over the REAL PortfolioPage (DR-015, DR-050).
 *
 * The two prior reopens were the same failure class: every component is green in
 * isolation, but the ASSEMBLED page (page.tsx → SelectableProjectRail + WorkspaceSlot)
 * dropped acceptance criteria. The existing reviewer tests render SelectableProjectRail
 * directly; NONE renders the actual async Server Component `PortfolioPage`. These tests
 * render the page itself, end to end, so the selection wiring + the snapshot/recovery
 * contract are verified on the surface the user actually sees.
 *
 * Edge cases the implementers did NOT write:
 *   - AC-03-005.1 — no ?project param → first active project selected; the SAME slug
 *     reaches BOTH the rail (data-selected) AND the WorkspaceSlot (data-slug). The prior
 *     bug class was "rail and slot disagree" / "default never reaches the slot".
 *   - AC-03-004.1 — ?project=<name> → that project selected in rail AND slot together.
 *   - unmatched ?project → graceful fall back to the first project (no blank slot).
 *   - AC-03-003.1 + AC-03-006.2/.3 reach the LIVE page (not just the rail in isolation):
 *     a shipped row's snapshot and a missing-path row's badge+recovery are in the DOM.
 *   - snapshot leakage guard: a NON-release row carrying a snapshot would still render
 *     it (the rail renders on `snapshot !== undefined`, not on stage) — assert the page
 *     does not surface a snapshot on a building row that has none. (DR-085)
 *
 * Anchored in: AC-03-003.1, AC-03-004.1, AC-03-005.1, AC-03-006.2/.3 → CMP-03-rail +
 * CMP-03-workspace-slot through page.tsx (the LIVE surface).
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";

function status(phase: string, running?: boolean): StatusResult {
  return {
    present: true,
    malformed: false,
    status: { phase: phase as never, ...(running !== undefined ? { running } : {}) },
  };
}

const absentStatus: StatusResult = { present: false, malformed: false, status: null };

const BUILDING: ProjectListItem = {
  name: "alpha",
  path: "/p/alpha",
  status: status("implementation", true),
  exists: true,
  stage: "implementation",
  running: true,
};

const SHIPPED: ProjectListItem = {
  name: "beta-shipped",
  path: "/p/beta-shipped",
  status: status("release", false),
  exists: true,
  stage: "release",
  running: false,
  snapshot: { users: "742", returnMetric: "$1 900 MRR", verdict: "double-down" },
};

const BROKEN_WITH_REPO: ProjectListItem = {
  name: "gamma-gone",
  path: "/p/gamma-gone",
  repo: "https://github.com/acme/gamma.git",
  status: absentStatus,
  exists: false,
  stage: "implementation",
  running: undefined,
};

// activeProjects() is mocked so the page renders a deterministic, in-memory list
// (the real reader hits the factory portfolio on disk; not what we want to assert).
const mockItems: ProjectListItem[] = [BUILDING, SHIPPED, BROKEN_WITH_REPO];

vi.mock("@/lib/portfolio/portfolio", () => ({
  activeProjects: () => mockItems,
}));

// Import AFTER the mock is registered.
import PortfolioPage from "../page";

function makeSearchParams(
  params: Record<string, string | string[] | undefined>,
): Promise<Record<string, string | string[] | undefined>> {
  return Promise.resolve(params);
}

async function renderPage(
  params: Record<string, string | string[] | undefined> = {},
): Promise<void> {
  const ui = await PortfolioPage({ searchParams: makeSearchParams(params) });
  render(ui);
}

describe("FRD-03 page assembly — the LIVE PortfolioPage (reviewer)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("AC-03-005.1 — no ?project: first project selected; same slug reaches rail AND slot", async () => {
    await renderPage({});

    // The first active project (alpha) is the default selection in the rail.
    const alphaRow = screen.getByRole("article", { name: /alpha/i });
    expect(alphaRow.getAttribute("data-selected")).toBe("true");

    // The OTHER rows are not selected.
    expect(
      screen.getByRole("article", { name: /beta-shipped/i }).getAttribute("data-selected"),
    ).toBe("false");

    // The workspace slot carries the SAME slug as the selected rail row (rail/slot agree).
    const slot = screen.getByTestId("workspace-slot");
    expect(slot.getAttribute("data-slug")).toBe("alpha");
  });

  it("AC-03-004.1 — ?project=<name>: that project selected in rail AND slot together", async () => {
    await renderPage({ project: "beta-shipped" });

    expect(
      screen.getByRole("article", { name: /beta-shipped/i }).getAttribute("data-selected"),
    ).toBe("true");
    expect(screen.getByRole("article", { name: /alpha/i }).getAttribute("data-selected")).toBe(
      "false",
    );
    expect(screen.getByTestId("workspace-slot").getAttribute("data-slug")).toBe("beta-shipped");
  });

  it("an unmatched ?project falls back to the first project (no blank slot)", async () => {
    await renderPage({ project: "does-not-exist" });

    expect(screen.getByRole("article", { name: /alpha/i }).getAttribute("data-selected")).toBe(
      "true",
    );
    const slot = screen.getByTestId("workspace-slot");
    expect(slot.getAttribute("data-slug")).toBe("alpha");
  });

  it("a shipped project's rail row carries NO business snapshot on the LIVE page (prototype `.rail`)", async () => {
    await renderPage({});

    // The rail item is name + stage + count dots only; the business snapshot (the
    // "herramienta interna" return chip included) does not belong in the sidebar.
    const shippedRow = screen.getByRole("article", { name: /beta-shipped/i });
    expect(within(shippedRow).queryByTestId("business-snapshot")).toBeNull();
    expect(within(shippedRow).queryByText("$1 900 MRR")).toBeNull();
    expect(within(shippedRow).queryByText("double-down")).toBeNull();
  });

  it("AC-03-006.2/.3 — a missing-path project shows badge + copyable recovery on the LIVE page", async () => {
    await renderPage({});

    const goneRow = screen.getByRole("article", { name: /gamma-gone/i });
    expect(within(goneRow).queryByText(/ruta no encontrada|path not found/i)).not.toBeNull();
    expect(within(goneRow).queryByText(/git clone/i)).not.toBeNull();
    expect(within(goneRow).queryByText(/sync-portfolio/i)).not.toBeNull();
  });

  it("a building row carries NO business snapshot (no cross-stage snapshot leakage)", async () => {
    await renderPage({});

    const buildingRow = screen.getByRole("article", { name: /alpha/i });
    expect(within(buildingRow).queryByTestId("business-snapshot")).toBeNull();
    // ...and no spurious not-found badge on a present path.
    expect(within(buildingRow).queryByText(/ruta no encontrada|path not found/i)).toBeNull();
  });
});
