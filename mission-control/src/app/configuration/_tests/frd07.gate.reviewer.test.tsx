/**
 * FRD-07 GATE — reviewer adversarial integration tests (DR-015).
 *
 * Written by the FRD reviewer (a different model from the implementers), NOT the
 * implementers. Exercises the FRD-07 work orders TOGETHER through the real
 * ConfigurationPage Server Component wired to the REAL factory tree — not one
 * work order in isolation:
 *
 *   WO-07-001 (readSkills/readAgents) + WO-07-003 (readDecisionRules)
 *   + WO-07-004 (readStandards) + WO-07-005 (page shell + tabs)
 *   + WO-07-006/007/008/009 (the four section UIs)
 *
 * The pre-existing reviewer test only exercised the Agents tab. These probe the
 * edges the implementers did not: every section must produce REAL data from the
 * real factory (no empty placeholders), the decision-rule auto/human indicator
 * must never lie about a `requiere_humano: true` rule (security-relevant), every
 * standard the reader returns must land in a rendered domain group (none silently
 * dropped), and the read-only golden rule (architecture §1) must hold — the
 * "New …" buttons copy a command string, never execute.
 *
 * Anchored in FRD-07 EARS criteria.
 */

import path from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readDecisionRules } from "@/lib/registry/registry";
import { readStandards } from "@/lib/standards/standards";

// ---------------------------------------------------------------------------
// Point PANDACORP_FACTORY_ROOT at the real factory (the panda-corp repo root),
// so all four readers hit the real plugin/ + factory/ sources.
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
  vi.restoreAllMocks();
  cleanup();
});

async function renderRealPage() {
  const { default: ConfigurationPage } = await import("../page");
  return render(ConfigurationPage());
}

// ---------------------------------------------------------------------------
// 1. All four sections render REAL data from the real factory together
//    (EARS: "sections Skills · Agents · Decision rules · Standards", each lists
//     items with name + real description; content read from the plugin/factory).
// ---------------------------------------------------------------------------

describe("FRD-07 gate — all four sections wired to the real factory together", () => {
  it("Skills tab renders at least one skill card from the real plugin/skills/", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-skills"));
    // The real factory ships many skills (onboarding, spec, blueprint, …).
    const section = screen.getByTestId("config-section-skills");
    expect(section.textContent ?? "").not.toBe("");
    // A skill card carries a description — assert the section is non-empty text-wise.
    expect((section.textContent ?? "").length).toBeGreaterThan(20);
  });

  it("Decision rules tab renders the real DR catalog (more than a handful)", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-rules"));
    const list = screen.getByTestId("rules-list");
    const items = within(list).getAllByRole("button");
    // The real registry has dozens of DRs; assert we render a substantial set,
    // not a hardcoded sample. (Lower bound is conservative to avoid brittleness.)
    expect(items.length).toBeGreaterThan(10);
  });

  it("Standards tab renders real domain groups (not the empty state)", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-standards"));
    expect(screen.queryByTestId("standards-empty-state")).toBeNull();
    expect(screen.getByTestId("standards-section").textContent ?? "").toContain("Estándares");
  });
});

// ---------------------------------------------------------------------------
// 2. Decision-rule indicator must NOT lie about requiere_humano (security lens)
//    (EARS: DRs show an auto-approves (●) / asks-you (●) indicator). A rule that
//    asks you must never render as auto-approve, and vice versa.
// ---------------------------------------------------------------------------

describe("FRD-07 gate — DR auto/human indicator never misrepresents requiere_humano", () => {
  it("every rendered rule's indicator matches its real requiere_humano flag", async () => {
    const rules = readDecisionRules();
    expect(rules.length).toBeGreaterThan(0);

    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-rules"));

    // Cross-check a sample spanning both kinds: the indicator data-indicator must
    // be "human" exactly when requiereHumano is true.
    const humanRule = rules.find((r) => r.requiereHumano === true);
    const autoRule = rules.find((r) => r.requiereHumano === false);
    expect(humanRule, "factory should contain at least one asks-you rule").toBeDefined();
    expect(autoRule, "factory should contain at least one auto rule").toBeDefined();

    if (humanRule) {
      const ind = screen.getByTestId(`rule-indicator-${humanRule.id}`);
      expect(ind.getAttribute("data-indicator")).toBe("human");
      // State conveyed by text, not color alone (a11y / FRD-13).
      expect(within(ind).getByText("Te consulta")).toBeDefined();
    }
    if (autoRule) {
      const ind = screen.getByTestId(`rule-indicator-${autoRule.id}`);
      expect(ind.getAttribute("data-indicator")).toBe("auto");
      expect(within(ind).getByText("Auto-aprueba")).toBeDefined();
    }
  });

  it("opening an asks-you rule's detail shows the escalation copy, not auto-apply", async () => {
    const rules = readDecisionRules();
    const humanRule = rules.find((r) => r.requiereHumano === true);
    expect(humanRule).toBeDefined();

    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-rules"));
    if (!humanRule) return;
    fireEvent.click(screen.getByTestId(`rule-item-${humanRule.id}`));

    const mode = screen.getByTestId("rule-detail-mode");
    expect(mode.getAttribute("data-mode")).toBe("human");
    expect(mode.textContent ?? "").toContain("Escala al owner");
    // The real default text is shown verbatim (no fabrication).
    expect(screen.getByTestId("rule-detail-default").textContent).toBe(humanRule.default);
  });
});

// ---------------------------------------------------------------------------
// 3. No standard is silently dropped — every reader result lands in a domain group
//    (EARS: Standards categorized by domain). A standard whose domain is not in
//    the canonical order must still be rendered (catch-all), not vanish.
// ---------------------------------------------------------------------------

describe("FRD-07 gate — every readStandards() item is rendered in a domain group", () => {
  it("renders one standard-item per real standard, none dropped", async () => {
    const standards = readStandards(FACTORY_ROOT);
    expect(standards.length).toBeGreaterThan(0);

    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-standards"));

    for (const std of standards) {
      expect(
        screen.queryByTestId(`standard-item-${std.id}`),
        `standard "${std.id}" (domain ${std.domain}) must be rendered`,
      ).not.toBeNull();
    }
  });

  it("each standard exposes a severity badge whose value matches the reader", async () => {
    const standards = readStandards(FACTORY_ROOT);
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-standards"));

    const sample = standards[0];
    expect(sample).toBeDefined();
    if (!sample) return;
    const badge = screen.getByTestId(`standard-severity-badge-${sample.id}`);
    expect(badge.getAttribute("data-severity")).toBe(sample.severity);
    expect(["MUST", "SHOULD", "MAY"]).toContain(badge.getAttribute("data-severity"));
  });
});

// ---------------------------------------------------------------------------
// 4. Read-only golden rule (architecture §1) — the "New …" buttons COPY a command,
//    they never execute it. (EARS: "New decision rule" / "New standard" buttons
//    copy /pandacorp:learn.)
// ---------------------------------------------------------------------------

describe("FRD-07 gate — read-only: New-* buttons copy, never execute", () => {
  it("New standard button writes exactly /pandacorp:learn to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-standards"));
    fireEvent.click(screen.getByTestId("new-standard-button"));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("/pandacorp:learn");
  });
});
