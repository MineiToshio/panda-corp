/**
 * WO-18-004 — Cartera component tests (RED phase)
 *
 * Tests are written BEFORE the implementation. `Cartera` does not exist yet —
 * all tests will fail (RED) until the GREEN phase. That is the intent.
 *
 * Traceability (FRD-18 EARS → AC → test):
 *   AC-18-004.1 (REQ-18-015)  each card shows phase+version, WO progress, age-in-stage, next command
 *   AC-18-004.2 (REQ-18-016)  "sin señal" flag displayed with last-event info; "en vivo" when fresh
 *   AC-18-004.3 (REQ-18-017)  "estancado" flag with age when phase is stale
 *   AC-18-004.4 (REQ-18-018)  blocker reason surfaces inline (no log dive)
 *   AC-18-004.5 (REQ-18-019)  shipped → "estable · en operación" label + review-launch command
 *   AC-18-004.6 (REQ-18-020)  no active projects → first-action card (never blank)
 *   AC-18-004.7               Spanish copy; flags not by color alone (text + role); data-testid
 *
 * Stack: Vitest + @testing-library/react (jsdom). No fs — all inputs are fixture props.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CardData } from "../Cartera";
import { Cartera } from "../Cartera";

// ---------------------------------------------------------------------------
// Fixture helpers (sensible defaults, override only what the test cares about)
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    name: "Test Project",
    phase: "implementation",
    phaseLabel: "Implementación",
    version: "v1",
    woProgress: { done: 5, total: 10, pct: 50 },
    ageInStageDays: 3,
    nextCommand: "/pandacorp:release",
    isLive: true,
    isNoSignal: false,
    isStalled: false,
    isShipped: false,
    isYoungInPhase: true,
    blockerReason: undefined,
    lastEventAt: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-18-004.1 — each card shows phase+version, WO progress, age, next command
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.1 — card shows core info", () => {
  it("wo-18-004: GIVEN one active card WHEN rendered THEN the project name is visible", () => {
    render(<Cartera cards={[makeCard({ name: "Mission Control" })]} />);
    expect(screen.getByText("Mission Control")).toBeDefined();
  });

  it("wo-18-004: GIVEN a card with phase=implementation WHEN rendered THEN phase label is shown (Spanish)", () => {
    render(<Cartera cards={[makeCard({ phase: "implementation" })]} />);
    const card = screen.getByTestId("cartera-card-test-project");
    // Component displays Spanish label "Implementación", not the raw enum value
    expect(card.textContent).toMatch(/implementaci[oó]n/i);
  });

  it("wo-18-004: GIVEN a card with version=v2 WHEN rendered THEN version is visible", () => {
    render(<Cartera cards={[makeCard({ version: "v2" })]} />);
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toContain("v2");
  });

  it("wo-18-004: GIVEN woProgress 5/10 WHEN rendered THEN the WO fraction is visible and a progress bar reflects the percentage", () => {
    render(<Cartera cards={[makeCard({ woProgress: { done: 5, total: 10, pct: 50 } })]} />);
    const card = screen.getByTestId("cartera-card-test-project");
    // Prototype meta line shows the "done/total work orders" fraction (not a "50%" literal);
    // the percentage is conveyed by the accent progress bar's width.
    expect(card.textContent).toContain("5");
    expect(card.textContent).toContain("10");
    expect(card.textContent).toMatch(/work orders/i);
    const bar = within(card).getByTestId("cartera-progress").firstChild as HTMLElement;
    expect(bar.style.width).toBe("50%");
  });

  it("wo-18-004: GIVEN ageInStageDays=7 WHEN rendered THEN age is displayed", () => {
    render(<Cartera cards={[makeCard({ ageInStageDays: 7 })]} />);
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toContain("7");
  });

  it("wo-18-004: GIVEN nextCommand=/pandacorp:release WHEN rendered THEN command is visible and copyable", () => {
    render(<Cartera cards={[makeCard({ nextCommand: "/pandacorp:release" })]} />);
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toContain("/pandacorp:release");
    // Copy button must be present (data-testid from CopyButton component)
    const copyBtn = within(card).getByTestId("copy-button");
    expect(copyBtn).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.2 — freshness: "en vivo" vs "sin señal"
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.2 — freshness flag display", () => {
  it("wo-18-004: GIVEN isLive=true WHEN rendered THEN 'en vivo' indicator is shown", () => {
    render(<Cartera cards={[makeCard({ isLive: true, isNoSignal: false })]} />);
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toMatch(/en vivo/i);
  });

  it("wo-18-004: GIVEN isNoSignal=true WHEN rendered THEN 'sin señal' indicator is shown", () => {
    const lastEvent = "2026-06-18T10:00:00.000Z";
    render(
      <Cartera cards={[makeCard({ isLive: false, isNoSignal: true, lastEventAt: lastEvent })]} />,
    );
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toMatch(/sin señal/i);
  });

  it("wo-18-004: GIVEN isNoSignal=true WHEN rendered THEN 'sin señal' flag is not conveyed by color alone (has text)", () => {
    render(
      <Cartera
        cards={[
          makeCard({ isLive: false, isNoSignal: true, lastEventAt: "2026-06-18T10:00:00.000Z" }),
        ]}
      />,
    );
    const flag = screen.getByTestId("cartera-flag-nosignal");
    // Text must be present (a11y: not color-only)
    expect(flag.textContent?.trim()).not.toBe("");
  });

  it("wo-18-004: GIVEN isLive=false and isNoSignal=false WHEN rendered THEN neither freshness label appears", () => {
    render(
      <Cartera cards={[makeCard({ isLive: false, isNoSignal: false, phase: "architecture" })]} />,
    );
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).not.toMatch(/en vivo/i);
    expect(card.textContent).not.toMatch(/sin señal/i);
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.3 — staleness: "estancado" flag
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.3 — staleness flag display", () => {
  it("wo-18-004: GIVEN isStalled=true WHEN rendered THEN 'estancado' indicator is visible", () => {
    render(<Cartera cards={[makeCard({ isStalled: true, ageInStageDays: 20 })]} />);
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toMatch(/estancado/i);
  });

  it("wo-18-004: GIVEN isStalled=true WHEN rendered THEN the stall flag is not by color alone (has text)", () => {
    render(<Cartera cards={[makeCard({ isStalled: true, ageInStageDays: 20 })]} />);
    const flag = screen.getByTestId("cartera-flag-stalled");
    expect(flag.textContent?.trim()).not.toBe("");
  });

  it("wo-18-004: GIVEN isStalled=false WHEN rendered THEN 'estancado' does not appear", () => {
    render(<Cartera cards={[makeCard({ isStalled: false })]} />);
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).not.toMatch(/estancado/i);
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.4 — blocker reason inline
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.4 — blocker reason inline", () => {
  it("wo-18-004: GIVEN blockerReason WHEN rendered THEN the reason is shown inline (no log dive needed)", () => {
    const reason = "WO-05-002: type error in lib/portfolio.ts";
    render(<Cartera cards={[makeCard({ blockerReason: reason })]} />);
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toContain(reason);
  });

  it("wo-18-004: GIVEN no blockerReason WHEN rendered THEN blocker section is absent", () => {
    render(<Cartera cards={[makeCard({ blockerReason: undefined })]} />);
    expect(screen.queryByTestId("cartera-blocker-reason")).toBeNull();
  });

  it("wo-18-004: GIVEN blockerReason WHEN rendered THEN blocker section has data-testid", () => {
    render(<Cartera cards={[makeCard({ blockerReason: "auth error" })]} />);
    expect(screen.getByTestId("cartera-blocker-reason")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.5 — shipped project: "estable · en operación"
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.5 — shipped project display", () => {
  it("wo-18-004: GIVEN isShipped=true WHEN rendered THEN 'estable' label is present", () => {
    render(
      <Cartera
        cards={[
          makeCard({
            phase: "operation",
            isShipped: true,
            isLive: false,
            isNoSignal: false,
            nextCommand: "/pandacorp:review-launch",
          }),
        ]}
      />,
    );
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toMatch(/estable/i);
  });

  it("wo-18-004: GIVEN isShipped=true WHEN rendered THEN 'en operación' label is present", () => {
    render(
      <Cartera
        cards={[
          makeCard({
            phase: "operation",
            isShipped: true,
            isLive: false,
            isNoSignal: false,
            nextCommand: "/pandacorp:review-launch",
          }),
        ]}
      />,
    );
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toMatch(/en operación/i);
  });

  it("wo-18-004: GIVEN isShipped=true WHEN rendered THEN nextCommand is /pandacorp:review-launch", () => {
    render(
      <Cartera
        cards={[
          makeCard({
            isShipped: true,
            nextCommand: "/pandacorp:review-launch",
          }),
        ]}
      />,
    );
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toContain("/pandacorp:review-launch");
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.6 — no active projects → first-action card (never blank)
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.6 — first-action card when portfolio is empty", () => {
  it("wo-18-004: GIVEN no cards WHEN rendered THEN a first-action card is shown (never blank)", () => {
    render(<Cartera cards={[]} />);
    expect(screen.getByTestId("cartera-first-action")).toBeDefined();
  });

  it("wo-18-004: GIVEN no cards WHEN rendered THEN the start command is shown", () => {
    render(<Cartera cards={[]} />);
    const firstAction = screen.getByTestId("cartera-first-action");
    expect(firstAction.textContent).toContain("/pandacorp:spec");
  });

  it("wo-18-004: GIVEN no cards WHEN rendered THEN the start command is copyable", () => {
    render(<Cartera cards={[]} />);
    const firstAction = screen.getByTestId("cartera-first-action");
    expect(within(firstAction).getByTestId("copy-button")).toBeDefined();
  });

  it("wo-18-004: GIVEN active cards WHEN rendered THEN no first-action card is shown", () => {
    render(<Cartera cards={[makeCard()]} />);
    expect(screen.queryByTestId("cartera-first-action")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.7 — Spanish copy + a11y + data-testid surface
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.7 — a11y and Spanish copy", () => {
  it("wo-18-004: GIVEN multiple cards WHEN rendered THEN each has its own data-testid", () => {
    render(
      <Cartera cards={[makeCard({ name: "Alpha Project" }), makeCard({ name: "Beta Project" })]} />,
    );
    expect(screen.getByTestId("cartera-card-alpha-project")).toBeDefined();
    expect(screen.getByTestId("cartera-card-beta-project")).toBeDefined();
  });

  it("wo-18-004: GIVEN a card WHEN rendered THEN the container has role=article or region (a11y landmark)", () => {
    render(<Cartera cards={[makeCard()]} />);
    // Cards should be articles for a11y
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.tagName.toLowerCase()).toBe("article");
  });

  it("wo-18-004: GIVEN a section WHEN rendered THEN the section has a Spanish heading", () => {
    render(<Cartera cards={[makeCard()]} />);
    // Section heading for the build & portfolio section
    const heading = screen.getByTestId("cartera-heading");
    expect(heading.textContent).toMatch(/cartera|construcción|proyecto/i);
  });

  it("wo-18-004: GIVEN a card grid WHEN rendered THEN the grid has a data-testid", () => {
    render(<Cartera cards={[makeCard()]} />);
    expect(screen.getByTestId("cartera-grid")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("wo-18-004: edge cases", () => {
  it("wo-18-004: GIVEN multiple cards WHEN rendered THEN each card is rendered", () => {
    render(
      <Cartera
        cards={[
          makeCard({ name: "Project One" }),
          makeCard({ name: "Project Two" }),
          makeCard({ name: "Project Three" }),
        ]}
      />,
    );
    expect(screen.getByTestId("cartera-card-project-one")).toBeDefined();
    expect(screen.getByTestId("cartera-card-project-two")).toBeDefined();
    expect(screen.getByTestId("cartera-card-project-three")).toBeDefined();
  });

  it("wo-18-004: GIVEN a card with no ageInStageDays WHEN rendered THEN renders without crashing", () => {
    expect(() =>
      render(<Cartera cards={[makeCard({ ageInStageDays: undefined })]} />),
    ).not.toThrow();
  });

  it("wo-18-004: GIVEN isStalled=true AND isNoSignal=true WHEN rendered THEN both flags are visible simultaneously", () => {
    render(
      <Cartera
        cards={[
          makeCard({
            isStalled: true,
            isNoSignal: true,
            isLive: false,
            ageInStageDays: 30,
            lastEventAt: "2026-06-01T00:00:00.000Z",
          }),
        ]}
      />,
    );
    const card = screen.getByTestId("cartera-card-test-project");
    expect(card.textContent).toMatch(/estancado/i);
    expect(card.textContent).toMatch(/sin señal/i);
  });
});
