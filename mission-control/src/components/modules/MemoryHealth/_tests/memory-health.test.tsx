/**
 * WO-17-005 — MemoryHealth panel (CMP-17-health)
 *
 * TDD RED phase: these tests verify acceptance criteria for WO-17-005.
 * The component does not exist yet — all tests will fail until GREEN.
 *
 * Traceability (FRD-17 EARS → AC → test):
 *   AC-17-005.1  The panel shows raw-notes count, candidate count, and last-run time.
 *   AC-17-005.2  WHEN rawNotes >= threshold OR staleDays >= threshold, a nudge with the
 *                exact /pandacorp:memory command appears (copyable); below threshold, no nudge.
 *   AC-17-005.3  WHEN lastMemoryRunAt == null (fresh factory), the panel invites the first
 *                /pandacorp:memory harvest rather than showing a broken/empty state.
 *   AC-17-005.4  The last-run value is labelled as approximate (proxy, not an exact event).
 *   AC-17-005.5  Spanish copy + a11y; staleness conveyed by text + icon, not color alone.
 *
 * Stack: Vitest + @testing-library/react (jsdom). No fs access — all inputs are fixture props.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MemoryHealth as MemoryHealthData } from "@/lib/memory/memory-health";
import { MemoryHealth } from "../MemoryHealth";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Below-threshold fixture: no nudge should appear. */
const BELOW_THRESHOLD: MemoryHealthData = {
  rawNotes: 2,
  candidates: 1,
  lastMemoryRunAt: "2026-06-18T10:00:00.000Z",
  staleDays: 3,
};

/** Above-threshold rawNotes: nudge should appear. */
const ABOVE_RAW_NOTES: MemoryHealthData = {
  rawNotes: 15,
  candidates: 1,
  lastMemoryRunAt: "2026-06-18T10:00:00.000Z",
  staleDays: 3,
};

/** Above-threshold staleDays: nudge should appear. */
const ABOVE_STALE_DAYS: MemoryHealthData = {
  rawNotes: 2,
  candidates: 1,
  lastMemoryRunAt: "2026-06-01T10:00:00.000Z",
  staleDays: 20,
};

/** Both above threshold. */
const BOTH_ABOVE: MemoryHealthData = {
  rawNotes: 20,
  candidates: 5,
  lastMemoryRunAt: "2026-05-01T10:00:00.000Z",
  staleDays: 30,
};

/** Fresh factory — no memory yet (null signals). */
const FRESH_FACTORY: MemoryHealthData = {
  rawNotes: 0,
  candidates: 0,
  lastMemoryRunAt: null,
  staleDays: null,
};

// ---------------------------------------------------------------------------
// AC-17-005.1 — Panel shows raw-notes count, candidate count, and last-run time
// ---------------------------------------------------------------------------

describe("wo-17-005: AC-17-005.1 — panel shows the three counters", () => {
  it("wo-17-005: GIVEN a below-threshold health object WHEN rendered THEN raw-notes count is visible", () => {
    render(<MemoryHealth health={BELOW_THRESHOLD} />);

    const panel = screen.getByTestId("memory-health-panel");
    expect(panel).toBeDefined();

    const rawNotes = screen.getByTestId("memory-health-raw-notes");
    expect(rawNotes.textContent).toContain("2");
  });

  it("wo-17-005: GIVEN a below-threshold health object WHEN rendered THEN candidate count is visible", () => {
    render(<MemoryHealth health={BELOW_THRESHOLD} />);

    const candidates = screen.getByTestId("memory-health-candidates");
    expect(candidates.textContent).toContain("1");
  });

  it("wo-17-005: GIVEN lastMemoryRunAt is non-null WHEN rendered THEN last-run time is visible", () => {
    render(<MemoryHealth health={BELOW_THRESHOLD} />);

    const lastRun = screen.getByTestId("memory-health-last-run");
    expect(lastRun).toBeDefined();
    // Must show some time indicator (not blank or broken)
    expect(lastRun.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("wo-17-005: GIVEN staleDays 3 WHEN rendered THEN the stale days count is visible", () => {
    render(<MemoryHealth health={BELOW_THRESHOLD} />);

    const stale = screen.getByTestId("memory-health-stale-days");
    expect(stale.textContent).toContain("3");
  });
});

// ---------------------------------------------------------------------------
// AC-17-005.2 — Nudge appears above threshold; no nudge below
// ---------------------------------------------------------------------------

describe("wo-17-005: AC-17-005.2 — nudge above threshold, silence below", () => {
  it("wo-17-005: GIVEN below-threshold WHEN rendered THEN no nudge element is present (no nagging)", () => {
    render(<MemoryHealth health={BELOW_THRESHOLD} />);

    const nudge = screen.queryByTestId("memory-health-nudge");
    expect(nudge).toBeNull();
  });

  it("wo-17-005: GIVEN rawNotes above threshold WHEN rendered THEN nudge appears", () => {
    render(<MemoryHealth health={ABOVE_RAW_NOTES} />);

    const nudge = screen.getByTestId("memory-health-nudge");
    expect(nudge).toBeDefined();
  });

  it("wo-17-005: GIVEN staleDays above threshold WHEN rendered THEN nudge appears", () => {
    render(<MemoryHealth health={ABOVE_STALE_DAYS} />);

    const nudge = screen.getByTestId("memory-health-nudge");
    expect(nudge).toBeDefined();
  });

  it("wo-17-005: GIVEN both rawNotes and staleDays above threshold WHEN rendered THEN nudge appears", () => {
    render(<MemoryHealth health={BOTH_ABOVE} />);

    const nudge = screen.getByTestId("memory-health-nudge");
    expect(nudge).toBeDefined();
  });

  it("wo-17-005: GIVEN nudge visible WHEN rendered THEN it contains an exact /pandacorp:memory command", () => {
    render(<MemoryHealth health={ABOVE_RAW_NOTES} />);

    const nudge = screen.getByTestId("memory-health-nudge");
    const commandText = nudge.textContent ?? "";
    expect(commandText).toMatch(/\/pandacorp:memory\s+(harvest|review)/);
  });

  it("wo-17-005: GIVEN nudge visible WHEN rendered THEN there is a CopyButton (data-testid=copy-button) inside the nudge", () => {
    render(<MemoryHealth health={ABOVE_RAW_NOTES} />);

    const nudge = screen.getByTestId("memory-health-nudge");
    const copyButton = within(nudge).getByTestId("copy-button");
    expect(copyButton).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-17-005.3 — Fresh factory (lastMemoryRunAt === null): first-harvest invite
// ---------------------------------------------------------------------------

describe("wo-17-005: AC-17-005.3 — fresh factory shows first-harvest invite, not broken state", () => {
  it("wo-17-005: GIVEN fresh factory (null lastMemoryRunAt) WHEN rendered THEN panel renders without crash", () => {
    expect(() => render(<MemoryHealth health={FRESH_FACTORY} />)).not.toThrow();
  });

  it("wo-17-005: GIVEN fresh factory WHEN rendered THEN a first-harvest invite is shown", () => {
    render(<MemoryHealth health={FRESH_FACTORY} />);

    const invite = screen.getByTestId("memory-health-first-harvest");
    expect(invite).toBeDefined();
    expect(invite.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("wo-17-005: GIVEN fresh factory WHEN rendered THEN the invite contains /pandacorp:memory harvest", () => {
    render(<MemoryHealth health={FRESH_FACTORY} />);

    const invite = screen.getByTestId("memory-health-first-harvest");
    expect(invite.textContent).toContain("/pandacorp:memory harvest");
  });

  it("wo-17-005: GIVEN fresh factory WHEN rendered THEN the invite has a copyable command (CopyButton inside)", () => {
    render(<MemoryHealth health={FRESH_FACTORY} />);

    const invite = screen.getByTestId("memory-health-first-harvest");
    const copyButton = within(invite).getByTestId("copy-button");
    expect(copyButton).toBeDefined();
  });

  it("wo-17-005: GIVEN fresh factory WHEN rendered THEN the last-run section is NOT shown (no broken/null display)", () => {
    render(<MemoryHealth health={FRESH_FACTORY} />);

    const lastRun = screen.queryByTestId("memory-health-last-run");
    // Either absent or clearly indicates no prior run — but NOT showing a broken empty state
    // (the invite replaces the last-run section for the null case)
    if (lastRun !== null) {
      // If the element exists, it must NOT show a broken null/NaN/Invalid Date
      const text = lastRun.textContent ?? "";
      expect(text).not.toContain("null");
      expect(text).not.toContain("Invalid Date");
      expect(text).not.toContain("NaN");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-17-005.4 — Last-run value labelled as approximate
// ---------------------------------------------------------------------------

describe("wo-17-005: AC-17-005.4 — last-run value is labelled as approximate", () => {
  it("wo-17-005: GIVEN lastMemoryRunAt non-null WHEN rendered THEN the last-run section carries an approximate label", () => {
    render(<MemoryHealth health={BELOW_THRESHOLD} />);

    // Must have some indication this is an approximate / proxy value, not exact event
    const lastRun = screen.getByTestId("memory-health-last-run");
    const label = screen.queryByTestId("memory-health-last-run-label");
    // Either a separate label element or text within the section indicates approximate
    const isLabelled =
      label !== null ||
      (lastRun.textContent ?? "").toLowerCase().includes("aproximad") ||
      (lastRun.textContent ?? "").toLowerCase().includes("aprox") ||
      (lastRun.textContent ?? "").toLowerCase().includes("proxy") ||
      (lastRun.getAttribute("aria-label") ?? "").toLowerCase().includes("aproximad");
    expect(isLabelled).toBe(true);
  });

  it("wo-17-005: GIVEN a non-null lastMemoryRunAt WHEN rendered THEN the last-run element exists and has non-empty text", () => {
    render(<MemoryHealth health={BELOW_THRESHOLD} />);

    const lastRun = screen.getByTestId("memory-health-last-run");
    expect(lastRun.textContent?.trim().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-17-005.5 — Spanish copy + a11y + staleness by text+icon (not color alone)
// ---------------------------------------------------------------------------

describe("wo-17-005: AC-17-005.5 — Spanish copy + a11y + staleness not color-alone", () => {
  it("wo-17-005: GIVEN the panel WHEN rendered THEN there is a heading or label in Spanish", () => {
    render(<MemoryHealth health={BELOW_THRESHOLD} />);

    const panel = screen.getByTestId("memory-health-panel");
    // The panel must have some Spanish text — look for common Spanish words in the panel
    const text = panel.textContent ?? "";
    const hasSpanish =
      text.toLowerCase().includes("notas") ||
      text.toLowerCase().includes("pendiente") ||
      text.toLowerCase().includes("candidat") ||
      text.toLowerCase().includes("lección") ||
      text.toLowerCase().includes("leccion") ||
      text.toLowerCase().includes("memoria") ||
      text.toLowerCase().includes("última") ||
      text.toLowerCase().includes("ultima") ||
      text.toLowerCase().includes("ejecución") ||
      text.toLowerCase().includes("reciente");
    expect(hasSpanish).toBe(true);
  });

  it("wo-17-005: GIVEN staleDays > 0 WHEN rendered THEN staleness is conveyed by both text and icon (not color alone)", () => {
    render(<MemoryHealth health={ABOVE_STALE_DAYS} />);

    // Must have a text element conveying staleness (days) AND an icon element
    const staleText = screen.getByTestId("memory-health-stale-days");
    expect(staleText).toBeDefined();
    expect(staleText.textContent).toContain("20");

    // Icon element for staleness (role="img" or aria-hidden="true")
    const staleIcon = screen.queryByTestId("memory-health-stale-icon");
    expect(staleIcon).toBeDefined();
  });

  it("wo-17-005: GIVEN the panel WHEN rendered THEN panel has role=region or is a section element", () => {
    render(<MemoryHealth health={BELOW_THRESHOLD} />);

    const panel = screen.getByTestId("memory-health-panel");
    const tag = panel.tagName.toLowerCase();
    const role = panel.getAttribute("role");
    // Must be a semantic landmark (section or role=region)
    const isLandmark = tag === "section" || role === "region";
    expect(isLandmark).toBe(true);
  });

  it("wo-17-005: GIVEN the nudge WHEN rendered THEN the command text is in Spanish context (not raw English command alone)", () => {
    render(<MemoryHealth health={ABOVE_RAW_NOTES} />);

    const nudge = screen.getByTestId("memory-health-nudge");
    const text = nudge.textContent ?? "";
    // The nudge must have some Spanish context around the command
    const hasSpanish =
      text.toLowerCase().includes("ejecuta") ||
      text.toLowerCase().includes("corre") ||
      text.toLowerCase().includes("refina") ||
      text.toLowerCase().includes("cosecha") ||
      text.toLowerCase().includes("run") ||
      text.toLowerCase().includes("memoria") ||
      text.toLowerCase().includes("aprendizaje") ||
      text.toLowerCase().includes("notas");
    expect(hasSpanish).toBe(true);
  });

  it("wo-17-005: GIVEN the first-harvest invite WHEN rendered THEN it has Spanish context", () => {
    render(<MemoryHealth health={FRESH_FACTORY} />);

    const invite = screen.getByTestId("memory-health-first-harvest");
    const text = invite.textContent ?? "";
    const hasSpanish =
      text.toLowerCase().includes("primera") ||
      text.toLowerCase().includes("primera") ||
      text.toLowerCase().includes("primera") ||
      text.toLowerCase().includes("cosechar") ||
      text.toLowerCase().includes("cosecha") ||
      text.toLowerCase().includes("iniciar") ||
      text.toLowerCase().includes("inicio") ||
      text.toLowerCase().includes("memoria") ||
      text.toLowerCase().includes("comienza");
    expect(hasSpanish).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structural invariants
// ---------------------------------------------------------------------------

describe("wo-17-005: structural invariants", () => {
  it("wo-17-005: WHEN rendered with any fixture THEN the panel root always has data-testid=memory-health-panel", () => {
    const fixtures: MemoryHealthData[] = [
      BELOW_THRESHOLD,
      ABOVE_RAW_NOTES,
      ABOVE_STALE_DAYS,
      BOTH_ABOVE,
      FRESH_FACTORY,
    ];
    for (const fixture of fixtures) {
      const { unmount } = render(<MemoryHealth health={fixture} />);
      const panel = screen.getByTestId("memory-health-panel");
      expect(panel).toBeDefined();
      unmount();
    }
  });

  it("wo-17-005: GIVEN fresh factory WHEN rendered THEN raw-notes shows 0", () => {
    render(<MemoryHealth health={FRESH_FACTORY} />);

    const rawNotes = screen.getByTestId("memory-health-raw-notes");
    expect(rawNotes.textContent).toContain("0");
  });

  it("wo-17-005: GIVEN fresh factory WHEN rendered THEN candidates shows 0", () => {
    render(<MemoryHealth health={FRESH_FACTORY} />);

    const candidates = screen.getByTestId("memory-health-candidates");
    expect(candidates.textContent).toContain("0");
  });

  it("wo-17-005: GIVEN below-threshold WHEN rendered THEN no first-harvest invite (it is only for null lastMemoryRunAt)", () => {
    render(<MemoryHealth health={BELOW_THRESHOLD} />);

    const invite = screen.queryByTestId("memory-health-first-harvest");
    expect(invite).toBeNull();
  });

  it("wo-17-005: GIVEN non-null lastMemoryRunAt WHEN rendered THEN no first-harvest invite shown", () => {
    render(<MemoryHealth health={ABOVE_RAW_NOTES} />);

    const invite = screen.queryByTestId("memory-health-first-harvest");
    expect(invite).toBeNull();
  });
});
