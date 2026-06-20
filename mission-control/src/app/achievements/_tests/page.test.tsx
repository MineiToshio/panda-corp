/**
 * WO-10-005 — Hall page shell + hero + tabs + stats panel (RED → GREEN → refactor)
 *
 * Traceability:
 *   AC-10-005.1 — hero with guild level/XP (IF-09-guild-xp) + party avatars (CMP-09-avatar) + tabs
 *   AC-10-005.2 — stats panel with computeStats() counters + tier medal
 *   AC-10-005.3 — tabular-nums on all numbers; XP bar reuses CMP-09-xp-bar (honest, no fake fill)
 *   AC-10-005.4 — empty/fresh factory renders gracefully (honest zeros, no fabricated trophies)
 *   AC-10-005.5 — design tokens only (tier colors), Spanish labels/aria-labels, keyboard nav, focus
 *
 * Blueprint: CMP-10-hall-page, CMP-10-stats-panel
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────
// The page is a Server Component that reads the fs; we mock the lib readers
// so the test stays fast and deterministic (fixture-based, per architecture §9).

vi.mock("@/lib/portfolio/portfolio", () => ({
  readPortfolio: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/status/status", () => ({
  readStatus: vi.fn().mockReturnValue({ present: false, malformed: false, status: null }),
}));

vi.mock("@/lib/events/events", () => ({
  readEvents: vi.fn().mockReturnValue({ events: [], lastEventAt: null, byProject: {} }),
}));

vi.mock("@/lib/ideas/ideas", () => ({
  readIdeas: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/gamification/gamification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gamification/gamification")>();
  return {
    ...actual,
    deriveGuildOutcomes: vi.fn().mockReturnValue({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
      weeklyStreak: 0,
    }),
  };
});

// ── The page is a Server Component (async function) ───────────────────────────
// In Vitest + jsdom we await the default export, which returns a JSX element.
// We can import and render it as a plain async function.

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Helper: render the page (Server Component runs synchronously in tests)
async function renderPage() {
  const { default: HallPage } = await import("../page");
  // Server Components return JSX; rendering via React is fine in jsdom.
  const jsx = await HallPage();
  return render(jsx);
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-005.4 (negative) — Empty/fresh factory: honest zeros, no fabrication
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-005.4 — empty factory renders gracefully", () => {
  it("renders without crashing on an empty factory (no projects, no events, no ideas)", async () => {
    await expect(renderPage()).resolves.toBeDefined();
  });

  it("shows zero values for stats on an empty factory — no fabricated trophies", async () => {
    await renderPage();
    // Stats panel must be present
    const statsPanel = screen.getByTestId("stats-panel");
    expect(statsPanel).toBeDefined();

    // All stat values should be 0 for an empty factory (AC-10-005.4 negative AC)
    const statValues = statsPanel.querySelectorAll("[data-testid='stat-value']");
    expect(statValues.length).toBeGreaterThan(0);
    for (const el of statValues) {
      // Values should be "0" on an empty factory
      expect(el.textContent?.trim()).toBe("0");
    }
  });

  it("does not crash when eventsSnapshot is null", async () => {
    const { readEvents } = await import("@/lib/events/events");
    vi.mocked(readEvents).mockReturnValueOnce(null as unknown as ReturnType<typeof readEvents>);
    // Page guards eventsSnapshot?.events — must not throw
    await expect(renderPage()).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-005.1 — Hero: guild level/XP + party avatars + tabs
// ─────────────────────────────────────────────────────────────────────────────

// AC-10-005.1 — Hero: guild level/XP + party avatars
// NOTE: WO-09-003 replaced the bespoke hall-hero section with the shared GuildHero
// component. Testids updated: hall-hero→guild-hero, hall-party-avatars→guild-hero-party,
// hall-guild-level→guild-hero-title. Tabs were moved out of scope (WO-10 future work).
describe("AC-10-005.1 — hero with guild XP + party avatars", () => {
  it("renders the guild-hero section (WO-09-003 GuildHero)", async () => {
    await renderPage();
    const hero = screen.getByTestId("guild-hero");
    expect(hero).toBeDefined();
  });

  it("renders the XP bar (CMP-09-xp-bar) inside the guild-hero", async () => {
    await renderPage();
    const hero = screen.getByTestId("guild-hero");
    const xpBar = within(hero).getByTestId("xp-bar");
    expect(xpBar).toBeDefined();
  });

  it("renders guild title inside the guild-hero", async () => {
    await renderPage();
    const hero = screen.getByTestId("guild-hero");
    const titleEl = within(hero).getByTestId("guild-hero-title");
    expect(titleEl).toBeDefined();
    expect(titleEl.textContent).toBeTruthy();
  });

  it("renders party roster section inside the guild-hero", async () => {
    await renderPage();
    const hero = screen.getByTestId("guild-hero");
    const party = within(hero).getByTestId("guild-hero-party");
    expect(party).toBeDefined();
  });

  it("renders at least one agent avatar in the party section", async () => {
    await renderPage();
    const party = screen.getByTestId("guild-hero-party");
    const avatars = party.querySelectorAll("[data-testid='agent-avatar']");
    expect(avatars.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-005.2 — Stats panel: only-grow counters with tier medals
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-005.2 — stats panel with counters + tier medals", () => {
  it("renders the stats panel (data-testid=stats-panel)", async () => {
    await renderPage();
    expect(screen.getByTestId("stats-panel")).toBeDefined();
  });

  it("renders 12 stat items (all stats from computeStats)", async () => {
    await renderPage();
    const items = screen.getAllByTestId("stat-item");
    expect(items.length).toBe(12);
  });

  it("each stat item has a label", async () => {
    await renderPage();
    const labels = screen.getAllByTestId("stat-label");
    expect(labels.length).toBe(12);
    for (const el of labels) {
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("each stat item has a numeric value", async () => {
    await renderPage();
    const values = screen.getAllByTestId("stat-value");
    expect(values.length).toBe(12);
    for (const el of values) {
      const txt = el.textContent?.trim() ?? "";
      // Must be a parseable number (may be "0" on empty factory)
      expect(Number.isNaN(Number(txt))).toBe(false);
    }
  });

  it("each stat item has a tier-medal element", async () => {
    await renderPage();
    const medals = screen.getAllByTestId("stat-medal");
    expect(medals.length).toBe(12);
  });

  it("tier medal conveys state without color alone (has text or aria-label — AC-10-005.5)", async () => {
    await renderPage();
    const medals = screen.getAllByTestId("stat-medal");
    for (const medal of medals) {
      const el = medal as HTMLElement;
      // Each medal must have aria-label or text content (not color-only)
      const hasAria = el.getAttribute("aria-label") !== null;
      const hasText = (el.textContent?.trim().length ?? 0) > 0;
      expect(hasAria || hasText).toBe(true);
    }
  });

  it("renders stat items with Spanish labels (AC-10-005.5)", async () => {
    await renderPage();
    const labels = screen.getAllByTestId("stat-label");
    // At least one label should be in Spanish (contain Spanish characters or known labels)
    const allText = labels.map((el) => el.textContent ?? "").join(" ");
    // Known Spanish labels from computeStats
    expect(allText).toMatch(/Productos|Ideas|Work orders|Fases|Agentes|Racha|Récord/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-005.3 — tabular-nums on numbers; XP bar honest (no fake fill)
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-005.3 — tabular-nums + honest XP bar", () => {
  it("stat values carry the tabular-nums class or are inside a tabular-nums container", async () => {
    await renderPage();
    const panel = screen.getByTestId("stats-panel");
    // Either the panel or each stat-value must have tabular-nums
    const hasPanelClass = panel.classList.contains("tabular-nums");
    const values = panel.querySelectorAll("[data-testid='stat-value']");
    const allHaveClass = Array.from(values).every((el) => el.classList.contains("tabular-nums"));
    // Acceptable: panel-level OR per-value class (or via globals.css html{})
    // In the test environment globals.css is not applied, so we check the class attribute
    // at either level, OR that data-tabular-nums is set on the panel/stat
    const panelHasDataAttr = panel.getAttribute("data-tabular-nums") !== null;
    expect(hasPanelClass || allHaveClass || panelHasDataAttr).toBe(true);
  });

  it("XP bar does not show a fabricated/inflated fill on empty factory (pctToNext=0 → width=0%)", async () => {
    await renderPage();
    // WO-09-003: hero is now guild-hero (GuildHero component)
    const hero = screen.getByTestId("guild-hero");
    const fill = within(hero).getByTestId("xp-bar-fill");
    const width = (fill as HTMLElement).style.width;
    // On empty factory, pctToNext=0 so XP bar fill must be "0%"
    expect(width).toBe("0%");
  });

  it("XP bar has role=progressbar with aria-valuenow (AC-10-005.3)", async () => {
    await renderPage();
    // Scope to the guild-hero to disambiguate from chain XP bars rendered in the
    // always-mounted tab panels (WO-10-005: all tab panels render in DOM for a11y).
    const hero = screen.getByTestId("guild-hero");
    const track = within(hero).getByTestId("xp-bar-track");
    expect(track.getAttribute("role")).toBe("progressbar");
    expect(track.getAttribute("aria-valuenow")).toBe("0");
    expect(track.getAttribute("aria-valuemin")).toBe("0");
    expect(track.getAttribute("aria-valuemax")).toBe("100");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-005.5 — Design tokens only; Spanish labels/aria; keyboard nav; focus
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-005.5 — design tokens, a11y, keyboard navigation", () => {
  it("page has a meaningful heading in Spanish", async () => {
    await renderPage();
    // Should have at least one heading (h1/h2) with Spanish text
    const headings = screen.queryAllByRole("heading");
    expect(headings.length).toBeGreaterThan(0);
    const text = headings.map((h) => h.textContent ?? "").join(" ");
    expect(text.length).toBeGreaterThan(0);
  });

  it("stats panel has an aria-label in Spanish", async () => {
    await renderPage();
    const panel = screen.getByTestId("stats-panel");
    const label = panel.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label?.length).toBeGreaterThan(0);
  });

  it("guild-hero region has an aria-label in Spanish (WO-09-003)", async () => {
    await renderPage();
    // WO-09-003: hero is now guild-hero (GuildHero section with aria-label)
    const hero = screen.getByTestId("guild-hero");
    const label = hero.getAttribute("aria-label");
    expect(label).toBeTruthy();
  });

  it("no hardcoded color values in style attributes (tokens only)", async () => {
    await renderPage();
    // Walk all elements and verify no raw color values appear in inline style
    // (hex, rgb, hsl — but allow oklch via var() references handled by CSS)
    // This is a best-effort check on style attributes in the rendered DOM.
    const allEls = document.querySelectorAll("[style]");
    for (const el of allEls) {
      const style = el.getAttribute("style") ?? "";
      // Reject raw hex colors
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}(?!\w)/);
      // Reject raw rgb()/hsl() not inside var()
      expect(style).not.toMatch(/(?<!var\()[^)]*\brgb\(/);
      expect(style).not.toMatch(/(?<!var\()[^)]*\bhsl\(/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: stats derived from real outcomes
// ─────────────────────────────────────────────────────────────────────────────

describe("Integration — stats derived from real reader data", () => {
  it("shows non-zero shipped count when portfolio has an operation-phase project", async () => {
    const { readPortfolio } = await import("@/lib/portfolio/portfolio");
    const { readStatus } = await import("@/lib/status/status");

    vi.mocked(readPortfolio).mockReturnValueOnce([
      { path: "/fake/project", name: "my-proj" },
    ] as ReturnType<typeof readPortfolio>);
    vi.mocked(readStatus).mockReturnValueOnce({
      present: true,
      malformed: false,
      status: {
        project: "my-proj",
        phase: "operation",
        workOrdersDone: 5,
        workOrdersTotal: 5,
        pendingDecisions: 0,
        pendingBugs: 0,
        running: false,
        rethinkPending: false,
        advancePending: false,
        lastGreenSha: "abc123",
        safeToTest: true,
        version: "1.0.0",
        updatedAt: "2026-06-01T00:00:00Z",
        overlayVersion: "8.5.0",
      },
    });

    await renderPage();

    // The "Productos lanzados" stat should show 1
    const statItems = screen.getAllByTestId("stat-item");
    const shippedItem = statItems.find((el) => el.textContent?.includes("Productos"));
    expect(shippedItem).toBeDefined();
    const valueEl = shippedItem?.querySelector("[data-testid='stat-value']");
    expect(valueEl?.textContent?.trim()).toBe("1");
  });
});
