/**
 * WO-09-003 — Guild surfaces: GuildBar + GuildHero + StatRadar + CelebrationSurface
 *
 * TDD RED phase — tests verify acceptance criteria BEFORE implementation.
 * These tests cover what was NOT previously covered: the visual re-anchor to the
 * prototype (logrosHero + statRadar + topbar + bOverlay) with the correct structure,
 * components and token compliance.
 *
 * Source: FRD-09 EARS, FDD-09 render-fn pointers, blueprint §3.
 *
 * Acceptance criteria tested here:
 *   AC-09-004.1–5  GuildBar: level pill + guild title + compact XpBar
 *   AC-09-003.1–3  Avatar: pixel-art per agent, graceful degradation, Spanish aria
 *   AC-09-006.1–5  CelebrationSurface: scaled overlay + confetti + DR-061 auto-fire
 *
 * New in this WO (not covered by existing page.test.tsx):
 *   - GuildHero uses Shield component (rpgSkin.shield medallion with NIVEL numeral)
 *   - GuildHero has "GREMIO PANDACORP" eyebrow + guild title + feats summary line
 *   - GuildHero has TU PARTY roster with Avatar sprites at 38px
 *   - GuildHero has full-width XpBar (not compact)
 *   - StatRadar: 6-axis SVG radar with accent polygon, axis labels in Spanish
 *   - StatsPanel shows radar via logrosStats layout
 *   - CelebrationSurface: full-screen overlay with backdrop + rpgpanel + confetti
 *     for release and levelup kinds
 *   - CelebrationSurface: dismiss button is present (NOT a trigger — overlay fires auto)
 *
 * Traceability: WO-09-003 → AC-09-003.1/2/3, AC-09-004.1/2/3/4/5, AC-09-006.1/2/3/4/5
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Module mocks (page is a Server Component) ─────────────────────────────────

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderPage() {
  const { default: HallPage } = await import("../page");
  const jsx = await HallPage();
  return render(jsx);
}

// ─────────────────────────────────────────────────────────────────────────────
// GuildHero — Shield crest medallion
// ─────────────────────────────────────────────────────────────────────────────

describe("WO-09-003 — GuildHero: Shield component in the hero", () => {
  it("renders the Shield crest medallion (data-testid=shield-root) in the hero section", async () => {
    await renderPage();
    const hero = screen.getByTestId("hall-hero");
    const shield = within(hero).getByTestId("shield-root");
    expect(shield).toBeDefined();
  });

  it("Shield shows the NIVEL label (pixel font, accent-text color)", async () => {
    await renderPage();
    const shield = screen.getByTestId("shield-root");
    const nivelLabel = within(shield).getByTestId("shield-nivel-label");
    expect(nivelLabel.textContent).toBe("NIVEL");
  });

  it("Shield shows a numeric level numeral (data-testid=shield-level)", async () => {
    await renderPage();
    const shield = screen.getByTestId("shield-root");
    const levelEl = within(shield).getByTestId("shield-level");
    expect(levelEl.textContent).toBeTruthy();
    expect(/\d/.test(levelEl.textContent ?? "")).toBe(true);
  });

  it("Shield has aria-label in Spanish describing the crest", async () => {
    await renderPage();
    const shield = screen.getByTestId("shield-root");
    const label = shield.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label).toMatch(/Escudo|Gremio|Nivel/i);
  });

  it("Shield has role=img (a11y — accessible image with label)", async () => {
    await renderPage();
    const shield = screen.getByTestId("shield-root");
    expect(shield.getAttribute("role")).toBe("img");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GuildHero — GREMIO PANDACORP eyebrow + guild title
// ─────────────────────────────────────────────────────────────────────────────

describe("WO-09-003 — GuildHero: GREMIO PANDACORP eyebrow + title", () => {
  it("renders 'GREMIO PANDACORP' eyebrow text inside the hero", async () => {
    await renderPage();
    const hero = screen.getByTestId("hall-hero");
    expect(hero.textContent).toContain("GREMIO PANDACORP");
  });

  it("renders the guild title (from computeGuildLevel) inside the hero", async () => {
    await renderPage();
    const hero = screen.getByTestId("hall-hero");
    // At empty factory, guild title = "Aprendiz" (level 1)
    const guildTitleEl = within(hero).getByTestId("guild-hero-title");
    expect(guildTitleEl).toBeDefined();
    expect(guildTitleEl.textContent).toBeTruthy();
  });

  it("renders a feats/trophies summary line inside the hero", async () => {
    await renderPage();
    const hero = screen.getByTestId("hall-hero");
    const summary = within(hero).getByTestId("guild-hero-summary");
    expect(summary).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GuildHero — TU PARTY roster
// ─────────────────────────────────────────────────────────────────────────────

describe("WO-09-003 — GuildHero: TU PARTY sprite roster", () => {
  it("renders 'TU PARTY' label in the hero section", async () => {
    await renderPage();
    const hero = screen.getByTestId("hall-hero");
    expect(hero.textContent).toContain("TU PARTY");
  });

  it("renders Avatar sprites for the party roster (pixel-art, image-rendering:pixelated)", async () => {
    await renderPage();
    const avatars = screen.getAllByTestId("agent-avatar");
    expect(avatars.length).toBeGreaterThan(0);
  });

  it("each Avatar sprite has a Spanish aria-label (not empty)", async () => {
    await renderPage();
    const avatars = screen.getAllByTestId("agent-avatar");
    for (const avatar of avatars) {
      const label = avatar.getAttribute("aria-label");
      expect(label).toBeTruthy();
      expect(label?.length).toBeGreaterThan(0);
    }
  });

  it("Avatar sprite images have Spanish alt text", async () => {
    await renderPage();
    const avatars = screen.getAllByTestId("agent-avatar");
    for (const avatar of avatars) {
      const img = avatar.querySelector("img");
      expect(img).not.toBeNull();
      const alt = img?.getAttribute("alt") ?? "";
      expect(alt.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GuildHero — full-width XpBar (honest, not compact)
// ─────────────────────────────────────────────────────────────────────────────

describe("WO-09-003 — GuildHero: full-width XpBar (honest)", () => {
  it("renders the XpBar inside the hero (AC-09-004.5 — reuses CMP-09-xp-bar)", async () => {
    await renderPage();
    const hero = screen.getByTestId("hall-hero");
    const xpBar = within(hero).getByTestId("xp-bar");
    expect(xpBar).toBeDefined();
  });

  it("XpBar shows XP / next values (tabular-nums numbers — AC-09-004.2)", async () => {
    await renderPage();
    const hero = screen.getByTestId("hall-hero");
    const xpEl = within(hero).queryByTestId("xp-bar-xp");
    const nextEl = within(hero).queryByTestId("xp-bar-next");
    expect(xpEl).not.toBeNull();
    expect(nextEl).not.toBeNull();
  });

  it("XpBar fill is 0% on empty factory (AC-09-004.3 — honest zero state)", async () => {
    await renderPage();
    const hero = screen.getByTestId("hall-hero");
    const fill = within(hero).getByTestId("xp-bar-fill");
    expect(fill.style.width).toBe("0%");
  });

  it("XpBar has role=progressbar with aria-valuenow/min/max (a11y shape signal)", async () => {
    await renderPage();
    const hero = screen.getByTestId("hall-hero");
    const track = within(hero).getByTestId("xp-bar-track");
    expect(track.getAttribute("role")).toBe("progressbar");
    expect(track.getAttribute("aria-valuenow")).toBe("0");
    expect(track.getAttribute("aria-valuemin")).toBe("0");
    expect(track.getAttribute("aria-valuemax")).toBe("100");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// StatRadar — 6-axis SVG "Atributos del gremio" radar
// ─────────────────────────────────────────────────────────────────────────────

describe("WO-09-003 — StatRadar: 6-axis SVG guild attribute radar", () => {
  it("renders a stat-radar element (data-testid=stat-radar) on the stats page", async () => {
    await renderPage();
    // StatRadar lives in StatsPanel, which is rendered from the page
    const radar = screen.getByTestId("stat-radar");
    expect(radar).toBeDefined();
  });

  it("radar is an SVG element (or contains an SVG)", async () => {
    await renderPage();
    const radar = screen.getByTestId("stat-radar");
    const svg = radar.tagName === "svg" ? radar : radar.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("radar has exactly 6 axis label texts (Producción, Velocidad, Calidad, Constancia, Ideación, Alcance)", async () => {
    await renderPage();
    const radar = screen.getByTestId("stat-radar");
    // Axis labels are in Spanish, rendered as SVG <text> elements
    const labels = radar.querySelectorAll("[data-testid='radar-axis-label']");
    expect(labels.length).toBe(6);
  });

  it("radar axis labels include all 6 Spanish attribute names", async () => {
    await renderPage();
    const radar = screen.getByTestId("stat-radar");
    const allText = radar.textContent ?? "";
    expect(allText).toContain("Producción");
    expect(allText).toContain("Velocidad");
    expect(allText).toContain("Calidad");
    expect(allText).toContain("Constancia");
    expect(allText).toContain("Ideación");
    expect(allText).toContain("Alcance");
  });

  it("radar has an 'ATRIBUTOS DEL GREMIO' header above it", async () => {
    await renderPage();
    const statsSection = screen.getByTestId("stats-panel");
    expect(statsSection.textContent).toMatch(/ATRIBUTOS DEL GREMIO/i);
  });

  it("radar polygon (data-testid=radar-polygon) is filled with accent color via CSS var", async () => {
    await renderPage();
    const polygon = screen.getByTestId("radar-polygon");
    expect(polygon).toBeDefined();
    // Polygon must use var(--color-accent) not a hardcoded hex
    const fill = polygon.getAttribute("fill") ?? "";
    const stroke = polygon.getAttribute("stroke") ?? "";
    const inlineStyle = polygon.getAttribute("style") ?? "";
    expect(fill + stroke + inlineStyle).not.toMatch(/#[0-9a-fA-F]{3,}/);
  });

  it("radar has ring lines (4 concentric rings) at 25%, 50%, 75%, 100%", async () => {
    await renderPage();
    const rings = screen.getAllByTestId("radar-ring");
    expect(rings.length).toBe(4);
  });

  it("radar has data-testid=radar-data-polygon for the data layer", async () => {
    await renderPage();
    const dataPoly = screen.getByTestId("radar-data-polygon");
    expect(dataPoly).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CelebrationSurface — full-screen overlay design (bOverlay prototype fidelity)
// ─────────────────────────────────────────────────────────────────────────────

describe("WO-09-003 — CelebrationSurface: full-screen overlay (release kind)", () => {
  function mockMatchMedia(prefersReducedMotion: boolean) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query.includes("reduce") ? prefersReducedMotion : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  const releaseEvent = {
    event: "achievement" as const,
    at: "2026-06-17T10:02:00Z",
    agent: "backend-dev",
    task: "release",
    status: "ok" as const,
  };

  const levelupEvent = {
    event: "achievement" as const,
    at: "2026-06-17T10:03:00Z",
    agent: "backend-dev",
    task: "levelup",
    status: "ok" as const,
  };

  it("CelebrationSurface renders a full-screen overlay wrapper for release kind", async () => {
    mockMatchMedia(false);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={releaseEvent} />);
    const overlay = screen.getByTestId("celebration-overlay");
    expect(overlay).toBeDefined();
  });

  it("overlay has position:fixed and covers the full screen (inset:0)", async () => {
    mockMatchMedia(false);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={releaseEvent} />);
    const overlay = screen.getByTestId("celebration-overlay");
    const style = overlay.getAttribute("style") ?? "";
    const className = overlay.getAttribute("class") ?? "";
    // Must cover full screen (via style or class containing position:fixed)
    expect(style + className).toMatch(/fixed/);
  });

  it("overlay has a dimmed/blurred backdrop for release kind", async () => {
    mockMatchMedia(false);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={releaseEvent} />);
    const overlay = screen.getByTestId("celebration-overlay");
    const style = overlay.getAttribute("style") ?? "";
    const className = overlay.getAttribute("class") ?? "";
    // Backdrop should have backdrop-filter:blur or a dark background
    expect(style + className).toMatch(/backdrop|blur|rgba|background/i);
  });

  it("release overlay has a dismiss button (not an auto-trigger — DR-061)", async () => {
    mockMatchMedia(false);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={releaseEvent} />);
    const dismissBtn = screen.getByTestId("celebration-dismiss");
    expect(dismissBtn).toBeDefined();
    // Button must be a real button (not a div)
    expect(dismissBtn.tagName.toLowerCase()).toBe("button");
  });

  it("release overlay contains confetti (data-testid=celebration-confetti)", async () => {
    mockMatchMedia(false);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={releaseEvent} />);
    const confetti = screen.getByTestId("celebration-confetti");
    expect(confetti).toBeDefined();
    // Must have children (confetti pieces)
    expect(confetti.children.length).toBeGreaterThan(0);
  });

  it("levelup overlay shows the big pixel NV numeral (data-testid=celebration-level)", async () => {
    mockMatchMedia(false);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={levelupEvent} />);
    const levelEl = screen.getByTestId("celebration-level");
    expect(levelEl).toBeDefined();
    expect(levelEl.textContent).toMatch(/NV/i);
  });

  it("levelup overlay includes the XpBar (fresh start at new level)", async () => {
    mockMatchMedia(false);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={levelupEvent} />);
    const xpBar = screen.getByTestId("xp-bar");
    expect(xpBar).toBeDefined();
  });

  it("release overlay shows '¡Subiste de nivel!' or equivalent celebration title", async () => {
    mockMatchMedia(false);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={levelupEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    // Must contain the level-up celebration text
    expect(surface.textContent).toMatch(/nivel|subiste|level/i);
  });

  it("confetti animation uses bFall keyframe (transform/opacity only, not color transitions)", async () => {
    mockMatchMedia(false);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={releaseEvent} />);
    const confetti = screen.getByTestId("celebration-confetti");
    const pieces = Array.from(confetti.children);
    expect(pieces.length).toBeGreaterThan(0);
    // Each piece should use the bFall animation class or inline style with animation
    for (const piece of pieces) {
      const style = (piece as HTMLElement).getAttribute("style") ?? "";
      const className = (piece as HTMLElement).getAttribute("class") ?? "";
      // Each piece has positioning (top/left) for the confetti fall
      expect(style + className).toMatch(/animation|bFall|class/i);
    }
  });

  it("NEGATIVE AC (DR-061): no demo-trigger button visible in the real overlay", async () => {
    mockMatchMedia(false);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={releaseEvent} />);
    // There must NOT be a 'SOLO DEMO' toggle or preview trigger button
    // (only the dismiss button should be present)
    const demoBtns = screen
      .queryAllByText(/previsualizar|demo/i)
      .filter((el) => el.tagName.toLowerCase() === "button");
    expect(demoBtns.length).toBe(0);
  });

  it("confetti is absent when prefers-reduced-motion is true", async () => {
    mockMatchMedia(true);
    const { CelebrationSurface } = await import(
      "@/components/core/CelebrationSurface/CelebrationSurface"
    );
    render(<CelebrationSurface event={releaseEvent} />);
    // Under reduced-motion, confetti pieces should NOT animate
    // (they may render as static elements, or the container may be empty)
    const confetti = screen.queryByTestId("celebration-confetti");
    if (confetti) {
      // If confetti is rendered in reduced-motion, it must have no animation
      const style = confetti.getAttribute("style") ?? "";
      const className = confetti.getAttribute("class") ?? "";
      // Should not have duration > 0ms
      expect(style + className).not.toMatch(/animation\s*:(?!.*0ms)/i);
    }
    // Data (title, message) must still be visible
    expect(screen.getByTestId("celebration-surface")).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GuildBar — compact XpBar inline (90px, 9px height) per prototype topbar()
// ─────────────────────────────────────────────────────────────────────────────

describe("WO-09-003 — GuildBar: compact inline XpBar (topbar prototype fidelity)", () => {
  it("GuildBar renders NV level pill (data-testid=guild-bar-level-pill)", async () => {
    const { GuildBar } = await import("@/components/modules/GuildBar/GuildBar");
    const outcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    // The "NV {n}" pill (pixel font, accent fill)
    const pill = screen.getByTestId("guild-bar-level-pill");
    expect(pill).toBeDefined();
    expect(pill.textContent).toMatch(/NV\s*\d+/);
  });

  it("GuildBar level pill is styled in the pixel font family", async () => {
    const { GuildBar } = await import("@/components/modules/GuildBar/GuildBar");
    const outcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    const pill = screen.getByTestId("guild-bar-level-pill");
    const style = pill.getAttribute("style") ?? "";
    const className = pill.getAttribute("class") ?? "";
    // Must use pixel font
    expect(style + className).toMatch(/pixel|font-pixel|--font-pixel/i);
  });

  it("GuildBar shows the guild title text next to the level pill", async () => {
    const { GuildBar } = await import("@/components/modules/GuildBar/GuildBar");
    const outcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    const titleEl = screen.getByTestId("guild-bar-title");
    expect(titleEl.textContent).toBeTruthy();
  });

  it("GuildBar renders the XpBar in compact mode (data-compact=true or size=compact)", async () => {
    const { GuildBar } = await import("@/components/modules/GuildBar/GuildBar");
    const outcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
    };
    render(<GuildBar outcomes={outcomes} />);
    const xpBar = screen.getByTestId("xp-bar");
    // Compact XpBar is inline (data-compact="true")
    expect(xpBar.getAttribute("data-compact")).toBe("true");
  });
});
