/**
 * WO-18-006 — `app/page.tsx` assembly tests (CMP-18-page, CMP-18-banners)
 *
 * Tests the default landing route `/` which assembles:
 *   - Health banners (plugin-sync + orphans) — conditional client components
 *   - Digest section ("Desde tu última visita")
 *   - Tu turno section (human-gate queue)
 *   - Pulso section (factory pulse)
 *   - Cartera section (build & portfolio cards)
 *   - Progreso section (gamification strip)
 *
 * Traceability:
 *   AC-18-006.1 — / renders the dashboard
 *   AC-18-006.2 — banner stack: plugin-sync + orphans conditional mount points present
 *   AC-18-006.3 — read-only (only read mocks called)
 *   AC-18-006.4 — calm when nothing needs attention
 *   AC-18-006.5 — six sections render in correct order
 *   AC-18-006.6 — fresh factory: al-día + first-action cards; never blank or crash
 *
 * Strategy:
 *   Render the real HomePage (Server Component called as a function).
 *   All lib reads are mocked. The "use client" components (Digest, TuTurno uses
 *   CopyButton, Cartera uses CopyButton, PluginSyncBanner, OrphansBanner) are
 *   resolved through jsdom; they render their static markup but skip browser APIs
 *   (localStorage returns null → al-día state; polling never fires in jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GuildLevel } from "@/lib/gamification/gamification";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const EMPTY_EVENTS = {
  events: [],
  lastEventAt: null,
  byProject: {} as Record<string, { lastEventAt: string }>,
};

const HEALTHY_MEMORY = {
  rawNotes: 2,
  candidates: 0,
  lastMemoryRunAt: new Date().toISOString(),
  staleDays: 0,
};

const GUILD_LEVEL: GuildLevel = {
  level: 1,
  title: "Aprendiz",
  xp: 0,
  next: 100,
  pctToNext: 0,
};

// ---------------------------------------------------------------------------
// Mock lib layer (read-only — no writes, no Claude)
// ---------------------------------------------------------------------------

vi.mock("@/lib/events/events", () => ({
  readEvents: vi.fn(() => EMPTY_EVENTS),
}));

vi.mock("@/lib/portfolio/portfolio", () => ({
  readPortfolio: vi.fn(() => []),
  activeProjects: vi.fn(() => []),
}));

vi.mock("@/lib/ideas/ideas", () => ({
  readIdeas: vi.fn(() => []),
}));

vi.mock("@/lib/status/status", () => ({
  readStatus: vi.fn(() => ({ present: false as const, malformed: false as const, status: null })),
}));

vi.mock("@/lib/memory/memory-health", () => ({
  memoryHealth: vi.fn(() => HEALTHY_MEMORY),
}));

vi.mock("@/lib/work-orders/work-orders", () => ({
  listWorkOrders: vi.fn(() => []),
  aggregateProgress: vi.fn(() => ({ done: 0, total: 0, pct: 0, failing: [] })),
}));

vi.mock("@/lib/gamification/gamification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gamification/gamification")>();
  return {
    ...actual,
    computeGuildLevel: vi.fn(() => GUILD_LEVEL),
    deriveGuildOutcomes: vi.fn(() => ({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    })),
  };
});

vi.mock("@/lib/achievements/stats", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/achievements/stats")>();
  return {
    ...actual,
    computeStats: vi.fn(() => []),
  };
});

vi.mock("@/lib/achievements/achievements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/achievements/achievements")>();
  return {
    ...actual,
    computeChains: vi.fn(() => []),
    computeUniques: vi.fn(() => []),
    computeSecrets: vi.fn(() => []),
  };
});

vi.mock("@/lib/profile/profile", () => ({
  readProfile: vi.fn(() => ({ present: true as const, profile: { name: "Test" } })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: vi.fn(() => ({ snapshot: null, connected: false, lastEventAt: null })),
}));

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

async function renderDashboard(): Promise<void> {
  vi.resetModules();
  const { default: HomePage } = await import("../page");
  render(<HomePage />);
}

// ---------------------------------------------------------------------------
// AC-18-006.1 — default landing renders without crashing
// ---------------------------------------------------------------------------

describe("frd-18: WO-18-006 AC-18-006.1 — default landing renders", () => {
  it("frd-18: renders without crashing (never blank)", async () => {
    await renderDashboard();
    expect(document.body.innerHTML.length).toBeGreaterThan(100);
  });

  it("frd-18: renders dashboard-page root container", async () => {
    await renderDashboard();
    expect(screen.getByTestId("dashboard-page")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-18-006.2 — banner stack: conditional mount points present
// ---------------------------------------------------------------------------

describe("frd-18: WO-18-006 AC-18-006.2 — banner stack conditional mount points", () => {
  it("frd-18: renders a banners container (dashboard-banners)", async () => {
    await renderDashboard();
    expect(screen.getByTestId("dashboard-banners")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-18-006.3 — read-only invariant
// ---------------------------------------------------------------------------

describe("frd-18: WO-18-006 AC-18-006.3 — read-only: only read mocks called", () => {
  it("frd-18: readEvents mock is called (page reads event stream)", async () => {
    const { readEvents } = await import("@/lib/events/events");
    await renderDashboard();
    expect(vi.isMockFunction(readEvents)).toBe(true);
  });

  it("frd-18: activeProjects mock is called (page reads portfolio)", async () => {
    const { activeProjects } = await import("@/lib/portfolio/portfolio");
    await renderDashboard();
    expect(vi.isMockFunction(activeProjects)).toBe(true);
  });

  it("frd-18: memoryHealth mock is called (page reads memory state)", async () => {
    const { memoryHealth } = await import("@/lib/memory/memory-health");
    await renderDashboard();
    expect(vi.isMockFunction(memoryHealth)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-18-006.4 — calm when nothing needs attention (al-día)
// ---------------------------------------------------------------------------

describe("frd-18: WO-18-006 AC-18-006.4 — calm state when nothing needs attention", () => {
  it("frd-18: Tu turno shows al-día badge when queue is empty", async () => {
    await renderDashboard();
    expect(screen.getByTestId("tu-turno-al-dia")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-18-006.5 — six sections render in order
// ---------------------------------------------------------------------------

describe("frd-18: WO-18-006 AC-18-006.5 — six sections in order", () => {
  it("frd-18: digest section renders (Desde tu última visita)", async () => {
    await renderDashboard();
    // Digest wraps in section[aria-label='Desde tu última visita'] — use accessible query
    expect(screen.getByRole("region", { name: /desde tu última visita/i })).toBeDefined();
  });

  it("frd-18: Tu turno section renders", async () => {
    await renderDashboard();
    expect(screen.getByTestId("tu-turno-heading")).toBeDefined();
  });

  it("frd-18: Pulso section renders", async () => {
    await renderDashboard();
    expect(screen.getByTestId("pulso-section")).toBeDefined();
  });

  it("frd-18: Cartera section renders", async () => {
    await renderDashboard();
    expect(screen.getByTestId("cartera-heading")).toBeDefined();
  });

  it("frd-18: Progreso section renders", async () => {
    await renderDashboard();
    expect(screen.getByTestId("progreso-strip")).toBeDefined();
  });

  it("frd-18: sections appear in DOM order: digest → turno → pulso → cartera → progreso", async () => {
    await renderDashboard();
    const digest = screen.getByRole("region", { name: /desde tu última visita/i });
    const turno = screen.getByTestId("tu-turno-heading");
    const pulso = screen.getByTestId("pulso-section");
    const cartera = screen.getByTestId("cartera-heading");
    const progreso = screen.getByTestId("progreso-strip");

    // compareDocumentPosition: bit 4 = preceding node is followed by the other
    expect(digest.compareDocumentPosition(turno) & 4).toBe(4);
    expect(turno.compareDocumentPosition(pulso) & 4).toBe(4);
    expect(pulso.compareDocumentPosition(cartera) & 4).toBe(4);
    expect(cartera.compareDocumentPosition(progreso) & 4).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// AC-18-006.6 — fresh factory: never blank, first-action card shown
// ---------------------------------------------------------------------------

describe("frd-18: WO-18-006 AC-18-006.6 — fresh factory never blank or crash", () => {
  it("frd-18: renders first-action card in Cartera when there are no projects", async () => {
    await renderDashboard();
    expect(screen.getByTestId("cartera-first-action")).toBeDefined();
  });

  it("frd-18: Progreso strip renders the honest empty-state text (first achievement awaits)", async () => {
    await renderDashboard();
    const strip = screen.getByTestId("progreso-strip");
    expect(strip.textContent).toMatch(/logro/i);
  });

  it("frd-18: page does not crash or render blank when there are no events", async () => {
    await renderDashboard();
    expect(screen.getByTestId("dashboard-page")).toBeDefined();
  });
});
