/**
 * WO-07-007 — Page-level integration test (reviewer / adversarial)
 *
 * Verifies the REAL data-flow from page.tsx → ConfigurationShell → AgentList:
 * readAgents() + computeAgentLevel() must be called by the Server Component and
 * passed as `agentsData` so the Agents tab actually shows agent cards.
 *
 * Regression guard: the original implementation (before this fix) never called
 * readAgents() in page.tsx, causing the Agents tab to always render an empty
 * list — the bug found by the FRD-07 gate reviewer.
 *
 * Strategy: point PANDACORP_FACTORY_ROOT at the real factory root (the panda-corp
 * repo that contains plugin/agents/), import the real ConfigurationPage default
 * export (without mocking reference or gamification), render it, navigate to the
 * Agents tab, and assert that at least one agent-card is present.
 *
 * This test intentionally does NOT mock readAgents / computeAgentLevel so the
 * full page→shell→list data flow is exercised (AC-07-007.1 end-to-end).
 *
 * EARS AC-07-007.1: The Agents section SHALL show, per agent, a pixel-art
 *   avatar, its level and its title — confirmed by agent-card count > 0.
 */

import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// PANDACORP_FACTORY_ROOT override — point at the real factory so readAgents()
// finds the real plugin/agents/ directory (14 agents).
// ---------------------------------------------------------------------------

const FACTORY_ROOT = path.resolve(__dirname, "../../../../../"); // panda-corp root

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

// ---------------------------------------------------------------------------
// Helper — import and render the REAL ConfigurationPage Server Component.
//
// ConfigurationPage is a synchronous Server Component that reads from the fs.
// In Vitest + jsdom, Server Components are plain functions — we import and
// call the default export directly; no mock needed for the readers.
// ---------------------------------------------------------------------------

async function renderRealPage() {
  // Dynamic import ensures the module is re-evaluated with the updated env var.
  // This is important because resolveFactoryRoot() reads the env at call-time,
  // not at module-load time — so a static import would also work, but dynamic
  // import is defensive here in case any module caches the root at load time.
  const { default: ConfigurationPage } = await import("../page");
  const element = ConfigurationPage();
  return render(element);
}

// ---------------------------------------------------------------------------
// Integration tests (AC-07-007.1 end-to-end through the REAL page)
// ---------------------------------------------------------------------------

describe("frd-07: ConfigurationPage — AC-07-007.1 real data-flow (reviewer integration)", () => {
  it("frd-07: INTEGRATION — renders without crashing when wired to the real factory", async () => {
    await expect(renderRealPage()).resolves.toBeDefined();
  });

  it("frd-07: INTEGRATION (AC-07-007.1) — Agents tab shows at least one agent-card from the real plugin/agents/", async () => {
    await renderRealPage();
    // Navigate to the Agents tab
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    // MUST have at least one agent card from the real plugin/agents/ directory
    // (the factory has 14 agent files: backend-dev, frontend-dev, researcher, etc.)
    const cards = screen.getAllByTestId("agent-card");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("frd-07: INTEGRATION (AC-07-007.1) — each agent card shows an avatar", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const avatars = screen.getAllByTestId("agent-avatar");
    expect(avatars.length).toBeGreaterThan(0);
  });

  it("frd-07: INTEGRATION (AC-07-007.1) — each agent card shows a level (at least Nv 1 for zero XP)", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const levels = screen.getAllByTestId("agent-card-level");
    expect(levels.length).toBeGreaterThan(0);
    // With no dashboard events in CI, XP is 0 → level 1 (Apprentice).
    // Verify the level contains a digit — honesty, not fake.
    expect(levels[0]?.textContent).toMatch(/\d/);
  });

  it("frd-07: INTEGRATION (AC-07-007.1) — each agent card shows a title (Apprentice at minimum)", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const titles = screen.getAllByTestId("agent-card-title");
    expect(titles.length).toBeGreaterThan(0);
    // At zero XP, every agent is Apprentice (honest zero state, AC-07-007.3)
    expect(titles[0]?.textContent).toBeTruthy();
  });

  it("frd-07: INTEGRATION (AC-07-007.2) — clicking an agent card opens the XP detail panel", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const cards = screen.getAllByTestId("agent-card");
    // biome-ignore lint/style/noNonNullAssertion: cards.length > 0 asserted in prior test
    fireEvent.click(cards[0]!);
    expect(screen.getByTestId("agent-detail")).toBeDefined();
    expect(screen.getByTestId("xp-bar")).toBeDefined();
  });

  it("frd-07: INTEGRATION (AC-07-007.3) — zero-XP bar fill is 0% (honest, no fake progress)", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const cards = screen.getAllByTestId("agent-card");
    // biome-ignore lint/style/noNonNullAssertion: cards.length > 0 asserted in prior test
    fireEvent.click(cards[0]!);
    const fill = screen.getByTestId("xp-bar-fill");
    // With no real events, XP is 0 → fill should be 0% (AC-07-007.3 no fake bar)
    const widthNum = Number.parseFloat(fill.style.width);
    expect(widthNum).toBe(0);
  });
});
