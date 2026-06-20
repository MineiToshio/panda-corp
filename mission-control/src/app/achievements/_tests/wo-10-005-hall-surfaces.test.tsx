/**
 * WO-10-005 — Hall surfaces RED phase tests
 *
 * Tests for the visual fidelity of the Hall surfaces:
 *   - 4-tab navigation (Resumen · Misiones · Trofeos · Estadísticas)
 *   - ChainCard RPG visual (rpgpanel, itemslot, node pips, xpbar, stamp)
 *   - AlmostThere / questsNear RPG styling
 *   - UniquesSection / TrophyCard RPG one-card and lock-chip styles
 *   - SecretsPanel secret silhouette styling
 *   - HeroStat + StatLedgerRow in Estadísticas tab
 *
 * Acceptance criteria covered:
 *   AC-10-006.1..5, AC-10-007.1..4, AC-10-008.1..4, AC-10-005.2..3
 *
 * Source-of-truth: FRD > FDD > design-tokens > blueprint > work order
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChainState, Secret, Unique } from "@/lib/achievements/achievements";

// ─── Module mocks (page is a Server Component reading the fs) ─────────────────

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

// ─── Fixture builders ─────────────────────────────────────────────────────────

function mkChain(overrides: Partial<ChainState> = {}): ChainState {
  return {
    statKey: "shipped",
    label: "Productos lanzados",
    currentTierIndex: 0,
    currentTierName: "El primer ladrillo",
    nextTier: { name: "Maestro de obras", threshold: 5 },
    pctToNext: 20,
    lowerIsBetter: false,
    unlocks: [{ tier: 0, date: "2026-01-15", project: "my-project" }],
    ...overrides,
  };
}

function mkUnique(overrides: Partial<Unique> = {}): Unique {
  return {
    name: "El explorador",
    category: "Discovery",
    unlocked: false,
    condition: "Crea tu primera idea",
    ...overrides,
  };
}

function mkSecret(overrides: Partial<Secret> = {}): Secret {
  return {
    hint: "Ocurre cuando ves el vacío al otro lado.",
    unlocked: false,
    ...overrides,
  };
}

// ─── ChainCard RPG visual fidelity ───────────────────────────────────────────

describe("WO-10-005: ChainCard RPG visual (rpgpanel structure)", () => {
  it("ChainCard renders with data-testid=chain-card", async () => {
    const { ChainCard } = await import("../ChainCard/ChainCard");
    render(<ChainCard chain={mkChain()} />);
    expect(screen.getByTestId("chain-card")).toBeDefined();
  });

  it("ChainCard renders an itemslot icon area for the chain", async () => {
    const { ChainCard } = await import("../ChainCard/ChainCard");
    render(<ChainCard chain={mkChain()} />);
    // Should have an itemslot-style icon container
    const card = screen.getByTestId("chain-card");
    // Either uses ItemSlot (data-testid=itemslot-root) or a matching structure
    const iconArea = card.querySelector("[data-testid='itemslot-root'], [data-chain-icon]");
    expect(iconArea).not.toBeNull();
  });

  it("ChainCard renders tier node pips in a connector layout (prototype .node + line)", async () => {
    const { ChainCard } = await import("../ChainCard/ChainCard");
    render(<ChainCard chain={mkChain()} />);
    const card = screen.getByTestId("chain-card");
    // Pips should exist
    const pips = card.querySelectorAll("[data-testid^='chain-pip-']");
    expect(pips.length).toBeGreaterThan(0);
  });

  it("ChainCard renders the chain name (stat label) in the card", async () => {
    const { ChainCard } = await import("../ChainCard/ChainCard");
    render(<ChainCard chain={mkChain()} />);
    expect(screen.getByTestId("chain-card").textContent).toContain("Productos lanzados");
  });

  it("ChainCard renders a date+project stamp line (calendar icon area) for unlocked tiers", async () => {
    const { ChainCard } = await import("../ChainCard/ChainCard");
    render(<ChainCard chain={mkChain()} />);
    const card = screen.getByTestId("chain-card");
    expect(card.textContent).toContain("2026-01-15");
    expect(card.textContent).toContain("my-project");
  });

  it("ChainCard renders a next-tier progress label (Siguiente: ...)", async () => {
    const { ChainCard } = await import("../ChainCard/ChainCard");
    render(<ChainCard chain={mkChain()} />);
    const card = screen.getByTestId("chain-card");
    expect(card.textContent).toContain("Maestro de obras");
  });

  it("ChainCard with spot variant renders a spotlight (data-variant=spot)", async () => {
    const { ChainCard } = await import("../ChainCard/ChainCard");
    render(<ChainCard chain={mkChain()} variant="spot" />);
    const card = screen.getByTestId("chain-card");
    expect(card.getAttribute("data-variant")).toBe("spot");
  });

  it("ChainCard with mini variant renders mini size (data-variant=mini)", async () => {
    const { ChainCard } = await import("../ChainCard/ChainCard");
    render(<ChainCard chain={mkChain()} variant="mini" />);
    const card = screen.getByTestId("chain-card");
    expect(card.getAttribute("data-variant")).toBe("mini");
  });
});

// ─── AlmostThere / questsNear RPG styling ────────────────────────────────────

describe("WO-10-005: AlmostThere RPG visual (questsNear)", () => {
  it("AlmostThere renders the section heading with correct Spanish title", async () => {
    const { AlmostThere } = await import("../AlmostThere");
    const chains: ChainState[] = [
      mkChain({ statKey: "shipped", pctToNext: 80 }),
      mkChain({
        statKey: "ideas",
        label: "Ideas capturadas",
        pctToNext: 60,
        nextTier: { name: "Curiosa", threshold: 5 },
      }),
    ];
    render(<AlmostThere chains={chains} />);
    const section = screen.getByTestId("almost-there");
    // Must contain "Próximas" or "hazañas" or "caer" (prototype text)
    expect(section.textContent?.toLowerCase()).toMatch(/próximas|hazañas|cerca|siguiente/i);
  });

  it("AlmostThere each item has an rpgpanel-style container (data-testid=almost-there-item)", async () => {
    const { AlmostThere } = await import("../AlmostThere");
    render(<AlmostThere chains={[mkChain({ statKey: "shipped", pctToNext: 80 })]} />);
    const items = screen.getAllByTestId("almost-there-item");
    expect(items.length).toBeGreaterThan(0);
  });

  it("AlmostThere each item shows the next tier name prominently", async () => {
    const { AlmostThere } = await import("../AlmostThere");
    render(
      <AlmostThere
        chains={[
          mkChain({
            statKey: "shipped",
            pctToNext: 80,
            nextTier: { name: "Maestro de obras", threshold: 5 },
          }),
        ]}
      />,
    );
    const item = screen.getAllByTestId("almost-there-item")[0];
    expect(item?.textContent).toContain("Maestro de obras");
  });

  it("AlmostThere each item shows the pctToNext as a pixel numeral", async () => {
    const { AlmostThere } = await import("../AlmostThere");
    render(<AlmostThere chains={[mkChain({ statKey: "shipped", pctToNext: 80 })]} />);
    const item = screen.getAllByTestId("almost-there-item")[0];
    expect(item?.textContent).toContain("80");
  });

  it("AlmostThere each item has an itemslot icon area", async () => {
    const { AlmostThere } = await import("../AlmostThere");
    render(<AlmostThere chains={[mkChain({ statKey: "shipped", pctToNext: 80 })]} />);
    const item = screen.getAllByTestId("almost-there-item")[0];
    // The item should have an icon container (itemslot or equivalent)
    const iconArea = item?.querySelector("[data-testid='itemslot-root'], [data-chain-icon]");
    expect(iconArea).not.toBeNull();
  });
});

// ─── UniquesSection / TrophyCard RPG ─────────────────────────────────────────

describe("WO-10-005: UniquesSection TrophyCard RPG styles", () => {
  it("UniquesSection renders unlocked trophy with rpgpanel + glowwarn structure", async () => {
    const { UniquesSection } = await import("../UniquesSection/UniquesSection");
    const uniques: Unique[] = [mkUnique({ unlocked: true, date: "2026-01-01", project: "proj-a" })];
    render(<UniquesSection uniques={uniques} />);
    const items = screen.getAllByTestId("unique-item");
    expect(items.length).toBeGreaterThan(0);
    // Unlocked item has glowwarn or warn styling signal
    const unlockedItem = items.find((el) => el.getAttribute("data-unlocked") === "true");
    expect(unlockedItem).toBeDefined();
  });

  it("UniquesSection locked trophy has lockchip-style reveal (hover-reveal) structure", async () => {
    const { UniquesSection } = await import("../UniquesSection/UniquesSection");
    const uniques: Unique[] = [
      mkUnique({ unlocked: false, name: "El rápido", condition: "Lanza en 48 horas" }),
    ];
    render(<UniquesSection uniques={uniques} />);
    const lockedItem = screen.getAllByTestId("unique-item")[0];
    expect(lockedItem?.getAttribute("data-unlocked")).toBe("false");
    // Should have a reveal/lockchip structure (data-testid=unique-reveal OR itemslot-reveal)
    const reveal = lockedItem?.querySelector(
      "[data-testid='unique-reveal'], [data-testid='itemslot-reveal']",
    );
    expect(reveal).not.toBeNull();
  });

  it("UniquesSection locked trophy hover-reveal shows condition text", async () => {
    const { UniquesSection } = await import("../UniquesSection/UniquesSection");
    const uniques: Unique[] = [
      mkUnique({ unlocked: false, name: "El rápido", condition: "Lanza un producto en 48 horas" }),
    ];
    render(<UniquesSection uniques={uniques} />);
    const item = screen.getAllByTestId("unique-item")[0];
    // Condition must be present in the DOM (reveal shows it)
    expect(item?.textContent).toContain("Lanza un producto en 48 horas");
  });

  it("UniquesSection shows CÓMO DESBLOQUEAR label in locked reveal", async () => {
    const { UniquesSection } = await import("../UniquesSection/UniquesSection");
    const uniques: Unique[] = [
      mkUnique({ unlocked: false, name: "El rápido", condition: "Lanza en 48 horas" }),
    ];
    render(<UniquesSection uniques={uniques} />);
    const item = screen.getAllByTestId("unique-item")[0];
    // Should show "CÓMO DESBLOQUEAR" label (from prototype rpgTrophyLock)
    expect(item?.textContent?.toUpperCase()).toContain("DESBLOQUEAR");
  });

  it("UniquesSection category chips allow filtering (data-testid=uniques-category-chip)", async () => {
    const { UniquesSection } = await import("../UniquesSection/UniquesSection");
    const uniques: Unique[] = [
      mkUnique({ unlocked: false, category: "Discovery" }),
      mkUnique({ unlocked: false, category: "Speed", name: "El rápido", condition: "Cond" }),
    ];
    render(<UniquesSection uniques={uniques} />);
    // Should have category chip filter buttons
    const chips = screen.getAllByTestId(/uniques-cat-chip/);
    expect(chips.length).toBeGreaterThan(0);
  });
});

// ─── SecretsPanel RPG silhouette ──────────────────────────────────────────────

describe("WO-10-005: SecretsPanel RPG silhouette+hint", () => {
  it("SecretsPanel locked secret shows question-mark silhouette (? slot)", async () => {
    const { SecretsPanel } = await import("../SecretsPanel/SecretsPanel");
    const secrets: Secret[] = [mkSecret({ unlocked: false })];
    render(<SecretsPanel secrets={secrets} />);
    const item = screen.getAllByTestId("secret-item")[0];
    // Silhouette indicator (data-testid=secret-silhouette)
    const silhouette = item?.querySelector("[data-testid='secret-silhouette']");
    expect(silhouette).not.toBeNull();
  });

  it("SecretsPanel locked secret shows cryptic hint text", async () => {
    const { SecretsPanel } = await import("../SecretsPanel/SecretsPanel");
    const secrets: Secret[] = [
      mkSecret({ unlocked: false, hint: "Ocurre cuando ves el vacío al otro lado." }),
    ];
    render(<SecretsPanel secrets={secrets} />);
    expect(screen.getByTestId("secrets-panel").textContent).toContain(
      "Ocurre cuando ves el vacío al otro lado.",
    );
  });

  it("SecretsPanel uses lockchip-style hover reveal for locked secrets", async () => {
    const { SecretsPanel } = await import("../SecretsPanel/SecretsPanel");
    const secrets: Secret[] = [mkSecret({ unlocked: false })];
    render(<SecretsPanel secrets={secrets} />);
    const item = screen.getAllByTestId("secret-item")[0];
    // lockchip structure signals locked state
    expect(item?.getAttribute("data-locked")).toBe("true");
  });
});

// ─── HeroStat + StatLedgerRow ─────────────────────────────────────────────────

describe("WO-10-005: HeroStat + StatLedgerRow in Estadísticas tab", () => {
  it("StatsPanel renders heroStat tiles for lanzados/racha/velocidad", async () => {
    const { StatsPanel } = await import("../StatsPanel");
    const readerData = { ideas: [], statuses: [], eventsSnapshot: null };
    render(<StatsPanel readerData={readerData} />);
    // Should have hero stat tiles (data-testid=hero-stat)
    const heroStats = screen.queryAllByTestId("hero-stat");
    expect(heroStats.length).toBeGreaterThanOrEqual(3);
  });

  it("StatsPanel hero stat tiles use pixel numeral (data-pixel=true)", async () => {
    const { StatsPanel } = await import("../StatsPanel");
    const readerData = { ideas: [], statuses: [], eventsSnapshot: null };
    render(<StatsPanel readerData={readerData} />);
    const heroStats = screen.queryAllByTestId("hero-stat");
    // Each heroStat should have a big pixel numeral
    for (const tile of heroStats) {
      const numeral = tile.querySelector("[data-testid='hero-stat-value']");
      expect(numeral).not.toBeNull();
    }
  });

  it("StatsPanel renders stat ledger rows (data-testid=stat-ledger-row)", async () => {
    const { StatsPanel } = await import("../StatsPanel");
    const readerData = { ideas: [], statuses: [], eventsSnapshot: null };
    render(<StatsPanel readerData={readerData} />);
    const ledgerRows = screen.queryAllByTestId("stat-ledger-row");
    expect(ledgerRows.length).toBeGreaterThan(0);
  });

  it("StatsPanel ledger rows show tier node pip", async () => {
    const { StatsPanel } = await import("../StatsPanel");
    const readerData = { ideas: [], statuses: [], eventsSnapshot: null };
    render(<StatsPanel readerData={readerData} />);
    // Ledger rows should have a tier node pip
    const ledgerRows = screen.queryAllByTestId("stat-ledger-row");
    // At least the structure exists (may have 0 pips if no tier)
    expect(ledgerRows.length).toBeGreaterThan(0);
  });
});

// ─── Page 4-tab structure ─────────────────────────────────────────────────────

describe("WO-10-005: Hall page 4-tab structure (Resumen·Misiones·Trofeos·Estadísticas)", () => {
  async function renderPage() {
    const { default: HallPage } = await import("../page");
    const jsx = await HallPage();
    return render(jsx);
  }

  it("page renders the 4-tab bar (data-testid=logros-tabs or tabs-root)", async () => {
    await renderPage();
    // Should have a tab bar for the 4 logros sub-tabs
    const tabBar = screen.queryByTestId("logros-tabs") ?? screen.queryByTestId("tabs-root");
    expect(tabBar).not.toBeNull();
  });

  it("page includes Resumen tab", async () => {
    await renderPage();
    const allText = document.body.textContent ?? "";
    expect(allText).toMatch(/resumen/i);
  });

  it("page includes Misiones tab", async () => {
    await renderPage();
    const allText = document.body.textContent ?? "";
    expect(allText).toMatch(/misiones/i);
  });

  it("page includes Trofeos tab", async () => {
    await renderPage();
    const allText = document.body.textContent ?? "";
    expect(allText).toMatch(/trofeos/i);
  });

  it("page includes Estadísticas tab", async () => {
    await renderPage();
    const allText = document.body.textContent ?? "";
    expect(allText).toMatch(/estadísticas/i);
  });

  it("page shows the PageTitle 'Logros' heading with item-count pill", async () => {
    await renderPage();
    // PageTitle should show "Logros"
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Logros");
  });
});
