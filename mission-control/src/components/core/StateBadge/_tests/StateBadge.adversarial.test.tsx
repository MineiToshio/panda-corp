/**
 * WO-13-005 — StateBadge (CMP-13-state-badge) — ADVERSARIAL tests (reviewer, DR-015)
 *
 * Written by the Opus reviewer AFTER the implementer's GREEN suite, targeting
 * edge cases and mutations the implementer's tests did NOT cover. These probe
 * the ACTUAL rendered output (SVG geometry, the accessibility tree, runtime
 * type coercion) rather than re-asserting STATE_BADGE token constants.
 *
 * Gaps in the implementer suite (components/StateBadge.test.tsx) these close:
 *   - The "never color-only" claim was only checked against token STRINGS
 *     (data-icon == STATE_BADGE[s].icon). A mutation that swaps the rendered
 *     SVG case for `circle-x` and `circle-check` would pass every existing
 *     test, because none renders and inspects the SVG shape itself.
 *   - role="img" + accessible-name was never verified through the a11y tree
 *     (getByRole("img", { name })).
 *   - The inner decorative SVG was never asserted to be aria-hidden — a leak
 *     would make the badge announce twice.
 *   - Runtime non-string state (null / undefined / number / object) is guarded
 *     in the code (`typeof state === "string" ? state : ""`) but no test ever
 *     drove that branch.
 *   - The fallback diamond SVG for an unknown icon was never asserted to render.
 *   - The visible label and the aria-label could drift apart silently.
 *
 * Traceability: AC-13-007.1 (REQ-13-007), AC-13-008.1 (REQ-13-008).
 * Stack: Vitest + @testing-library/react + jsdom + jest-dom.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AGENT_STATES, type AgentState, STATE_BADGE } from "@/app/_design/tokens/tokens";
import { StateBadge, type StateBadgeProps } from "@/components/core/StateBadge/StateBadge";

function renderBadge(props: StateBadgeProps) {
  return render(<StateBadge {...props} />);
}

// ---------------------------------------------------------------------------
// A. The rendered SVG shape is the real non-color signal — not just data-icon.
//    Mutation guard: swapping the SVG case bodies for two states must break
//    a test, otherwise the "shape" claim is unverified.
// ---------------------------------------------------------------------------

describe("adversarial: rendered SVG geometry distinguishes failed from completed", () => {
  it("failed renders an X (two crossing <line>s), NOT a checkmark <polyline>", () => {
    const { container } = renderBadge({ state: "failed" });
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // circle-x is built from <line> primitives and contains no <polyline>.
    expect(svg?.querySelectorAll("line").length).toBeGreaterThanOrEqual(2);
    expect(svg?.querySelector("polyline")).toBeNull();
  });

  it("completed renders a checkmark <polyline>, NOT crossing X <line>s", () => {
    const { container } = renderBadge({ state: "completed" });
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // circle-check is built from a <polyline>; it must not be an X.
    expect(svg?.querySelector("polyline")).not.toBeNull();
    expect(svg?.querySelectorAll("line").length).toBe(0);
  });

  it("the failed SVG markup differs from the completed SVG markup (real shape divergence)", () => {
    const { container: failedC, unmount } = renderBadge({ state: "failed" });
    const failedSvg = failedC.querySelector("svg")?.innerHTML ?? "FAILED_NONE";
    unmount();
    const { container: completedC } = renderBadge({ state: "completed" });
    const completedSvg = completedC.querySelector("svg")?.innerHTML ?? "COMPLETED_NONE";
    expect(failedSvg).not.toBe(completedSvg);
    expect(failedSvg).not.toBe("FAILED_NONE");
    expect(completedSvg).not.toBe("COMPLETED_NONE");
  });

  it("every canonical state renders a non-empty, structurally distinct SVG", () => {
    const markups = new Map<AgentState, string>();
    for (const state of AGENT_STATES) {
      const { container, unmount } = renderBadge({ state });
      const svg = container.querySelector("svg");
      expect(svg, `state ${state} must render an <svg>`).not.toBeNull();
      const inner = svg?.innerHTML ?? "";
      expect(inner.trim(), `state ${state} SVG must not be empty`).not.toBe("");
      markups.set(state, inner);
      unmount();
    }
    // No two states share identical SVG inner markup → shape is a real signal.
    const uniqueMarkups = new Set(markups.values());
    expect(uniqueMarkups.size).toBe(AGENT_STATES.length);
  });
});

// ---------------------------------------------------------------------------
// B. Accessibility tree — role="img" with the Spanish label as accessible name.
//    Mutation guard: dropping role="img" or aria-label breaks getByRole(name).
// ---------------------------------------------------------------------------

describe("adversarial: accessibility tree exposes role=img with the Spanish name", () => {
  for (const state of AGENT_STATES) {
    const label = STATE_BADGE[state].label;
    it(`state="${state}" is reachable as role="img" named "${label}"`, () => {
      renderBadge({ state });
      // If role or aria-label is removed/mutated, this query throws.
      const el = screen.getByRole("img", { name: label });
      expect(el).toBeInTheDocument();
    });
  }

  it("the inner SVG is decorative (aria-hidden) — the badge must not announce twice", () => {
    const { container } = renderBadge({ state: "working" });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("the inner SVG contributes no accessible name of its own", () => {
    renderBadge({ state: "reviewing" });
    const badge = screen.getByRole("img", { name: "En revisión" });
    // No second img/graphics node leaking a name inside the badge.
    const innerImgs = within(badge).queryAllByRole("img");
    expect(innerImgs.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// C. Runtime type coercion — the code guards non-string `state`, drive it.
//    AC-13-007.1 robustness: never crash on unexpected runtime input.
// ---------------------------------------------------------------------------

describe("adversarial: non-string runtime state never crashes, always shows fallback label", () => {
  const badInputs: Array<[string, unknown]> = [
    ["null", null],
    ["undefined", undefined],
    ["number", 42],
    ["object", { state: "working" }],
    ["array", ["working"]],
    ["boolean", true],
  ];

  for (const [name, value] of badInputs) {
    it(`state=${name} renders the "Desconocido" fallback without throwing`, () => {
      const coerced = value as unknown as AgentState;
      expect(() => renderBadge({ state: coerced })).not.toThrow();
      const badge = screen.getByTestId("state-badge");
      expect(badge.getAttribute("aria-label")).toBe("Desconocido");
      expect(within(badge).getByText("Desconocido")).toBeInTheDocument();
    });
  }

  it("a non-string state coerces data-state to empty string (not '[object Object]')", () => {
    const coerced = { foo: 1 } as unknown as AgentState;
    renderBadge({ state: coerced });
    const badge = screen.getByTestId("state-badge");
    // The guard sets stateStr = "" for non-strings; it must not leak a stringified object.
    expect(badge.getAttribute("data-state")).toBe("");
    expect(badge.getAttribute("data-state")).not.toContain("object");
  });
});

// ---------------------------------------------------------------------------
// D. Unknown string state → fallback diamond SVG + "help-circle" data-icon.
//    Existing tests assert it doesn't throw; none assert WHAT renders.
// ---------------------------------------------------------------------------

describe("adversarial: unknown string state renders the fallback shape and icon id", () => {
  it("data-icon is the help-circle fallback identifier", () => {
    renderBadge({ state: "not-a-real-state" as unknown as AgentState });
    expect(screen.getByTestId("state-badge").getAttribute("data-icon")).toBe("help-circle");
  });

  it("an unknown icon renders the fallback diamond <polygon>, not a crash and not blank", () => {
    // "help-circle" is not one of the explicit SVG cases → default branch (diamond).
    const { container } = renderBadge({ state: "not-a-real-state" as unknown as AgentState });
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("polygon")).not.toBeNull();
  });

  it("empty-string state still renders a labelled fallback badge", () => {
    renderBadge({ state: "" as unknown as AgentState });
    const badge = screen.getByTestId("state-badge");
    expect(badge.getAttribute("aria-label")).toBe("Desconocido");
  });
});

// ---------------------------------------------------------------------------
// E. The visible label and the aria-label must come from the SAME entry.
//    Mutation guard: if the visible <span> read a different source than the
//    aria-label, a screen-reader user and a sighted user would disagree.
// ---------------------------------------------------------------------------

describe("adversarial: visible text label and aria-label never drift apart", () => {
  for (const state of AGENT_STATES) {
    const label = STATE_BADGE[state].label;
    it(`state="${state}" — visible text === aria-label === "${label}"`, () => {
      renderBadge({ state });
      const badge = screen.getByTestId("state-badge");
      const aria = badge.getAttribute("aria-label");
      const visible = within(badge).getByText(label);
      expect(aria).toBe(label);
      expect(visible.textContent).toBe(label);
    });
  }
});

// ---------------------------------------------------------------------------
// F. Size variants change the SVG dimensions (sm=14, md=16) — the prop is
//    not decorative-only; it must actually affect the rendered icon.
// ---------------------------------------------------------------------------

describe("adversarial: size prop actually changes the rendered SVG dimensions", () => {
  it("size=sm renders a 14px icon", () => {
    const { container } = renderBadge({ state: "idle", size: "sm" });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("14");
    expect(svg?.getAttribute("height")).toBe("14");
  });

  it("size=md (and default) renders a 16px icon", () => {
    const { container } = renderBadge({ state: "idle", size: "md" });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
  });

  it("sm and md produce different icon widths (the prop is not ignored)", () => {
    const { container: smC, unmount } = renderBadge({ state: "idle", size: "sm" });
    const smW = smC.querySelector("svg")?.getAttribute("width");
    unmount();
    const { container: mdC } = renderBadge({ state: "idle", size: "md" });
    const mdW = mdC.querySelector("svg")?.getAttribute("width");
    expect(smW).not.toBe(mdW);
  });
});

// ---------------------------------------------------------------------------
// G. No hardcoded hex on the INNER svg either (FRD-13 §3) — existing tests only
//    checked the outer span's inline style. Stroke/fill must use currentColor.
// ---------------------------------------------------------------------------

describe("adversarial: no hardcoded hex anywhere in the rendered subtree", () => {
  for (const state of AGENT_STATES) {
    it(`state="${state}" — full rendered HTML contains no raw hex color`, () => {
      const { container } = renderBadge({ state });
      const html = container.innerHTML;
      // currentColor / CSS vars only — a literal #rgb or #rrggbb is a token violation.
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  }

  it("the SVG strokes use currentColor (color inherited from the token-driven span)", () => {
    const { container } = renderBadge({ state: "failed" });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
  });
});
