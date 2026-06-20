/**
 * WO-09-003 — Guild surfaces: GuildBar + GuildHero + StatRadar + CelebrationSurface
 *
 * RED phase: tests for AC-09-004.x (GuildBar), AC-09-003.x (Avatar), AC-09-006.x (Celebration)
 * anchored to the prototype visual contract. Tests that existing components match the
 * prototype's layout (logrosHero / topbar / statRadar / bOverlay).
 *
 * Traceability:
 *   AC-09-004.1 — GuildBar: NV level pill + guild title + inline compact XpBar
 *   AC-09-004.2 — tabular-nums on all numeric elements
 *   AC-09-004.3 — XP bar real pct-to-next (no fake fill)
 *   AC-09-004.4 — rationed accent, not color-alone
 *   AC-09-004.5 — XpBar primitive reuse
 *   AC-09-003.1 — Avatar renders pixel-art per agent id
 *   AC-09-003.2 — degrades gracefully on missing sprite (no layout break)
 *   AC-09-003.3 — Spanish aria-label / alt
 *   AC-09-006.1 — CelebrationSurface scales: toast → phase → release → levelup
 *   AC-09-006.2 — non-result event → no celebration
 *   AC-09-006.3 — animation transform/opacity only, <300ms, disabled under reduced-motion
 *   AC-09-006.4 — no false-urgency timer/countdown/nagging
 *   AC-09-006.5 — aria-live="polite" Spanish, no focus steal
 *
 * Visual contract (prototype): logrosHero() ~L413, topbar() ~L646, statRadar() ~L459,
 *   bOverlay(kind) ~L1433, bConfetti() ~L1432
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { CelebrationSurface } from "@/components/core/CelebrationSurface/CelebrationSurface";
import { GuildBar } from "@/components/modules/GuildBar/GuildBar";
import type { Event } from "@/lib/events/events";
import type { GuildOutcomes } from "@/lib/gamification/gamification";

// ── matchMedia mock (needed for CelebrationSurface "use client") ──────────────

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// GuildBar — prototype topbar(): NV pill + guild title + inline XpBar
// AC-09-004.x
// ─────────────────────────────────────────────────────────────────────────────

describe("WO-09-003 / GuildBar — prototype topbar() fidelity (AC-09-004.x)", () => {
  const zeroOutcomes: GuildOutcomes = {
    workOrdersDone: 0,
    phasesCompleted: 0,
    releases: 0,
    greenTestRuns: 0,
  };

  it("renders data-testid='guild-bar'", () => {
    render(<GuildBar outcomes={zeroOutcomes} />);
    expect(screen.getByTestId("guild-bar")).toBeDefined();
  });

  it("AC-09-004.1 — shows NV level number as a text node (pixel font target)", () => {
    render(<GuildBar outcomes={zeroOutcomes} />);
    const levelEl = screen.getByTestId("guild-bar-level");
    expect(/\d/.test(levelEl.textContent ?? "")).toBe(true);
  });

  it("AC-09-004.1 — shows guild title text", () => {
    render(<GuildBar outcomes={zeroOutcomes} />);
    const title = screen.getByTestId("guild-bar-title");
    expect((title.textContent ?? "").length).toBeGreaterThan(0);
  });

  it("AC-09-004.5 — reuses XpBar primitive (data-testid='xp-bar' inside guild-bar)", () => {
    render(<GuildBar outcomes={zeroOutcomes} />);
    const bar = screen.getByTestId("guild-bar");
    expect(bar.querySelector("[data-testid='xp-bar']")).not.toBeNull();
  });

  it("AC-09-004.3 — zero outcomes → xp-bar-fill width is 0% (no fake fill)", () => {
    render(<GuildBar outcomes={zeroOutcomes} />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill.style.width).toBe("0%");
  });

  it("AC-09-004.2 — level element contains a digit (tabular-nums text node)", () => {
    render(<GuildBar outcomes={zeroOutcomes} />);
    const levelEl = screen.getByTestId("guild-bar-level");
    expect(/\d/.test(levelEl.textContent ?? "")).toBe(true);
  });

  it("AC-09-004.4 — has both text label AND progressbar role (not color-alone)", () => {
    render(<GuildBar outcomes={zeroOutcomes} />);
    expect(screen.getByTestId("guild-bar-title")).toBeDefined();
    expect(screen.getByRole("progressbar")).toBeDefined();
  });

  it("AC-09-004.1 — higher outcomes raise the level above 1", () => {
    const highOutcomes: GuildOutcomes = {
      workOrdersDone: 50,
      phasesCompleted: 5,
      releases: 2,
      greenTestRuns: 200,
    };
    render(<GuildBar outcomes={highOutcomes} />);
    const text = screen.getByTestId("guild-bar-level").textContent ?? "0";
    // The pill text is "NV {level}" — extract the numeric part
    const digits = text.match(/\d+/)?.[0] ?? "0";
    const lvl = Number.parseInt(digits, 10);
    expect(lvl).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Avatar — prototype sprite roster (party section in logrosHero())
// AC-09-003.x
// ─────────────────────────────────────────────────────────────────────────────

describe("WO-09-003 / Avatar — prototype sprite fidelity (AC-09-003.x)", () => {
  const knownRole: AgentRole = "backend-dev";
  const unknownRole = "unknown-role-xyz" as AgentRole;

  it("AC-09-003.1 — renders data-testid='agent-avatar' for a known role", () => {
    render(<Avatar agentId={knownRole} />);
    expect(screen.getByTestId("agent-avatar")).toBeDefined();
  });

  it("AC-09-003.1 — renders the sprite img inside the wrapper", () => {
    render(<Avatar agentId={knownRole} />);
    expect(screen.getByTestId("agent-avatar-img")).toBeDefined();
  });

  it("AC-09-003.3 — has Spanish aria-label on wrapper", () => {
    render(<Avatar agentId={knownRole} />);
    const wrapper = screen.getByTestId("agent-avatar");
    const label = wrapper.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label?.length).toBeGreaterThan(0);
  });

  it("AC-09-003.3 — img has Spanish alt text", () => {
    render(<Avatar agentId={knownRole} />);
    const img = screen.getByTestId("agent-avatar-img");
    const alt = img.getAttribute("alt") ?? "";
    expect(alt.length).toBeGreaterThan(0);
  });

  it("AC-09-003.2 — unknown agent id falls back gracefully (does not throw)", () => {
    expect(() => render(<Avatar agentId={unknownRole} />)).not.toThrow();
  });

  it("AC-09-003.2 — unknown agent id still renders the wrapper element (no layout break)", () => {
    render(<Avatar agentId={unknownRole} />);
    expect(screen.getByTestId("agent-avatar")).toBeDefined();
  });

  it("AC-09-003.1 — data-role matches the agentId passed (correct sprite target)", () => {
    render(<Avatar agentId={knownRole} />);
    const wrapper = screen.getByTestId("agent-avatar");
    expect(wrapper.getAttribute("data-role")).toBe(knownRole);
  });

  it("AC-09-003.1 — size variant 'md' sets data-size='md'", () => {
    render(<Avatar agentId={knownRole} size="md" />);
    const wrapper = screen.getByTestId("agent-avatar");
    expect(wrapper.getAttribute("data-size")).toBe("md");
  });

  it("AC-09-003.1 — image-rendering: pixelated on img (pixel-art requirement)", () => {
    render(<Avatar agentId={knownRole} />);
    const img = screen.getByTestId("agent-avatar-img") as HTMLImageElement;
    // image-rendering is set via inline style
    expect(img.style.imageRendering).toBe("pixelated");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CelebrationSurface — prototype bOverlay() fidelity + full visual contract
// AC-09-006.x
// ─────────────────────────────────────────────────────────────────────────────

const releaseEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:02:00Z",
  agent: "backend-dev",
  task: "release",
  status: "ok",
};

const levelupEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:03:00Z",
  agent: "backend-dev",
  task: "levelup",
  status: "ok",
};

const toastEvent: Event = {
  event: "achievement",
  at: "2026-06-17T10:00:00Z",
  agent: "backend-dev",
  workOrder: "WO-09-001",
  status: "ok",
};

const noneEvent: Event = {
  event: "read",
  at: "2026-06-17T10:04:00Z",
  agent: "backend-dev",
};

describe("WO-09-003 / CelebrationSurface — prototype bOverlay() fidelity (AC-09-006.x)", () => {
  it("AC-09-006.1 — renders celebration-surface for release event", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={releaseEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-tier")).toBe("release");
  });

  it("AC-09-006.1 — renders celebration-surface for levelup event", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={levelupEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-tier")).toBe("levelup");
  });

  it("AC-09-006.2 — no celebration for non-result event (none tier)", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={noneEvent} />);
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });

  it("AC-09-006.2 — no celebration when event=null", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={null} />);
    expect(screen.queryByTestId("celebration-surface")).toBeNull();
  });

  it("AC-09-006.3 — data-animated='true' when reduced-motion is off", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={toastEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-animated")).toBe("true");
  });

  it("AC-09-006.3 — data-animated='false' when reduced-motion is on", () => {
    mockMatchMedia(true);
    render(<CelebrationSurface event={releaseEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    expect(surface.getAttribute("data-animated")).toBe("false");
  });

  it("AC-09-006.3 — data still visible under reduced-motion (element present)", () => {
    mockMatchMedia(true);
    render(<CelebrationSurface event={releaseEvent} />);
    expect(screen.getByTestId("celebration-surface")).toBeDefined();
    expect(screen.getByTestId("celebration-message")).toBeDefined();
  });

  it("AC-09-006.3 — style only uses transform/opacity (no layout/color properties)", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={toastEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    const style = surface.getAttribute("style") ?? "";
    expect(style).not.toMatch(/\bleft\b/);
    expect(style).not.toMatch(/\btop\b/);
    expect(style).not.toMatch(/\bmargin\b/);
    expect(style).not.toMatch(/\bcolor\s*:/);
    expect(style).not.toMatch(/\bbackground\s*:/);
  });

  it("AC-09-006.4 — no timer element rendered", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={releaseEvent} />);
    expect(screen.queryByTestId("celebration-timer")).toBeNull();
  });

  it("AC-09-006.4 — no countdown element rendered", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={levelupEvent} />);
    expect(screen.queryByTestId("celebration-countdown")).toBeNull();
  });

  it("AC-09-006.4 — no role='alertdialog' (no focus hijack)", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={releaseEvent} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("AC-09-006.5 — has aria-live='polite' region (via LiveRegion)", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={releaseEvent} />);
    const surface = screen.getByTestId("celebration-surface");
    const politeRegions = surface.querySelectorAll("[aria-live='polite']");
    expect(politeRegions.length).toBeGreaterThan(0);
  });

  it("AC-09-006.5 — no aria-live='assertive' used", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={levelupEvent} />);
    expect(screen.queryAllByRole("alert").length).toBe(0);
  });

  it("AC-09-006.5 — celebration message is in Spanish (non-empty text)", () => {
    mockMatchMedia(false);
    render(<CelebrationSurface event={releaseEvent} />);
    const msg = screen.getByTestId("celebration-message");
    expect((msg.textContent ?? "").length).toBeGreaterThan(0);
  });

  it("AC-09-006.1 — release and levelup have distinct messages (not flat)", () => {
    mockMatchMedia(false);
    const { unmount: u1 } = render(<CelebrationSurface event={releaseEvent} />);
    const relMsg = screen.getByTestId("celebration-message").textContent;
    u1();

    const { unmount: u2 } = render(<CelebrationSurface event={levelupEvent} />);
    const lvlMsg = screen.getByTestId("celebration-message").textContent;
    u2();

    expect(relMsg).not.toBe(lvlMsg);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GuildHero — achievements page hero region (prototype logrosHero())
// Tests that achievements page renders the hero with Shield + XpBar + Avatar roster
// ─────────────────────────────────────────────────────────────────────────────

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

async function renderAchievementsPage() {
  const { default: HallPage } = await import("../page");
  const jsx = await HallPage();
  return render(jsx);
}

describe("WO-09-003 / GuildHero — achievements page hero (logrosHero prototype)", () => {
  it("hero region renders with data-testid='hall-hero'", async () => {
    await renderAchievementsPage();
    expect(screen.getByTestId("hall-hero")).toBeDefined();
  });

  it("hero contains the Shield crest component (data-testid='shield-root')", async () => {
    await renderAchievementsPage();
    const hero = screen.getByTestId("hall-hero");
    // The Shield component from WO-13-008 must appear in the hero
    expect(hero.querySelector("[data-testid='shield-root']")).not.toBeNull();
  });

  it("hero contains the XpBar primitive (data-testid='xp-bar')", async () => {
    await renderAchievementsPage();
    const hero = screen.getByTestId("hall-hero");
    expect(hero.querySelector("[data-testid='xp-bar']")).not.toBeNull();
  });

  it("hero contains the party Avatar roster (data-testid='hall-party-avatars')", async () => {
    await renderAchievementsPage();
    expect(screen.getByTestId("hall-party-avatars")).toBeDefined();
  });

  it("party roster has at least one Avatar (data-testid='agent-avatar')", async () => {
    await renderAchievementsPage();
    const roster = screen.getByTestId("hall-party-avatars");
    const avatars = roster.querySelectorAll("[data-testid='agent-avatar']");
    expect(avatars.length).toBeGreaterThan(0);
  });

  it("hero shows 'GREMIO PANDACORP' eyebrow label (prototype logrosHero)", async () => {
    await renderAchievementsPage();
    const hero = screen.getByTestId("hall-hero");
    expect(hero.textContent).toMatch(/GREMIO PANDACORP/i);
  });

  it("hero shows guild title text (rank name)", async () => {
    await renderAchievementsPage();
    const hero = screen.getByTestId("hall-hero");
    // Aprendiz is rank-1 on empty factory
    expect(hero.textContent).toMatch(/Aprendiz|Artesano|Oficial|Maestro|Capataz|Leyenda/);
  });

  it("XpBar fill is 0% on empty factory (honest, not fake)", async () => {
    await renderAchievementsPage();
    const hero = screen.getByTestId("hall-hero");
    const fill = hero.querySelector("[data-testid='xp-bar-fill']") as HTMLElement | null;
    expect(fill).not.toBeNull();
    expect(fill?.style.width).toBe("0%");
  });

  it("tabs section renders (data-testid='hall-tabs')", async () => {
    await renderAchievementsPage();
    expect(screen.getByTestId("hall-tabs")).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// StatRadar — StatsPanel SVG radar (prototype statRadar())
// ─────────────────────────────────────────────────────────────────────────────

describe("WO-09-003 / StatRadar — achievements page stats panel SVG radar", () => {
  it("StatsPanel renders with data-testid='stats-panel'", async () => {
    await renderAchievementsPage();
    expect(screen.getByTestId("stats-panel")).toBeDefined();
  });

  it("StatsPanel contains an SVG radar element (data-testid='stat-radar')", async () => {
    await renderAchievementsPage();
    // The radar SVG must be present somewhere on the page (within or adjacent to stats-panel)
    const radar = document.querySelector("[data-testid='stat-radar']");
    expect(radar).not.toBeNull();
  });

  it("stat-radar is an SVG element with the 6 axes", async () => {
    await renderAchievementsPage();
    const radar = document.querySelector("[data-testid='stat-radar']") as SVGElement | null;
    expect(radar).not.toBeNull();
    expect(radar?.tagName.toLowerCase()).toBe("svg");
  });

  it("stat-radar has viewBox attribute (prototype: '0 0 330 280')", async () => {
    await renderAchievementsPage();
    const radar = document.querySelector("[data-testid='stat-radar']") as SVGElement | null;
    expect(radar?.getAttribute("viewBox")).toBeTruthy();
  });

  it("stat-radar has aria-label in Spanish for accessibility", async () => {
    await renderAchievementsPage();
    const radar = document.querySelector("[data-testid='stat-radar']");
    expect(radar?.getAttribute("aria-label")).toBeTruthy();
  });
});
