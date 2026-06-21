/**
 * DR-057 Reuse-before-create enforcement tests (WO-07-005, pass 4)
 *
 * These tests fail RED if SectionTabs or StandardsSection.DetailPanel hand-roll
 * their own tab UI instead of delegating to the shared Tabs/SubTabs primitive
 * (src/components/core/Tabs/Tabs.tsx). They are the mutation-confirming anchor
 * that proves the DR-057 fix is genuine — not decorative.
 *
 * Tests are intentionally anchored to observable DOM structure so a refactor that
 * keeps the same public output but removes the shared primitive still fails.
 */

import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Real ConfigurationPage wired to the real factory tree
const FACTORY_ROOT = path.resolve(__dirname, "../../../../../");

let prevFactoryRoot: string | undefined;

beforeEach(() => {
  prevFactoryRoot = process.env.PANDACORP_FACTORY_ROOT;
  process.env.PANDACORP_FACTORY_ROOT = FACTORY_ROOT;
});

afterEach(() => {
  if (prevFactoryRoot === undefined) {
    delete process.env.PANDACORP_FACTORY_ROOT;
  } else {
    process.env.PANDACORP_FACTORY_ROOT = prevFactoryRoot;
  }
  cleanup();
});

async function renderRealPage() {
  const { default: ConfigurationPage } = await import("../page");
  return render(ConfigurationPage());
}

// ---------------------------------------------------------------------------
// SectionTabs delegates to shared Tabs (DR-057 / DR-062)
// ---------------------------------------------------------------------------

describe("DR-057 — SectionTabs delegates to shared Tabs primitive", () => {
  it("the config tab bar renders via the shared Tabs component (data-testid=tabs-root)", async () => {
    await renderRealPage();
    // The shared Tabs component renders data-testid="tabs-root" on the tablist div.
    // If SectionTabs hand-rolls its own tablist, this will be absent.
    const tabsRoot = screen.queryByTestId("tabs-root");
    expect(
      tabsRoot,
      "SectionTabs must delegate to the shared Tabs primitive (data-testid='tabs-root' missing — DR-057)",
    ).not.toBeNull();
  });

  it("the shared Tabs root has data-level='sub' (correct level for section tabs)", async () => {
    await renderRealPage();
    const tabsRoot = screen.queryByTestId("tabs-root");
    expect(tabsRoot?.getAttribute("data-level")).toBe("sub");
  });

  it("all four section tab testids are reachable via the shared Tabs", async () => {
    await renderRealPage();
    for (const id of ["skills", "agents", "rules", "standards"]) {
      expect(
        screen.queryByTestId(`config-tab-${id}`),
        `config-tab-${id} must be reachable via the shared Tabs component`,
      ).not.toBeNull();
    }
  });

  it("clicking config-tab-agents switches to the agents panel", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    expect(screen.queryByTestId("config-section-agents")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// StandardsSection DetailPanel uses SubTabs (DR-057 / DR-062)
// ---------------------------------------------------------------------------

describe("DR-057 — StandardsSection DetailPanel uses SubTabs for Resumen/Detalle", () => {
  async function openFirstStandardDetail() {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-standards"));
    // Open the first standard item
    const items = screen.queryAllByRole("button", { expanded: false });
    const standardItem = items.find((el) =>
      (el.getAttribute("data-testid") ?? "").startsWith("standard-item-"),
    );
    if (!standardItem) throw new Error("No standard items rendered");
    fireEvent.click(standardItem);
    return standardItem;
  }

  it("the standard detail panel uses shared SubTabs (tabs-root present inside the detail)", async () => {
    await openFirstStandardDetail();
    // The standard detail panel contains its own SubTabs — there should be a second
    // tabs-root (inside the detail panel) after clicking a standard.
    const tabsRoots = screen.queryAllByTestId("tabs-root");
    expect(
      tabsRoots.length,
      "StandardsSection detail must use SubTabs — at least one more tabs-root expected inside detail",
    ).toBeGreaterThanOrEqual(2);
  });

  it("standard-tab-summary testid is reachable (Resumen tab)", async () => {
    await openFirstStandardDetail();
    expect(
      screen.queryByTestId("standard-tab-summary"),
      "standard-tab-summary must be present in the standard detail panel",
    ).not.toBeNull();
  });

  it("standard-tab-detail testid is reachable (Detalle tab)", async () => {
    await openFirstStandardDetail();
    expect(
      screen.queryByTestId("standard-tab-detail"),
      "standard-tab-detail must be present in the standard detail panel",
    ).not.toBeNull();
  });

  it("clicking Detalle tab shows the markdown body", async () => {
    await openFirstStandardDetail();
    const detailTab = screen.getByTestId("standard-tab-detail");
    fireEvent.click(detailTab);
    expect(
      screen.queryByTestId("standard-markdown-body"),
      "clicking Detalle tab must show the markdown body",
    ).not.toBeNull();
  });

  it("switching back to Resumen tab hides the markdown body", async () => {
    await openFirstStandardDetail();
    fireEvent.click(screen.getByTestId("standard-tab-detail"));
    fireEvent.click(screen.getByTestId("standard-tab-summary"));
    expect(
      screen.queryByTestId("standard-markdown-body"),
      "switching back to Resumen must hide the markdown body",
    ).toBeNull();
  });
});
