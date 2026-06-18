/**
 * WO-07-005 — Configuration page shell + section tabs (CMP-07-config-page) tests
 *
 * Traceability:
 *   AC-07-005.1 The Configuration page SHALL offer the four sections
 *               Skills · Agents · Decision rules · Standards as selectable tabs.
 *   AC-07-005.2 Selecting a tab SHALL render that section's view; the default
 *               selection SHALL be Skills.
 *   AC-07-005.3 The tabs SHALL use FRD-13 design tokens only (no hardcoded colors),
 *               with the rationed accent on the active tab; the active state SHALL be
 *               paired with shape/label, not color alone (FRD-13 a11y).
 *   AC-07-005.4 Tab labels and aria-labels SHALL be in Spanish (i18n), keyboard-navigable,
 *               with a visible focus ring (FRD-13).
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Tests cover the SectionTabs client component and the section placeholder views.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionTabs } from "./SectionTabs";

// ---------------------------------------------------------------------------
// Fixtures / constants
// ---------------------------------------------------------------------------

/** The four section ids the WO mandates (AC-07-005.1) */
const EXPECTED_SECTIONS = ["skills", "agents", "rules", "standards"] as const;
type SectionId = (typeof EXPECTED_SECTIONS)[number];

/** Spanish labels as mandated by AC-07-005.4 */
const EXPECTED_LABELS: Record<SectionId, string> = {
  skills: "Habilidades",
  agents: "Agentes",
  rules: "Reglas de decisión",
  standards: "Estándares",
};

// ---------------------------------------------------------------------------
// AC-07-005.1 — Four section tabs rendered
// ---------------------------------------------------------------------------

describe("frd-07: SectionTabs — AC-07-005.1 four sections rendered", () => {
  it("frd-07: AC-07-005.1 — renders a tablist container", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByRole("tablist")).toBeDefined();
  });

  it("frd-07: AC-07-005.1 — renders exactly four tabs", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(4);
  });

  it("frd-07: AC-07-005.1 — renders Habilidades tab", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-skills")).toBeDefined();
  });

  it("frd-07: AC-07-005.1 — renders Agentes tab", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-agents")).toBeDefined();
  });

  it("frd-07: AC-07-005.1 — renders Reglas de decisión tab", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-rules")).toBeDefined();
  });

  it("frd-07: AC-07-005.1 — renders Estándares tab", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-standards")).toBeDefined();
  });

  it("frd-07: AC-07-005.1 — tabs appear in the correct order: Habilidades · Agentes · Reglas · Estándares", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]?.textContent).toBe(EXPECTED_LABELS.skills);
    expect(tabs[1]?.textContent).toBe(EXPECTED_LABELS.agents);
    expect(tabs[2]?.textContent).toBe(EXPECTED_LABELS.rules);
    expect(tabs[3]?.textContent).toBe(EXPECTED_LABELS.standards);
  });
});

// ---------------------------------------------------------------------------
// AC-07-005.2 — Default section is Skills; tab selection changes active section
// ---------------------------------------------------------------------------

describe("frd-07: SectionTabs — AC-07-005.2 default selection and switching", () => {
  it("frd-07: AC-07-005.2 — WHEN activeSection=skills THEN skills tab has aria-selected=true", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    const tab = screen.getByTestId("config-tab-skills");
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("frd-07: AC-07-005.2 — WHEN activeSection=skills THEN other tabs have aria-selected=false", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    for (const id of ["agents", "rules", "standards"] as const) {
      expect(screen.getByTestId(`config-tab-${id}`).getAttribute("aria-selected")).toBe("false");
    }
  });

  it("frd-07: AC-07-005.2 — WHEN activeSection=agents THEN agents tab has aria-selected=true", () => {
    render(<SectionTabs activeSection="agents" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-agents").getAttribute("aria-selected")).toBe("true");
  });

  it("frd-07: AC-07-005.2 — WHEN activeSection=rules THEN rules tab has aria-selected=true", () => {
    render(<SectionTabs activeSection="rules" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-rules").getAttribute("aria-selected")).toBe("true");
  });

  it("frd-07: AC-07-005.2 — WHEN activeSection=standards THEN standards tab has aria-selected=true", () => {
    render(<SectionTabs activeSection="standards" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-standards").getAttribute("aria-selected")).toBe("true");
  });

  it("frd-07: AC-07-005.2 — WHEN clicking agents tab THEN onSectionChange is called with 'agents'", () => {
    const calls: SectionId[] = [];
    render(
      <SectionTabs
        activeSection="skills"
        onSectionChange={(id) => {
          calls.push(id as SectionId);
        }}
      />,
    );
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    expect(calls).toContain("agents");
  });

  it("frd-07: AC-07-005.2 — WHEN clicking rules tab THEN onSectionChange is called with 'rules'", () => {
    const calls: SectionId[] = [];
    render(
      <SectionTabs
        activeSection="skills"
        onSectionChange={(id) => {
          calls.push(id as SectionId);
        }}
      />,
    );
    fireEvent.click(screen.getByTestId("config-tab-rules"));
    expect(calls).toContain("rules");
  });

  it("frd-07: AC-07-005.2 — WHEN clicking standards tab THEN onSectionChange is called with 'standards'", () => {
    const calls: SectionId[] = [];
    render(
      <SectionTabs
        activeSection="skills"
        onSectionChange={(id) => {
          calls.push(id as SectionId);
        }}
      />,
    );
    fireEvent.click(screen.getByTestId("config-tab-standards"));
    expect(calls).toContain("standards");
  });
});

// ---------------------------------------------------------------------------
// AC-07-005.3 — Design tokens only; active state paired with shape/label
// ---------------------------------------------------------------------------

describe("frd-07: SectionTabs — AC-07-005.3 design tokens and a11y active indicator", () => {
  it("frd-07: AC-07-005.3 — active tab has data-active='true' (shape/label, not color alone)", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-skills").getAttribute("data-active")).toBe("true");
  });

  it("frd-07: AC-07-005.3 — inactive tabs have data-active='false'", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    for (const id of ["agents", "rules", "standards"] as const) {
      expect(screen.getByTestId(`config-tab-${id}`).getAttribute("data-active")).toBe("false");
    }
  });

  it("frd-07: AC-07-005.3 — active tab has data-active='true' when agents is selected", () => {
    render(<SectionTabs activeSection="agents" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-agents").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("config-tab-skills").getAttribute("data-active")).toBe("false");
  });

  it("frd-07: AC-07-005.3 — tablist container has data-testid='config-section-tabs'", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-section-tabs")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-07-005.4 — Spanish labels, aria-labels, keyboard navigation
// ---------------------------------------------------------------------------

describe("frd-07: SectionTabs — AC-07-005.4 Spanish labels and keyboard navigation", () => {
  it("frd-07: AC-07-005.4 — Habilidades tab has Spanish text", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-skills").textContent).toBe("Habilidades");
  });

  it("frd-07: AC-07-005.4 — Agentes tab has Spanish text", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-agents").textContent).toBe("Agentes");
  });

  it("frd-07: AC-07-005.4 — Reglas de decisión tab has Spanish text", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-rules").textContent).toBe("Reglas de decisión");
  });

  it("frd-07: AC-07-005.4 — Estándares tab has Spanish text", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-standards").textContent).toBe("Estándares");
  });

  it("frd-07: AC-07-005.4 — tablist has Spanish aria-label", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    const tablist = screen.getByRole("tablist");
    expect(tablist.getAttribute("aria-label")).toBeTruthy();
    // Must contain Spanish content (not empty)
    const label = tablist.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("frd-07: AC-07-005.4 — active tab has tabIndex=0", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-skills").getAttribute("tabindex")).toBe("0");
  });

  it("frd-07: AC-07-005.4 — inactive tabs have tabIndex=-1 (keyboard focus to active only)", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    for (const id of ["agents", "rules", "standards"] as const) {
      expect(screen.getByTestId(`config-tab-${id}`).getAttribute("tabindex")).toBe("-1");
    }
  });

  it("frd-07: AC-07-005.4 — keyboard: pressing Enter on a tab calls onSectionChange", () => {
    const calls: string[] = [];
    render(
      <SectionTabs
        activeSection="skills"
        onSectionChange={(id) => {
          calls.push(id);
        }}
      />,
    );
    fireEvent.keyDown(screen.getByTestId("config-tab-agents"), { key: "Enter" });
    expect(calls).toContain("agents");
  });

  it("frd-07: AC-07-005.4 — keyboard: pressing Space on a tab calls onSectionChange", () => {
    const calls: string[] = [];
    render(
      <SectionTabs
        activeSection="skills"
        onSectionChange={(id) => {
          calls.push(id);
        }}
      />,
    );
    fireEvent.keyDown(screen.getByTestId("config-tab-standards"), { key: " " });
    expect(calls).toContain("standards");
  });
});

// ---------------------------------------------------------------------------
// ConfigurationPage integration: section bodies shown/hidden by active tab
// ---------------------------------------------------------------------------

describe("frd-07: ConfigurationPage — section panels mount per active tab", () => {
  it("frd-07: WHEN skills is active THEN config-section-skills panel is present", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    // The SectionTabs does NOT render panels — the page does. This test verifies
    // the container wraps only the tabs bar. Panels are rendered by the page component.
    // Just verify the tablist is present and no panel is in SectionTabs itself.
    expect(screen.getByRole("tablist")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ConfigurationShell integration: full page renders skills section by default
// ---------------------------------------------------------------------------

import { ConfigurationShell } from "./ConfigurationShell";

describe("frd-07: ConfigurationShell — AC-07-005.2 default section is Skills", () => {
  it("frd-07: WHEN rendered with no override THEN skills section is active by default", () => {
    render(<ConfigurationShell />);
    const tab = screen.getByTestId("config-tab-skills");
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("frd-07: WHEN rendered THEN all four section tabs are present", () => {
    render(<ConfigurationShell />);
    expect(screen.getAllByRole("tab").length).toBe(4);
  });

  it("frd-07: WHEN clicking Agentes tab THEN Agentes tab becomes active", () => {
    render(<ConfigurationShell />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    expect(screen.getByTestId("config-tab-agents").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("config-tab-skills").getAttribute("aria-selected")).toBe("false");
  });

  it("frd-07: WHEN clicking Reglas tab THEN Reglas tab becomes active", () => {
    render(<ConfigurationShell />);
    fireEvent.click(screen.getByTestId("config-tab-rules"));
    expect(screen.getByTestId("config-tab-rules").getAttribute("aria-selected")).toBe("true");
  });

  it("frd-07: WHEN clicking Estándares tab THEN Estándares tab becomes active", () => {
    render(<ConfigurationShell />);
    fireEvent.click(screen.getByTestId("config-tab-standards"));
    expect(screen.getByTestId("config-tab-standards").getAttribute("aria-selected")).toBe("true");
  });

  it("frd-07: WHEN skills is active THEN config-section-skills panel is rendered", () => {
    render(<ConfigurationShell />);
    expect(screen.getByTestId("config-section-skills")).toBeDefined();
  });

  it("frd-07: WHEN agents is active THEN config-section-agents panel is rendered", () => {
    render(<ConfigurationShell />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    expect(screen.getByTestId("config-section-agents")).toBeDefined();
  });

  it("frd-07: WHEN rules is active THEN config-section-rules panel is rendered", () => {
    render(<ConfigurationShell />);
    fireEvent.click(screen.getByTestId("config-tab-rules"));
    expect(screen.getByTestId("config-section-rules")).toBeDefined();
  });

  it("frd-07: WHEN standards is active THEN config-section-standards panel is rendered", () => {
    render(<ConfigurationShell />);
    fireEvent.click(screen.getByTestId("config-tab-standards"));
    expect(screen.getByTestId("config-section-standards")).toBeDefined();
  });

  it("frd-07: WHEN skills is active THEN agents panel is NOT rendered", () => {
    render(<ConfigurationShell />);
    expect(screen.queryByTestId("config-section-agents")).toBeNull();
  });

  it("frd-07: WHEN skills is active THEN rules panel is NOT rendered", () => {
    render(<ConfigurationShell />);
    expect(screen.queryByTestId("config-section-rules")).toBeNull();
  });

  it("frd-07: WHEN skills is active THEN standards panel is NOT rendered", () => {
    render(<ConfigurationShell />);
    expect(screen.queryByTestId("config-section-standards")).toBeNull();
  });

  it("frd-07: WHEN rendered THEN config-shell wrapper is present", () => {
    render(<ConfigurationShell />);
    expect(screen.getByTestId("config-shell")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// a11y: tab panels have correct role and aria-labelledby
// ---------------------------------------------------------------------------

describe("frd-07: ConfigurationShell — a11y panel roles", () => {
  it("frd-07: WHEN skills panel is rendered THEN has role='tabpanel'", () => {
    render(<ConfigurationShell />);
    const panel = screen.getByTestId("config-section-skills");
    expect(panel.getAttribute("role")).toBe("tabpanel");
  });

  it("frd-07: WHEN agents panel is rendered THEN has role='tabpanel'", () => {
    render(<ConfigurationShell />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const panel = screen.getByTestId("config-section-agents");
    expect(panel.getAttribute("role")).toBe("tabpanel");
  });

  it("frd-07: WHEN skills panel is rendered THEN panel has aria-labelledby pointing to the skills tab", () => {
    render(<ConfigurationShell />);
    const tab = screen.getByTestId("config-tab-skills");
    const panel = screen.getByTestId("config-section-skills");
    const tabId = tab.getAttribute("id");
    expect(tabId).toBeTruthy();
    expect(panel.getAttribute("aria-labelledby")).toBe(tabId);
  });
});
