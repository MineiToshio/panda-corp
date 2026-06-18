/**
 * WO-13-005 — StateBadge (CMP-13-state-badge) — RED phase tests
 *
 * Written BEFORE the implementation. Every test is expected to fail until
 * `components/StateBadge.tsx` exists and passes these contracts.
 *
 * Traceability:
 *   AC-13-007.1 (REQ-13-007) — NO state SHALL depend on color alone:
 *                               each state is paired with an icon/shape + label.
 *   AC-13-008.1 (REQ-13-008) — Accessibility: Spanish aria-label on icons,
 *                               aria-live="polite" support.
 *
 * Scope anchored in WO-13-005 TDD:
 *   - Every state renders its icon + label (assert label text, not color).
 *   - Failed and completed are distinguishable by icon + label (not just color).
 *   - Spanish aria-label present on the badge container.
 *   - Unknown/undefined state → safe fallback, never crashes.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * No I/O; no real network. Imports from IF-13-state-vocab (tokens.ts)
 * and the not-yet-existing CMP-13-state-badge (components/StateBadge.tsx).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AGENT_STATES, type AgentState, STATE_BADGE } from "@/app/_design/tokens";
// NOTE: StateBadge does not exist yet — these imports will fail until WO-13-005 is GREEN.
import { StateBadge, type StateBadgeProps } from "@/components/core/StateBadge/StateBadge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBadge(props: StateBadgeProps) {
  return render(<StateBadge {...props} />);
}

// ---------------------------------------------------------------------------
// 1. Contract: every canonical state renders its label (not color-only)
//    AC-13-007.1 — NO state SHALL depend on color alone
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: AC-13-007.1 — every state has a visible label", () => {
  for (const state of AGENT_STATES) {
    const expectedLabel = STATE_BADGE[state].label;

    it(`frd-13: AC-13-007.1 — WHEN state="${state}" THEN label "${expectedLabel}" is visible in the DOM`, () => {
      renderBadge({ state });
      // The label text must be present — color alone must not be the only signal.
      expect(screen.getByText(expectedLabel)).toBeDefined();
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Contract: every canonical state renders its icon (shape signal)
//    AC-13-007.1 — shape is the non-color redundant signal
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: AC-13-007.1 — every state exposes a data-icon attribute", () => {
  for (const state of AGENT_STATES) {
    const expectedIcon = STATE_BADGE[state].icon;

    it(`frd-13: AC-13-007.1 — WHEN state="${state}" THEN badge carries data-icon="${expectedIcon}"`, () => {
      renderBadge({ state });
      // The icon identity is carried on data-icon so screen readers and tests
      // can verify the shape signal without relying on SVG path content.
      const badge = screen.getByTestId("state-badge");
      expect(badge.getAttribute("data-icon")).toBe(expectedIcon);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Contract: the badge container has data-testid="state-badge"
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: data-testid presence", () => {
  it("frd-13: WHEN any valid state is rendered THEN data-testid=state-badge is present", () => {
    renderBadge({ state: "working" });
    expect(screen.getByTestId("state-badge")).toBeDefined();
  });

  it("frd-13: WHEN state=idle THEN data-testid=state-badge is present", () => {
    renderBadge({ state: "idle" });
    expect(screen.getByTestId("state-badge")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Contract: Spanish aria-label on the badge container
//    AC-13-008.1 — aria-label in Spanish on icons
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: AC-13-008.1 — Spanish aria-label", () => {
  for (const state of AGENT_STATES) {
    const expectedLabel = STATE_BADGE[state].label;

    it(`frd-13: AC-13-008.1 — WHEN state="${state}" THEN aria-label equals the Spanish label "${expectedLabel}"`, () => {
      renderBadge({ state });
      const badge = screen.getByTestId("state-badge");
      expect(badge.getAttribute("aria-label")).toBe(expectedLabel);
    });
  }

  it("frd-13: AC-13-008.1 — aria-label is never empty for any canonical state", () => {
    for (const state of AGENT_STATES) {
      const { unmount } = renderBadge({ state });
      const badge = screen.getByTestId("state-badge");
      const label = badge.getAttribute("aria-label");
      expect(label).toBeTruthy();
      // Must not be whitespace-only
      expect(label?.trim()).not.toBe("");
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Contract: failed and completed are distinguishable by icon + label
//    Regression — warm palette: red/orange/amber are close; icon/label must differ
//    (anchored in FRD-13: "critical with a warm palette, where reds/oranges/amber
//     are close together")
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: AC-13-007.1 — failed vs completed distinguishable without color", () => {
  it("frd-13: WHEN state=failed THEN label differs from completed label", () => {
    expect(STATE_BADGE.failed.label).not.toBe(STATE_BADGE.completed.label);
  });

  it("frd-13: WHEN state=failed THEN icon differs from completed icon", () => {
    expect(STATE_BADGE.failed.icon).not.toBe(STATE_BADGE.completed.icon);
  });

  it("frd-13: WHEN state=failed THEN rendered label is 'Fallido' (not 'Completado')", () => {
    renderBadge({ state: "failed" });
    expect(screen.getByText("Fallido")).toBeDefined();
    expect(screen.queryByText("Completado")).toBeNull();
  });

  it("frd-13: WHEN state=completed THEN rendered label is 'Completado' (not 'Fallido')", () => {
    renderBadge({ state: "completed" });
    expect(screen.getByText("Completado")).toBeDefined();
    expect(screen.queryByText("Fallido")).toBeNull();
  });

  it("frd-13: WHEN state=failed THEN data-icon differs from completed data-icon", () => {
    const { unmount } = renderBadge({ state: "failed" });
    const failedIcon = screen.getByTestId("state-badge").getAttribute("data-icon");
    unmount();

    renderBadge({ state: "completed" });
    const completedIcon = screen.getByTestId("state-badge").getAttribute("data-icon");

    expect(failedIcon).not.toBe(completedIcon);
  });

  it("frd-13: WHEN state=failed THEN data-state attribute equals 'failed'", () => {
    renderBadge({ state: "failed" });
    const badge = screen.getByTestId("state-badge");
    expect(badge.getAttribute("data-state")).toBe("failed");
  });

  it("frd-13: WHEN state=completed THEN data-state attribute equals 'completed'", () => {
    renderBadge({ state: "completed" });
    const badge = screen.getByTestId("state-badge");
    expect(badge.getAttribute("data-state")).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// 6. Contract: data-state attribute on every canonical state
//    Allows consumers to apply non-color CSS without re-reading the label text
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: AC-13-007.1 — data-state attribute present on every state", () => {
  for (const state of AGENT_STATES) {
    it(`frd-13: WHEN state="${state}" THEN data-state="${state}" on the badge element`, () => {
      renderBadge({ state });
      const badge = screen.getByTestId("state-badge");
      expect(badge.getAttribute("data-state")).toBe(state);
    });
  }
});

// ---------------------------------------------------------------------------
// 7. Error path: unknown/undefined state → safe fallback, never throws
//    AC-13-007.1 — component must not crash on unexpected input (robustness)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: AC-13-007.1 — unknown state → safe fallback, never throws", () => {
  it("frd-13: WHEN state is an unknown string THEN component renders without throwing", () => {
    // Cast through unknown to simulate runtime data arriving with an unexpected value.
    const unknownState = "unknown-state" as unknown as AgentState;
    expect(() => renderBadge({ state: unknownState })).not.toThrow();
  });

  it("frd-13: WHEN state is unknown THEN data-testid=state-badge is still present", () => {
    const unknownState = "unknown-state" as unknown as AgentState;
    renderBadge({ state: unknownState });
    expect(screen.getByTestId("state-badge")).toBeDefined();
  });

  it("frd-13: WHEN state is unknown THEN aria-label is not empty (fallback label)", () => {
    const unknownState = "unknown-state" as unknown as AgentState;
    renderBadge({ state: unknownState });
    const badge = screen.getByTestId("state-badge");
    const label = badge.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label?.trim()).not.toBe("");
  });

  it("frd-13: WHEN state is empty string THEN component renders without throwing", () => {
    const emptyState = "" as unknown as AgentState;
    expect(() => renderBadge({ state: emptyState })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 8. Contract: no hardcoded color values in rendered output
//    FRD-13 rule: "no hardcoded colors anywhere — every styled value reads a token var"
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: no hardcoded color values in style attributes", () => {
  it("frd-13: WHEN working state THEN badge element has no inline color style with raw hex", () => {
    renderBadge({ state: "working" });
    const badge = screen.getByTestId("state-badge");
    const inlineStyle = badge.getAttribute("style") ?? "";
    // Raw hex colors (#xxx or #xxxxxx) must not appear — use CSS vars only.
    expect(inlineStyle).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("frd-13: WHEN failed state THEN badge element has no inline color style with raw hex", () => {
    renderBadge({ state: "failed" });
    const badge = screen.getByTestId("state-badge");
    const inlineStyle = badge.getAttribute("style") ?? "";
    expect(inlineStyle).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// 9. Contract: optional size prop is accepted (compact vs default layout)
//    Not required by EARS, but required by WO scope: "reused by Party sprites/feed,
//    DAG nodes, board/portfolio chips" — they need a size or variant prop.
//    Tests verifying the prop is at minimum accepted without error.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: optional size prop does not throw", () => {
  it("frd-13: WHEN size=sm THEN renders without throwing", () => {
    expect(() => renderBadge({ state: "idle", size: "sm" })).not.toThrow();
  });

  it("frd-13: WHEN size=md THEN renders without throwing", () => {
    expect(() => renderBadge({ state: "idle", size: "md" })).not.toThrow();
  });

  it("frd-13: WHEN size prop is omitted THEN renders with default size without throwing", () => {
    expect(() => renderBadge({ state: "idle" })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 10. Contract: STATE_BADGE vocabulary completeness (regression from WO-13-001 history)
//     Anchored in the WO-13-001 bug: blueprint extended the state list to 6 states
//     (working/idle/failed/completed/blocked/reviewing) but FRD-13 text listed 4.
//     STATE_BADGE must cover all 6, with non-empty icon AND label for each.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: STATE_BADGE vocabulary covers all 6 states (regression WO-13-001)", () => {
  const REQUIRED_STATES: AgentState[] = [
    "working",
    "idle",
    "failed",
    "completed",
    "blocked",
    "reviewing",
  ];

  for (const state of REQUIRED_STATES) {
    it(`frd-13: STATE_BADGE["${state}"].icon is non-empty`, () => {
      expect(STATE_BADGE[state].icon.trim()).not.toBe("");
    });

    it(`frd-13: STATE_BADGE["${state}"].label is non-empty Spanish text`, () => {
      expect(STATE_BADGE[state].label.trim()).not.toBe("");
    });
  }

  it("frd-13: STATE_BADGE has exactly 6 entries — no missing, no extra", () => {
    expect(Object.keys(STATE_BADGE)).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// 11. Contract: working and idle are distinguishable (active vs passive)
//    Both are non-terminal states; a warm palette makes amber/grey look similar.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: working vs idle distinguishable without color", () => {
  it("frd-13: working label differs from idle label", () => {
    expect(STATE_BADGE.working.label).not.toBe(STATE_BADGE.idle.label);
  });

  it("frd-13: working icon differs from idle icon", () => {
    expect(STATE_BADGE.working.icon).not.toBe(STATE_BADGE.idle.icon);
  });

  it("frd-13: WHEN state=working THEN rendered label is 'Trabajando'", () => {
    renderBadge({ state: "working" });
    expect(screen.getByText("Trabajando")).toBeDefined();
    expect(screen.queryByText("En espera")).toBeNull();
  });

  it("frd-13: WHEN state=idle THEN rendered label is 'En espera'", () => {
    renderBadge({ state: "idle" });
    expect(screen.getByText("En espera")).toBeDefined();
    expect(screen.queryByText("Trabajando")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 12. Contract: blocked and reviewing are distinguishable (both non-terminal blockages)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: blocked vs reviewing distinguishable without color", () => {
  it("frd-13: blocked label differs from reviewing label", () => {
    expect(STATE_BADGE.blocked.label).not.toBe(STATE_BADGE.reviewing.label);
  });

  it("frd-13: blocked icon differs from reviewing icon", () => {
    expect(STATE_BADGE.blocked.icon).not.toBe(STATE_BADGE.reviewing.icon);
  });
});

// ---------------------------------------------------------------------------
// 13. Contract: all 6 icons are distinct (no state shares an icon shape)
//    Two states with the same icon would make them indistinguishable without color.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-005: AC-13-007.1 — all 6 state icons are unique", () => {
  it("frd-13: no two canonical states share the same icon identifier", () => {
    const icons = AGENT_STATES.map((s) => STATE_BADGE[s].icon);
    const uniqueIcons = new Set(icons);
    expect(uniqueIcons.size).toBe(AGENT_STATES.length);
  });

  it("frd-13: no two canonical states share the same Spanish label", () => {
    const labels = AGENT_STATES.map((s) => STATE_BADGE[s].label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(AGENT_STATES.length);
  });
});
