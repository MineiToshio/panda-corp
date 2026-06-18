/**
 * WO-07-008 — Decision rules section: list + detail (CMP-07-rules-list, CMP-07-rule-detail) tests
 *
 * Traceability:
 *   AC-07-008.1 The section SHALL explain what a decision rule IS (short intro).
 *   AC-07-008.2 The section SHALL list ALL decision rules (readDecisionRules()) each with an
 *               indicator: auto-approves (●) when requiereHumano is false, asks you (●) when true,
 *               paired with a label/shape (not color alone, FRD-13).
 *   AC-07-008.3 WHEN the owner clicks a rule, the detail SHALL show the pre-approved default and
 *               how it is applied (escalates to you vs auto-applied + verified by a script/hook/CI).
 *   AC-07-008.4 The section SHALL include a "New decision rule" button that copies /pandacorp:learn
 *               to the clipboard (reuses CopyButton); it SHALL NOT execute anything.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Tests cover DecisionRulesSection (list + detail) and the copy-only "New decision rule" button.
 *
 * IMPORTANT: These are CLIENT component tests. The component receives rules as props
 * (props-down pattern so Server Component can pass data; the component itself is "use client"
 * for interactivity).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DecisionRule } from "@/lib/registry/registry";
import { DecisionRulesSection } from "../DecisionRulesSection";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DR_AUTO: DecisionRule = {
  id: "DR-001",
  patron: "add an npm/pip dependency to a project",
  default: "auto-approve if: no known CVEs, maintained within 12 months, permissive license",
  requiereHumano: false,
};

const DR_HUMAN: DecisionRule = {
  id: "DR-002",
  patron: "stack/technology choice for a new project",
  default: "BLOCK — requires explicit approval from the owner",
  requiereHumano: true,
  nota: "lightweight approval within the blueprint, not a separate gate",
};

const DR_AUTO_2: DecisionRule = {
  id: "DR-003",
  patron: "deploy to staging / test environment",
  default: "auto-approve if CI is green",
  requiereHumano: false,
};

const SAMPLE_RULES: DecisionRule[] = [DR_AUTO, DR_HUMAN, DR_AUTO_2];

// ---------------------------------------------------------------------------
// AC-07-008.1 — Section intro explaining what a decision rule IS
// ---------------------------------------------------------------------------

describe("frd-07: DecisionRulesSection — AC-07-008.1 intro text present", () => {
  it("frd-07: AC-07-008.1 — renders a section intro element", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    expect(screen.getByTestId("rules-intro")).toBeDefined();
  });

  it("frd-07: AC-07-008.1 — intro explains what a decision rule IS (non-empty text)", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    const intro = screen.getByTestId("rules-intro");
    expect(intro.textContent?.length).toBeGreaterThan(20);
  });

  it("frd-07: AC-07-008.1 — intro is in Spanish", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    const intro = screen.getByTestId("rules-intro");
    // Must contain at least one Spanish word commonly used for rules/decisions
    const text = intro.textContent ?? "";
    const hasSpanish =
      text.toLowerCase().includes("regla") ||
      text.toLowerCase().includes("decisión") ||
      text.toLowerCase().includes("fabrica") ||
      text.toLowerCase().includes("fábrica") ||
      text.toLowerCase().includes("aprueba") ||
      text.toLowerCase().includes("automáticamente") ||
      text.toLowerCase().includes("política");
    expect(hasSpanish).toBe(true);
  });

  it("frd-07: AC-07-008.1 — section root has data-testid='rules-section'", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    expect(screen.getByTestId("rules-section")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-07-008.2 — List ALL decision rules with auto/human indicator
// ---------------------------------------------------------------------------

describe("frd-07: DecisionRulesSection — AC-07-008.2 rule list with indicators", () => {
  it("frd-07: AC-07-008.2 — renders a list container", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    expect(screen.getByTestId("rules-list")).toBeDefined();
  });

  it("frd-07: AC-07-008.2 — renders exactly the number of rules provided", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    const items = screen.getAllByTestId(/^rule-item-/);
    expect(items.length).toBe(SAMPLE_RULES.length);
  });

  it("frd-07: AC-07-008.2 — renders each rule's id visible in the list", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    expect(screen.getByText("DR-001")).toBeDefined();
    expect(screen.getByText("DR-002")).toBeDefined();
    expect(screen.getByText("DR-003")).toBeDefined();
  });

  it("frd-07: AC-07-008.2 — renders rule item with testid rule-item-{id}", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    expect(screen.getByTestId("rule-item-DR-001")).toBeDefined();
    expect(screen.getByTestId("rule-item-DR-002")).toBeDefined();
    expect(screen.getByTestId("rule-item-DR-003")).toBeDefined();
  });

  it("frd-07: AC-07-008.2 — auto-approve rule (requiereHumano=false) has data-auto='true'", () => {
    render(<DecisionRulesSection rules={[DR_AUTO]} />);
    expect(screen.getByTestId("rule-item-DR-001").getAttribute("data-auto")).toBe("true");
  });

  it("frd-07: AC-07-008.2 — asks-you rule (requiereHumano=true) has data-auto='false'", () => {
    render(<DecisionRulesSection rules={[DR_HUMAN]} />);
    expect(screen.getByTestId("rule-item-DR-002").getAttribute("data-auto")).toBe("false");
  });

  it("frd-07: AC-07-008.2 — auto-approve rule shows the ● indicator (data-indicator='auto')", () => {
    render(<DecisionRulesSection rules={[DR_AUTO]} />);
    const indicator = screen.getByTestId("rule-indicator-DR-001");
    expect(indicator.getAttribute("data-indicator")).toBe("auto");
  });

  it("frd-07: AC-07-008.2 — asks-you rule shows the ● indicator (data-indicator='human')", () => {
    render(<DecisionRulesSection rules={[DR_HUMAN]} />);
    const indicator = screen.getByTestId("rule-indicator-DR-002");
    expect(indicator.getAttribute("data-indicator")).toBe("human");
  });

  it("frd-07: AC-07-008.2 — auto indicator is paired with a visible label (not color alone)", () => {
    render(<DecisionRulesSection rules={[DR_AUTO]} />);
    // Must have text content (label) alongside indicator — FRD-13 a11y: not color alone
    const label = screen.getByTestId("rule-indicator-label-DR-001");
    expect(label.textContent?.length).toBeGreaterThan(0);
  });

  it("frd-07: AC-07-008.2 — human indicator is paired with a visible label (not color alone)", () => {
    render(<DecisionRulesSection rules={[DR_HUMAN]} />);
    const label = screen.getByTestId("rule-indicator-label-DR-002");
    expect(label.textContent?.length).toBeGreaterThan(0);
  });

  it("frd-07: AC-07-008.2 — auto and human indicator labels are DIFFERENT text", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    const autoLabel = screen.getByTestId("rule-indicator-label-DR-001");
    const humanLabel = screen.getByTestId("rule-indicator-label-DR-002");
    expect(autoLabel.textContent).not.toBe(humanLabel.textContent);
  });

  it("frd-07: AC-07-008.2 — renders patron text for each rule", () => {
    render(<DecisionRulesSection rules={[DR_AUTO]} />);
    expect(screen.getByText(DR_AUTO.patron)).toBeDefined();
  });

  it("frd-07: AC-07-008.2 — empty rules list renders empty state without crash", () => {
    render(<DecisionRulesSection rules={[]} />);
    expect(screen.getByTestId("rules-list")).toBeDefined();
    expect(screen.queryAllByTestId(/^rule-item-/).length).toBe(0);
  });

  it("frd-07: AC-07-008.2 — empty list shows a helpful empty state message", () => {
    render(<DecisionRulesSection rules={[]} />);
    const emptyMsg = screen.getByTestId("rules-empty");
    expect(emptyMsg.textContent?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-07-008.3 — Clicking a rule shows its detail (default + how it's applied)
// ---------------------------------------------------------------------------

describe("frd-07: DecisionRulesSection — AC-07-008.3 rule detail on click", () => {
  it("frd-07: AC-07-008.3 — initially no detail panel is shown", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    expect(screen.queryByTestId("rule-detail")).toBeNull();
  });

  it("frd-07: AC-07-008.3 — WHEN clicking a rule THEN the detail panel appears", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    expect(screen.getByTestId("rule-detail")).toBeDefined();
  });

  it("frd-07: AC-07-008.3 — WHEN clicking DR-001 THEN detail shows DR-001 id", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    const detail = screen.getByTestId("rule-detail");
    expect(detail.textContent).toContain("DR-001");
  });

  it("frd-07: AC-07-008.3 — detail shows the pre-approved default of the selected rule", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    const detail = screen.getByTestId("rule-detail");
    expect(detail.textContent).toContain(DR_AUTO.default);
  });

  it("frd-07: AC-07-008.3 — detail default value has data-testid='rule-detail-default'", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    expect(screen.getByTestId("rule-detail-default")).toBeDefined();
  });

  it("frd-07: AC-07-008.3 — WHEN auto rule selected THEN detail shows 'auto-applied' mode", () => {
    render(<DecisionRulesSection rules={[DR_AUTO]} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    const mode = screen.getByTestId("rule-detail-mode");
    expect(mode.getAttribute("data-mode")).toBe("auto");
  });

  it("frd-07: AC-07-008.3 — WHEN human rule selected THEN detail shows 'escalates' mode", () => {
    render(<DecisionRulesSection rules={[DR_HUMAN]} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-002"));
    const mode = screen.getByTestId("rule-detail-mode");
    expect(mode.getAttribute("data-mode")).toBe("human");
  });

  it("frd-07: AC-07-008.3 — auto mode detail explains 'auto-applied' in Spanish", () => {
    render(<DecisionRulesSection rules={[DR_AUTO]} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    const mode = screen.getByTestId("rule-detail-mode");
    const text = mode.textContent ?? "";
    const hasAutoText =
      text.toLowerCase().includes("automáticamente") ||
      text.toLowerCase().includes("automática") ||
      text.toLowerCase().includes("auto") ||
      text.toLowerCase().includes("script") ||
      text.toLowerCase().includes("ci") ||
      text.toLowerCase().includes("hook");
    expect(hasAutoText).toBe(true);
  });

  it("frd-07: AC-07-008.3 — human mode detail explains 'escalates to you' in Spanish", () => {
    render(<DecisionRulesSection rules={[DR_HUMAN]} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-002"));
    const mode = screen.getByTestId("rule-detail-mode");
    const text = mode.textContent ?? "";
    const hasHumanText =
      text.toLowerCase().includes("escala") ||
      text.toLowerCase().includes("requiere") ||
      text.toLowerCase().includes("aprobación") ||
      text.toLowerCase().includes("humano") ||
      text.toLowerCase().includes("owner") ||
      text.toLowerCase().includes("bloquea");
    expect(hasHumanText).toBe(true);
  });

  it("frd-07: AC-07-008.3 — WHEN rule has nota THEN detail shows nota", () => {
    render(<DecisionRulesSection rules={[DR_HUMAN]} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-002"));
    const detail = screen.getByTestId("rule-detail");
    expect(detail.textContent).toContain(DR_HUMAN.nota);
  });

  it("frd-07: AC-07-008.3 — WHEN rule has NO nota THEN nota element is absent", () => {
    render(<DecisionRulesSection rules={[DR_AUTO]} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    expect(screen.queryByTestId("rule-detail-nota")).toBeNull();
  });

  it("frd-07: AC-07-008.3 — WHEN clicking a different rule THEN detail switches to the new rule", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    expect(screen.getByTestId("rule-detail").textContent).toContain("DR-001");
    fireEvent.click(screen.getByTestId("rule-item-DR-002"));
    const detail = screen.getByTestId("rule-detail");
    expect(detail.textContent).toContain("DR-002");
    expect(detail.textContent).not.toContain("DR-001");
  });

  it("frd-07: AC-07-008.3 — WHEN clicking the same rule twice THEN detail closes (toggle)", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    expect(screen.getByTestId("rule-detail")).toBeDefined();
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    expect(screen.queryByTestId("rule-detail")).toBeNull();
  });

  it("frd-07: AC-07-008.3 — selected rule item has data-selected='true'", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    expect(screen.getByTestId("rule-item-DR-001").getAttribute("data-selected")).toBe("true");
  });

  it("frd-07: AC-07-008.3 — non-selected rule items have data-selected='false'", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-001"));
    expect(screen.getByTestId("rule-item-DR-002").getAttribute("data-selected")).toBe("false");
  });

  it("frd-07: AC-07-008.3 — detail has rule patron text", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    fireEvent.click(screen.getByTestId("rule-item-DR-002"));
    const detail = screen.getByTestId("rule-detail");
    expect(detail.textContent).toContain(DR_HUMAN.patron);
  });
});

// ---------------------------------------------------------------------------
// AC-07-008.4 — "New decision rule" button copies /pandacorp:learn (no exec)
// ---------------------------------------------------------------------------

describe("frd-07: DecisionRulesSection — AC-07-008.4 New decision rule CopyButton", () => {
  it("frd-07: AC-07-008.4 — renders the 'New decision rule' button", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    expect(screen.getByTestId("rules-new-rule-btn")).toBeDefined();
  });

  it("frd-07: AC-07-008.4 — new rule button has Spanish label text", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    const btn = screen.getByTestId("rules-new-rule-btn");
    const text = btn.textContent ?? "";
    const hasSpanish =
      text.toLowerCase().includes("nueva regla") ||
      text.toLowerCase().includes("nueva") ||
      text.toLowerCase().includes("regla") ||
      text.toLowerCase().includes("decisión") ||
      text.toLowerCase().includes("nueva regla de decisión");
    expect(hasSpanish).toBe(true);
  });

  it("frd-07: AC-07-008.4 — new rule button contains a CopyButton (data-testid='copy-button')", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    const container = screen.getByTestId("rules-new-rule-btn");
    // CopyButton renders data-testid="copy-button" inside the wrapper
    expect(container.querySelector("[data-testid='copy-button']")).toBeDefined();
  });

  it("frd-07: AC-07-008.4 — WHEN CopyButton clicked THEN writes /pandacorp:learn to clipboard", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn(async (text: string) => {
          written.push(text);
        }),
      },
      writable: true,
      configurable: true,
    });

    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    const copyBtn = screen
      .getByTestId("rules-new-rule-btn")
      .querySelector("[data-testid='copy-button']");
    expect(copyBtn).not.toBeNull();
    if (copyBtn) {
      fireEvent.click(copyBtn);
    }

    await waitFor(() => {
      expect(written.length).toBeGreaterThan(0);
    });
    expect(written[0]).toBe("/pandacorp:learn");
  });

  it("frd-07: AC-07-008.4 — new rule button is type='button' or wraps type='button' (no submit)", () => {
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    const container = screen.getByTestId("rules-new-rule-btn");
    const btn = container.querySelector("button");
    expect(btn?.getAttribute("type")).toBe("button");
  });

  it("frd-07: AC-07-008.4 — section renders without crash when rules array is empty", () => {
    render(<DecisionRulesSection rules={[]} />);
    // Should still show intro, empty state, and new rule button
    expect(screen.getByTestId("rules-intro")).toBeDefined();
    expect(screen.getByTestId("rules-new-rule-btn")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Integration: ConfigurationShell wires rules section (smoke test)
// ---------------------------------------------------------------------------

describe("frd-07: DecisionRulesSection — integration with ConfigurationShell", () => {
  it("frd-07: WHEN rules section is active THEN rules-section is present", () => {
    // ConfigurationShell renders the rules panel (WO-07-008 wires this)
    // This test imports the standalone component — the shell integration is
    // covered by the page.test.tsx after ConfigurationShell is updated.
    render(<DecisionRulesSection rules={SAMPLE_RULES} />);
    expect(screen.getByTestId("rules-section")).toBeDefined();
  });
});
